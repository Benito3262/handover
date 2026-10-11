import { generateText, tool, isStepCount, type ModelMessage } from "ai";
import { z } from "zod";
import { aiConfigured } from "./env";
import { aiOpts, aiParseInvoice, draftDisputeReply, model, summaryFacts, weeklySummary } from "./ai";
import { routeIntent } from "./parser";
import { createOrder, fmt, getOrderByNumber, markShipped, orderThread, remindBuyer, sellerConfirm, sellerOrders, stats, STATUS_LABEL, OPEN_STATUSES } from "./orders";
import type { InvoiceDraft, Order, Seller } from "./types";

export interface AgentAction {
  kind: "order_link" | "buyer_link" | "draft";
  label: string;
  href?: string;
  text?: string;
}

const line = (o: Order) => `#${o.number} ${o.buyer_name}: ${fmt(o.amount, o.currency)}, ${STATUS_LABEL[o.status]}`;

// Shared operations used by both the AI tools and the rules fallback.
function ops(seller: Seller, base: string, actions: AgentAction[]) {
  const byNum = async (n: number) => {
    const o = await getOrderByNumber(seller.id, n);
    if (!o) throw new Error(`No order #${n}.`);
    return o;
  };
  const findBuyer = async (who: string) => {
    const orders = await sellerOrders(seller.id);
    const n = who.match(/\d+/)?.[0];
    if (n) return orders.find((o) => o.number === Number(n)) || null;
    const w = who.toLowerCase();
    return orders.find((o) => ["created", "shipped", "held"].includes(o.status) && o.buyer_name.toLowerCase().includes(w)) || orders.find((o) => o.buyer_name.toLowerCase().includes(w)) || null;
  };
  return {
    async createInvoice(d: InvoiceDraft) {
      const o = await createOrder(seller, d);
      actions.push({ kind: "order_link", label: `Open #${o.number}`, href: `/app/orders/${o.id}` });
      actions.push({ kind: "buyer_link", label: "Buyer payment link", href: `${base}/o/${o.public_token}` });
      return { created: line(o), buyer_link: `${base}/o/${o.public_token}`, risk: o.risk?.map((r) => r.message) ?? [] };
    },
    async list(status?: string) {
      const orders = await sellerOrders(seller.id);
      const f = status ? orders.filter((o) => o.status === status) : orders;
      return f.slice(0, 15).map(line);
    },
    async unpaid() {
      const s = stats(await sellerOrders(seller.id));
      return { count: s.unpaid.length, total: fmt(s.unpaidTotal, s.currency), orders: s.unpaid.map(line) };
    },
    async held() {
      const orders = await sellerOrders(seller.id);
      const s = stats(orders);
      return { total_held: fmt(s.heldTotal, s.currency), orders: orders.filter((o) => OPEN_STATUSES.includes(o.status)).map(line), settled_all_time: fmt(s.settledTotal, s.currency) };
    },
    async remind(who: string) {
      const o = await findBuyer(who);
      if (!o) return { error: `Couldn't find an open order for "${who}".` };
      if (!["created", "shipped", "held"].includes(o.status)) return { error: `#${o.number} is ${STATUS_LABEL[o.status]}, no reminder needed.` };
      await remindBuyer(o, "seller");
      actions.push({ kind: "order_link", label: `Open #${o.number}`, href: `/app/orders/${o.id}` });
      return { reminded: line(o), note: "Reminder posted on the buyer's order page and logged in notifications." };
    },
    async ship(n: number, carrier?: string, tracking?: string) {
      const o = await markShipped(await byNum(n), { carrier, tracking });
      actions.push({ kind: "order_link", label: `Open #${o.number}`, href: `/app/orders/${o.id}` });
      return { shipped: line(o), auto_release_hours: seller.auto_release_hours };
    },
    async deliver(n: number) {
      const o = await sellerConfirm(await byNum(n));
      return { result: line(o), note: o.status === "settled" ? "Both sides confirmed; payment captured." : "Waiting on the buyer's confirmation." };
    },
    async details(n: number) {
      const o = await byNum(n);
      const t = await orderThread(o.id);
      actions.push({ kind: "order_link", label: `Open #${o.number}`, href: `/app/orders/${o.id}` });
      return { order: line(o), items: o.items, delivery_date: o.delivery_date, buyer_email: o.buyer_email, tracking: o.tracking, dispute: o.dispute?.reason ?? null, risk: o.risk?.map((r) => r.message), last_events: t.events.slice(-5).map((e) => e.message) };
    },
    async disputeReply(n: number | null) {
      let o: Order | null = null;
      if (n) o = await byNum(n);
      else o = (await sellerOrders(seller.id)).find((x) => x.status === "disputed") || null;
      if (!o) return { error: "No open dispute found." };
      const t = await orderThread(o.id);
      const d = await draftDisputeReply(o, t.messages);
      actions.push({ kind: "draft", label: `Reply draft for #${o.number}`, text: d.text, href: `/app/orders/${o.id}` });
      return { order: line(o), complaint: o.dispute?.reason, draft: d.text };
    },
    async summary() {
      const s = await weeklySummary(await sellerOrders(seller.id));
      return { summary: s.text };
    },
  };
}

export async function runAssistant(seller: Seller, history: { role: "user" | "assistant"; content: string }[], base: string) {
  const actions: AgentAction[] = [];
  const op = ops(seller, base, actions);
  const last = history[history.length - 1]?.content || "";

  if (aiConfigured()) {
    try {
      const today = new Date();
      const result = await generateText({
        ...aiOpts(),
        model: model(),
        system: `You are Handover's assistant for ${seller.name}, a small seller. Buyers' money is held by PayPal (authorized) and only released when both sides confirm delivery. Use tools to act on real data; never invent orders or numbers. Today is ${today.toISOString().slice(0, 10)} (${today.toLocaleDateString("en-US", { weekday: "long" })}). Reply in short, friendly plain text (no markdown tables). After creating an invoice, give the buyer link. Default currency USD.`,
        messages: history.slice(-12) as ModelMessage[],
        stopWhen: isStepCount(6),
        tools: {
          create_invoice: tool({
            description: "Create an invoice/order and a buyer payment link.",
            inputSchema: z.object({
              buyer_name: z.string(),
              buyer_email: z.string().nullable(),
              items: z.array(z.object({ name: z.string(), qty: z.number(), unit_price: z.number() })),
              amount: z.number(),
              currency: z.string().describe("ISO code, default USD"),
              delivery_date: z.string().nullable().describe("YYYY-MM-DD"),
              note: z.string().nullable(),
            }),
            execute: async (d) => op.createInvoice({ ...d, currency: d.currency || "USD" }),
          }),
          list_orders: tool({ description: "List recent orders, optionally by status (created, held, shipped, delivered, disputed, settled, partially_settled, refunded, cancelled).", inputSchema: z.object({ status: z.string().nullable().describe("Leave null for all orders.") }), execute: async ({ status }) => { const known = ["created", "held", "shipped", "delivered", "disputed", "settled", "partially_settled", "refunded", "cancelled"]; const s = status?.toLowerCase().trim(); return op.list(s && known.includes(s) ? s : undefined); } }),
          unpaid_invoices: tool({ description: "Who hasn't paid yet.", inputSchema: z.object({}), execute: async () => op.unpaid() }),
          held_money: tool({ description: "Money currently held (paid but not yet released) and totals.", inputSchema: z.object({}), execute: async () => op.held() }),
          remind_buyer: tool({ description: "Send a reminder to a buyer, by name or order number.", inputSchema: z.object({ who: z.string() }), execute: async ({ who }) => op.remind(who) }),
          mark_shipped: tool({ description: "Mark an order shipped.", inputSchema: z.object({ order_number: z.number(), carrier: z.string().nullable(), tracking: z.string().nullable() }), execute: async (a) => op.ship(a.order_number, a.carrier ?? undefined, a.tracking ?? undefined) }),
          confirm_delivered: tool({ description: "Seller confirms the order was delivered (payment captures once buyer also confirms).", inputSchema: z.object({ order_number: z.number() }), execute: async (a) => op.deliver(a.order_number) }),
          order_details: tool({ description: "Details and recent activity for one order.", inputSchema: z.object({ order_number: z.number() }), execute: async (a) => op.details(a.order_number) }),
          draft_dispute_reply: tool({ description: "Draft a reply to a buyer's complaint. Omit number to use the latest open dispute.", inputSchema: z.object({ order_number: z.number().nullable() }), execute: async (a) => op.disputeReply(a.order_number) }),
          weekly_summary: tool({ description: "Summarize this week's business.", inputSchema: z.object({}), execute: async () => op.summary() }),
        },
      });
      const text = result.text?.trim();
      if (text) return { reply: text, actions, source: "ai" as const };
    } catch (e) {
      console.error("assistant AI failed, using rules", (e as Error).message);
    }
  }

  // Rules fallback
  const it = routeIntent(last);
  try {
    switch (it.kind) {
      case "create_invoice": {
        const d = await aiParseInvoice(it.text);
        if (!d.buyer_name || !(d.amount > 0)) return { reply: `I need a buyer and an amount. Try: "Invoice Ada $50 for 2 cakes, delivery Friday". ${d.warnings.join(" ")}`, actions, source: "rules" as const };
        const r = await op.createInvoice(d);
        return { reply: `Done. ${r.created}.${d.delivery_date ? ` Delivery ${d.delivery_date}.` : ""}${d.warnings.length ? ` Note: ${d.warnings.join(" ")}` : ""}\nSend this link to the buyer: ${r.buyer_link}`, actions, source: "rules" as const };
      }
      case "unpaid": {
        const r = await op.unpaid();
        return { reply: r.count ? `${r.count} unpaid (${r.total}):\n${r.orders.join("\n")}` : "Everyone has paid. Nice.", actions, source: "rules" as const };
      }
      case "held": {
        const r = await op.held();
        return { reply: `Held right now: ${r.total_held}\n${r.orders.join("\n") || "(nothing held)"}\nReleased to you all time: ${r.settled_all_time}`, actions, source: "rules" as const };
      }
      case "remind": {
        const r = await op.remind(it.who);
        return { reply: "error" in r ? r.error! : `Reminder sent: ${r.reminded}.`, actions, source: "rules" as const };
      }
      case "ship": {
        const r = await op.ship(it.number, it.carrier, it.tracking);
        return { reply: `Marked shipped: ${r.shipped}. If the buyer stays silent, payment auto-releases after ${r.auto_release_hours}h.`, actions, source: "rules" as const };
      }
      case "deliver": {
        const r = await op.deliver(it.number);
        return { reply: `${r.result}. ${r.note}`, actions, source: "rules" as const };
      }
      case "dispute_reply": {
        const r = await op.disputeReply(it.number);
        return { reply: "error" in r ? r.error! : `Complaint on ${r.order}: "${r.complaint}"\n\nSuggested reply:\n${r.draft}`, actions, source: "rules" as const };
      }
      case "summary": {
        const orders = await sellerOrders(seller.id);
        return { reply: summaryFacts(orders).lines.join("\n"), actions, source: "rules" as const };
      }
      case "order": {
        const r = await op.details(it.number);
        return { reply: `${r.order}\nItems: ${r.items.map((i) => `${i.qty} × ${i.name}`).join(", ")}\n${r.last_events.join("\n")}`, actions, source: "rules" as const };
      }
      case "list": {
        const r = await op.list();
        return { reply: r.join("\n") || "No orders yet.", actions, source: "rules" as const };
      }
      default:
        return {
          reply: 'I can create invoices ("Invoice Ada $50 for 2 cakes, delivery Friday"), tell you who hasn\'t paid, show held money, remind a buyer ("remind Ada"), mark orders shipped ("mark order 3 shipped, DHL 123456789"), draft a dispute reply, or summarize your week.',
          actions,
          source: "rules" as const,
        };
    }
  } catch (e) {
    return { reply: (e as Error).message, actions, source: "rules" as const };
  }
}
