import { insert, one, select, update } from "./db";
import { paypalConfigured } from "./env";
import * as paypal from "./paypal";
import { assessRisk } from "./risk";
import { token } from "./auth";
import type { Dispute, Evidence, InvoiceDraft, Message, Order, OrderEvent, Resolution, Seller } from "./types";

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const now = () => new Date().toISOString();

export const STATUS_LABEL: Record<string, string> = {
  created: "Awaiting payment",
  held: "Paid & held",
  shipped: "Shipped",
  delivered: "Delivered",
  disputed: "In dispute",
  settled: "Settled",
  partially_settled: "Partly settled",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export const OPEN_STATUSES = ["held", "shipped", "delivered", "disputed"];

export async function logEvent(o: Pick<Order, "id" | "seller_id"> | null, sellerId: string, type: string, actor: string, message: string, data?: Record<string, unknown>) {
  await insert<OrderEvent>("ho_order_events", { order_id: o?.id ?? null, seller_id: sellerId, type, actor, message, data: data ?? null });
}

export async function sellerOrders(sellerId: string) {
  return select<Order>("ho_orders", { seller_id: `eq.${sellerId}`, order: "created_at.desc", limit: 500 });
}

export async function getOrder(sellerId: string, id: string) {
  return one<Order>("ho_orders", { seller_id: `eq.${sellerId}`, id: `eq.${id}` });
}

export async function getOrderByNumber(sellerId: string, n: number) {
  return one<Order>("ho_orders", { seller_id: `eq.${sellerId}`, number: `eq.${n}` });
}

export async function getOrderByToken(t: string) {
  return one<Order>("ho_orders", { public_token: `eq.${t}` });
}

export async function orderThread(orderId: string) {
  const [events, messages, evidence] = await Promise.all([
    select<OrderEvent>("ho_order_events", { order_id: `eq.${orderId}`, order: "created_at.asc" }),
    select<Message>("ho_messages", { order_id: `eq.${orderId}`, order: "created_at.asc" }),
    select<Evidence>("ho_evidence", { order_id: `eq.${orderId}`, order: "created_at.asc" }),
  ]);
  return { events, messages, evidence };
}

async function patch(o: Order, p: Partial<Order>): Promise<Order> {
  const [row] = await update<Order>("ho_orders", { id: `eq.${o.id}` }, { ...p, updated_at: now() });
  return row;
}

export async function createOrder(seller: Seller, d: InvoiceDraft, opts: { createdAt?: string } = {}) {
  if (!d.buyer_name?.trim()) throw new Error("Buyer name is required");
  if (!(d.amount > 0)) throw new Error("Amount must be more than 0");
  const history = await sellerOrders(seller.id);
  const number = (history.reduce((m, o) => Math.max(m, o.number), 0) || 0) + 1;
  const items = d.items?.length ? d.items : [{ name: "Order", qty: 1, unit_price: d.amount }];
  const risk = assessRisk({ amount: d.amount, buyer_email: d.buyer_email, buyer_name: d.buyer_name, items, currency: d.currency }, history);
  const [o] = await insert<Order>("ho_orders", {
    seller_id: seller.id,
    number,
    public_token: token(9),
    buyer_name: d.buyer_name.trim(),
    buyer_email: d.buyer_email || null,
    items,
    amount: d.amount,
    currency: (d.currency || "USD").toUpperCase(),
    delivery_date: d.delivery_date || null,
    note: d.note || null,
    status: "created",
    risk,
    ...(opts.createdAt ? { created_at: opts.createdAt, updated_at: opts.createdAt } : {}),
  });
  await logEvent(o, seller.id, "created", "seller", `Invoice #${o.number} created for ${o.buyer_name}: ${fmt(o.amount, o.currency)}`);
  if (risk.some((r) => r.level !== "low")) await logEvent(o, seller.id, "risk", "system", `Risk check on #${o.number}: ${risk.filter((r) => r.level !== "low").map((r) => r.message).join(" ")}`);
  return o;
}

export function fmt(v: number | string, c: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(Number(v));
  } catch {
    return `${c} ${Number(v).toFixed(2)}`;
  }
}

// ---------- Payment (hold) ----------

export async function markAuthorized(o: Order, auth: { authorizationId: string; paypalOrderId?: string; simulated: boolean; authorizedAt?: Date }) {
  const at = auth.authorizedAt ?? new Date();
  const updated = await patch(o, {
    status: "held",
    authorization_id: auth.authorizationId,
    paypal_order_id: auth.paypalOrderId ?? o.paypal_order_id,
    simulated: auth.simulated,
    authorized_at: at.toISOString(),
    honor_expires_at: new Date(at.getTime() + 3 * DAY).toISOString(),
    auth_expires_at: new Date(at.getTime() + 29 * DAY).toISOString(),
  });
  await logEvent(o, o.seller_id, "paid", "buyer", `${o.buyer_name} paid ${fmt(o.amount, o.currency)} for #${o.number}. Funds are held until delivery is confirmed${auth.simulated ? " (simulated sandbox payment)" : ""}.`, { authorization_id: auth.authorizationId });
  return updated;
}

export function authHealth(o: Order) {
  if (!o.authorized_at || !["held", "shipped", "delivered", "disputed"].includes(o.status)) return null;
  const t = Date.now();
  const honor = new Date(o.honor_expires_at!).getTime();
  const exp = new Date(o.auth_expires_at!).getTime();
  const ageDays = (t - new Date(o.authorized_at).getTime()) / DAY;
  if (t > exp) return { level: "expired" as const, ageDays, message: "Authorization expired. The buyer has to pay again." };
  if (t > honor) return { level: "reauth" as const, ageDays, message: "3-day honor period is over. Reauthorize to keep the funds guaranteed." };
  if (honor - t < DAY) return { level: "soon" as const, ageDays, message: "Honor period ends in under 24h. Capture or reauthorize soon." };
  return { level: "ok" as const, ageDays, message: `Funds guaranteed for ${Math.max(0, Math.ceil((honor - t) / HOUR))}h more, valid up to 29 days.` };
}

export async function reauthorizeOrder(o: Order) {
  if (!o.authorization_id) throw new Error("No authorization to renew");
  let newId = o.authorization_id;
  if (!o.simulated) {
    if (!paypalConfigured()) throw new Error("PayPal sandbox not configured");
    const r = await paypal.reauthorize(o.authorization_id);
    newId = r.id || newId;
  } else newId = `SIM-AUTH-${token(6)}`;
  const at = new Date();
  const updated = await patch(o, {
    authorization_id: newId,
    honor_expires_at: new Date(at.getTime() + 3 * DAY).toISOString(),
  });
  await logEvent(o, o.seller_id, "reauthorized", "seller", `Authorization for #${o.number} renewed. Funds guaranteed for another 3 days.`, { authorization_id: newId });
  return updated;
}

// ---------- Fulfilment ----------

export async function markShipped(o: Order, info: { carrier?: string | null; tracking?: string | null; note?: string | null }) {
  if (!["held", "shipped"].includes(o.status)) throw new Error(o.status === "created" ? `#${o.number} isn't paid yet, so it can't be shipped.` : `#${o.number} is ${STATUS_LABEL[o.status]}.`);
  const updated = await patch(o, { status: "shipped", shipped_at: o.shipped_at ?? now(), carrier: info.carrier || o.carrier, tracking: info.tracking || o.tracking });
  const bits = [info.carrier, info.tracking && `tracking ${info.tracking}`].filter(Boolean).join(", ");
  await logEvent(o, o.seller_id, "shipped", "seller", `#${o.number} marked shipped${bits ? ` (${bits})` : ""}.`);
  if (info.note) await insert("ho_messages", { order_id: o.id, author: "seller", body: info.note });
  return updated;
}

export async function sellerConfirm(o: Order) {
  if (!["shipped", "delivered", "held"].includes(o.status)) throw new Error(`#${o.number} can't be confirmed while ${STATUS_LABEL[o.status]}.`);
  let cur = o;
  if (o.status === "held") cur = await markShipped(o, {});
  cur = await patch(cur, { seller_confirmed_at: now() });
  await logEvent(cur, cur.seller_id, "seller_confirmed", "seller", `Seller confirmed #${cur.number} was delivered.`);
  return maybeSettle(cur);
}

export async function buyerConfirm(o: Order) {
  if (!["shipped", "held", "delivered"].includes(o.status)) throw new Error(`This order is ${STATUS_LABEL[o.status]}.`);
  let cur = await patch(o, { buyer_confirmed_at: now(), status: o.seller_confirmed_at ? o.status : "delivered", shipped_at: o.shipped_at ?? now() });
  await logEvent(cur, cur.seller_id, "buyer_confirmed", "buyer", `${cur.buyer_name} confirmed #${cur.number} arrived safely.`);
  cur = await maybeSettle(cur);
  return cur;
}

async function maybeSettle(o: Order) {
  if (o.buyer_confirmed_at && o.seller_confirmed_at) return capture(o, Number(o.amount), "Both sides confirmed delivery.", "settled");
  return o;
}

async function capture(o: Order, amount: number, reason: string, status: "settled" | "partially_settled", eventType = "settled") {
  if (!o.authorization_id) throw new Error("No authorization on this order");
  let captureId = `SIM-CAP-${token(6)}`;
  if (!o.simulated) {
    if (!paypalConfigured()) throw new Error("PayPal sandbox not configured");
    const partial = amount < Number(o.amount) - 0.001;
    const r = await paypal.captureAuthorization(o.authorization_id, partial ? { value: amount, currency: o.currency } : undefined, `Handover order #${o.number}`);
    captureId = r.id;
  }
  const updated = await patch(o, { status, captured_amount: amount, capture_id: captureId, settled_at: now(), refunded_amount: Math.max(0, Number(o.amount) - amount) || null });
  await logEvent(o, o.seller_id, eventType, "system", `${fmt(amount, o.currency)} released to the seller for #${o.number}. ${reason}`, { capture_id: captureId, simulated: o.simulated });
  return updated;
}

async function voidAuth(o: Order, reason: string) {
  if (o.authorization_id && !o.simulated) {
    if (!paypalConfigured()) throw new Error("PayPal sandbox not configured");
    await paypal.voidAuthorization(o.authorization_id);
  }
  const updated = await patch(o, { status: "refunded", refunded_amount: Number(o.amount), captured_amount: 0, settled_at: now() });
  await logEvent(o, o.seller_id, "refunded", "system", `Hold on #${o.number} released back to ${o.buyer_name}. ${reason}`);
  return updated;
}

export async function cancelOrder(o: Order) {
  if (o.status === "created") {
    const u = await patch(o, { status: "cancelled" });
    await logEvent(o, o.seller_id, "cancelled", "seller", `Invoice #${o.number} cancelled.`);
    return u;
  }
  if (["held", "shipped"].includes(o.status)) return voidAuth(o, "Seller cancelled the order.");
  throw new Error(`Can't cancel while ${STATUS_LABEL[o.status]}.`);
}

// ---------- Disputes ----------

export async function raiseProblem(o: Order, reason: string) {
  if (!["held", "shipped", "delivered"].includes(o.status)) throw new Error(`You can't raise a problem while the order is ${STATUS_LABEL[o.status]}.`);
  const dispute: Dispute = { reason, raised_at: now(), resolution: null, history: [] };
  const u = await patch(o, { status: "disputed", dispute });
  await insert("ho_messages", { order_id: o.id, author: "buyer", body: reason });
  await logEvent(o, o.seller_id, "disputed", "buyer", `${o.buyer_name} reported a problem with #${o.number}: "${reason.slice(0, 140)}". Funds stay held.`);
  return u;
}

export async function setResolution(o: Order, r: Omit<Resolution, "proposed_at" | "seller_accepted" | "buyer_accepted">, by: "ai" | "seller" | "buyer") {
  if (o.status !== "disputed" || !o.dispute) throw new Error("This order isn't in dispute.");
  const res: Resolution = {
    ...r,
    capture_amount: Math.min(Number(o.amount), Math.max(0, Math.round(r.capture_amount * 100) / 100)),
    proposed_at: now(),
    seller_accepted: by === "seller",
    buyer_accepted: by === "buyer",
  };
  const history = [...(o.dispute.history || []), ...(o.dispute.resolution ? [o.dispute.resolution] : [])];
  const u = await patch(o, { dispute: { ...o.dispute, resolution: res, history } });
  const label = res.outcome === "refund" ? "full refund to the buyer" : res.outcome === "release" ? "release full payment to the seller" : `seller receives ${fmt(res.capture_amount, o.currency)}, buyer gets ${fmt(Number(o.amount) - res.capture_amount, o.currency)} back`;
  await logEvent(o, o.seller_id, "resolution_proposed", by, `${by === "ai" ? "AI mediator" : by === "seller" ? "Seller" : "Buyer"} proposed for #${o.number}: ${label}.`, { resolution: res });
  return u;
}

export async function acceptResolution(o: Order, who: "seller" | "buyer", accept: boolean) {
  if (o.status !== "disputed" || !o.dispute?.resolution) throw new Error("There's no proposal to answer.");
  const res = { ...o.dispute.resolution, [`${who}_accepted`]: accept } as Resolution;
  let u = await patch(o, { dispute: { ...o.dispute, resolution: res } });
  await logEvent(o, o.seller_id, accept ? "resolution_accepted" : "resolution_rejected", who, `${who === "seller" ? "Seller" : o.buyer_name} ${accept ? "accepted" : "rejected"} the proposal on #${o.number}.`);
  if (res.seller_accepted && res.buyer_accepted) {
    const why = `Both parties agreed: ${res.reasoning.slice(0, 160)}`;
    if (res.outcome === "refund" || res.capture_amount <= 0) u = await voidAuth(u, why);
    else if (res.capture_amount >= Number(o.amount) - 0.001) u = await capture(u, Number(o.amount), why, "settled", "settled");
    else u = await capture(u, res.capture_amount, why, "partially_settled", "partially_settled");
  }
  return u;
}

// ---------- Reminders & auto-release ----------

export async function remindBuyer(o: Order, by: "seller" | "system", text?: string) {
  const msg =
    text ||
    (o.status === "created"
      ? `Hi ${o.buyer_name}, a friendly reminder that invoice #${o.number} (${fmt(o.amount, o.currency)}) is waiting. Your money is only released to the seller after you confirm delivery.`
      : `Hi ${o.buyer_name}, your order #${o.number} was shipped. Once it arrives, please confirm it's OK or report a problem. If we don't hear from you, payment releases automatically.`);
  await insert("ho_messages", { order_id: o.id, author: by === "seller" ? "seller" : "ai", body: msg });
  const u = await patch(o, { reminders_sent: (o.reminders_sent || 0) + 1, last_reminder_at: now() });
  await logEvent(o, o.seller_id, "reminder", by, `Reminder sent to ${o.buyer_name} for #${o.number}.`, { text: msg });
  return u;
}

export async function sweep(seller: Seller, onlyOrderId?: string) {
  const orders = (await select<Order>("ho_orders", { seller_id: `eq.${seller.id}`, status: "in.(shipped,held,delivered)", ...(onlyOrderId ? { id: `eq.${onlyOrderId}` } : {}) })) || [];
  const windowMs = (seller.auto_release_hours || 48) * HOUR;
  const actions: string[] = [];
  for (const o of orders) {
    try {
      if (o.status === "shipped" && o.shipped_at && !o.buyer_confirmed_at) {
        const elapsed = Date.now() - new Date(o.shipped_at).getTime();
        if (elapsed >= windowMs) {
          await patch(o, { seller_confirmed_at: o.seller_confirmed_at ?? now() });
          await capture({ ...o, seller_confirmed_at: o.seller_confirmed_at ?? now() }, Number(o.amount), `Buyer didn't respond within ${seller.auto_release_hours}h of shipping, so payment auto-released.`, "settled", "auto_released");
          actions.push(`#${o.number} auto-released`);
          continue;
        }
        const due = [0.5, 0.85].filter((f) => elapsed >= windowMs * f).length;
        if (due > (o.reminders_sent || 0)) {
          const left = Math.max(1, Math.round((windowMs - elapsed) / HOUR));
          await remindBuyer(o, "system", `Hi ${o.buyer_name}, has order #${o.number} arrived? Please confirm it's OK or report a problem. Payment releases to the seller automatically in about ${left}h if we don't hear from you.`);
          actions.push(`#${o.number} reminder`);
        }
      }
      const h = authHealth(o);
      if (h && (h.level === "soon" || h.level === "reauth")) {
        const recent = await select<OrderEvent>("ho_order_events", { order_id: `eq.${o.id}`, type: "eq.auth_warning", created_at: `gt.${new Date(Date.now() - DAY).toISOString()}`, limit: 1 });
        if (!recent.length) {
          await logEvent(o, o.seller_id, "auth_warning", "system", `#${o.number}: ${h.message}`);
          actions.push(`#${o.number} auth warning`);
        }
      }
    } catch (e) {
      actions.push(`#${o.number} error: ${(e as Error).message}`);
    }
  }
  return actions;
}

export async function simulateTimeout(seller: Seller, o: Order) {
  if (o.status !== "shipped") throw new Error("Only shipped orders can auto-release. Mark it shipped first.");
  const back = new Date(Date.now() - (seller.auto_release_hours + 1) * HOUR).toISOString();
  await patch(o, { shipped_at: back });
  await logEvent(o, o.seller_id, "demo", "system", `Demo: fast-forwarded #${o.number} past the ${seller.auto_release_hours}h buyer window.`);
  await sweep(seller, o.id);
  return getOrder(seller.id, o.id);
}

export async function simulateAuthAge(o: Order, days: number) {
  if (!o.authorized_at) throw new Error("Order isn't paid yet");
  const at = new Date(Date.now() - days * DAY);
  await patch(o, { authorized_at: at.toISOString(), honor_expires_at: new Date(at.getTime() + 3 * DAY).toISOString(), auth_expires_at: new Date(at.getTime() + 29 * DAY).toISOString() });
  await logEvent(o, o.seller_id, "demo", "system", `Demo: aged the authorization on #${o.number} to ${days} days.`);
}

// ---------- Stats ----------

export function stats(orders: Order[]) {
  const sum = (xs: Order[], f: (o: Order) => number) => xs.reduce((s, o) => s + f(o), 0);
  const held = orders.filter((o) => OPEN_STATUSES.includes(o.status));
  const settled = orders.filter((o) => ["settled", "partially_settled"].includes(o.status));
  const unpaid = orders.filter((o) => o.status === "created");
  const weekAgo = Date.now() - 7 * DAY;
  const week = orders.filter((o) => new Date(o.created_at).getTime() >= weekAgo);
  const weekSettled = settled.filter((o) => o.settled_at && new Date(o.settled_at).getTime() >= weekAgo);
  return {
    heldTotal: sum(held, (o) => Number(o.amount)),
    heldCount: held.length,
    settledTotal: sum(settled, (o) => Number(o.captured_amount ?? o.amount)),
    settledCount: settled.length,
    unpaidTotal: sum(unpaid, (o) => Number(o.amount)),
    unpaid,
    disputes: orders.filter((o) => o.status === "disputed"),
    refundedTotal: sum(orders.filter((o) => o.refunded_amount), (o) => Number(o.refunded_amount)),
    weekCount: week.length,
    weekSettledTotal: sum(weekSettled, (o) => Number(o.captured_amount ?? o.amount)),
    weekNew: week,
    currency: orders[0]?.currency || "USD",
  };
}
