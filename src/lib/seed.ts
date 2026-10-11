import { insert, one, remove, update } from "./db";
import { hashPasscode, token } from "./auth";
import { assessRisk } from "./risk";
import type { Order, Seller } from "./types";

export const DEMO_SLUG = "demo";
export const DEMO_PASSCODE = "demo1234";

const H = 3600_000;
const ago = (h: number) => new Date(Date.now() - h * H).toISOString();

export async function getOrCreateDemoSeller(): Promise<Seller> {
  const s = await one<Seller>("ho_sellers", { slug: `eq.${DEMO_SLUG}` });
  if (s) return s;
  const [created] = await insert<Seller>("ho_sellers", {
    slug: DEMO_SLUG,
    name: "Kemi's Cakes & Crafts (demo)",
    email: "demo@handover.app",
    passcode_hash: hashPasscode(DEMO_PASSCODE),
    auto_release_hours: 48,
    is_demo: true,
  });
  await seedDemo(created);
  return created;
}

type S = Partial<Order> & { buyer_name: string; amount: number; items: Order["items"]; status: Order["status"]; ageH: number };

export async function seedDemo(seller: Seller) {
  await remove("ho_orders", { seller_id: `eq.${seller.id}` });
  await remove("ho_order_events", { seller_id: `eq.${seller.id}` });
  await update("ho_sellers", { id: `eq.${seller.id}` }, { auto_release_hours: 48 });
  const auth = (h: number) => ({ simulated: true, authorization_id: `SIM-AUTH-${token(6)}`, authorized_at: ago(h), honor_expires_at: ago(h - 72), auth_expires_at: ago(h - 29 * 24) });
  const rows: S[] = [
    { buyer_name: "Grace Okafor", buyer_email: "grace.okafor@example.com", items: [{ name: "Cupcakes", qty: 12, unit_price: 3 }], amount: 36, status: "settled", ageH: 140, ...auth(139), shipped_at: ago(120), carrier: "Dispatch rider", buyer_confirmed_at: ago(100), seller_confirmed_at: ago(118), settled_at: ago(100), captured_amount: 36, capture_id: "SIM-CAP-1" },
    { buyer_name: "Nneka Eze", buyer_email: "nneka@example.com", items: [{ name: "Beaded bracelet", qty: 4, unit_price: 15 }], amount: 60, status: "partially_settled", ageH: 160, ...auth(159), shipped_at: ago(150), captured_amount: 45, refunded_amount: 15, settled_at: ago(110), capture_id: "SIM-CAP-2", dispute: { reason: "One of the 4 bracelets arrived broken.", raised_at: ago(130), resolution: { outcome: "partial", capture_amount: 45, reasoning: "3 of 4 bracelets were fine. The seller is paid for those, the buyer gets $15 back for the broken one.", source: "rules", proposed_at: ago(129), seller_accepted: true, buyer_accepted: true } } },
    { buyer_name: "Lola Adeyemi", buyer_email: "lola.a@example.com", items: [{ name: "Throw pillow", qty: 2, unit_price: 30 }], amount: 60, status: "refunded", ageH: 120, ...auth(119), refunded_amount: 60, captured_amount: 0, settled_at: ago(90) },
    { buyer_name: "Ada Nwosu", buyer_email: "ada.nwosu@example.com", items: [{ name: "Chocolate cake", qty: 2, unit_price: 25 }], amount: 50, status: "created", ageH: 50, delivery_date: new Date(Date.now() + 3 * 24 * H).toISOString().slice(0, 10) },
    { buyer_name: "Tunde Bello", buyer_email: "tunde.bello@example.com", items: [{ name: "Hand-painted sneakers", qty: 1, unit_price: 120 }], amount: 120, status: "held", ageH: 20, ...auth(19) },
    { buyer_name: "Paul Mensah", buyer_email: "paul.m@example.com", items: [{ name: "Leather journal", qty: 1, unit_price: 45 }], amount: 45, status: "held", ageH: 86, ...auth(85), note: "Waiting for the custom engraving." },
    { buyer_name: "Chioma Obi", buyer_email: "chioma.obi@example.com", items: [{ name: "Tote bag", qty: 3, unit_price: 25 }], amount: 75, status: "shipped", ageH: 40, ...auth(39), shipped_at: ago(30), carrier: "DHL", tracking: "JD014600006281234567", reminders_sent: 1, last_reminder_at: ago(6) },
    { buyer_name: "Sam Carter", buyer_email: "sam.carter@example.com", items: [{ name: "Custom mug set", qty: 1, unit_price: 40 }], amount: 40, status: "delivered", ageH: 60, ...auth(59), shipped_at: ago(40), buyer_confirmed_at: ago(2) },
    { buyer_name: "Mike Johnson", buyer_email: "mike.j@example.com", items: [{ name: "Birthday cake (2 tier)", qty: 1, unit_price: 85 }], amount: 85, status: "disputed", ageH: 30, ...auth(29), shipped_at: ago(10), carrier: "Dispatch rider", dispute: { reason: "The cake arrived crushed on one side and the top tier was leaning. We still served it but it looked bad at the party.", raised_at: ago(4), resolution: null, history: [] } },
    { buyer_name: "Victor", buyer_email: "vic9928371@mailinator.com", items: [{ name: "Wedding cake (5 tier)", qty: 1, unit_price: 1450 }], amount: 1450, status: "created", ageH: 1 },
  ];
  const created: Order[] = [];
  let n = 0;
  for (const r of rows) {
    n++;
    const { ageH, ...rest } = r;
    const risk = assessRisk({ amount: r.amount, buyer_email: r.buyer_email ?? null, buyer_name: r.buyer_name, items: r.items, currency: "USD" }, created);
    const [o] = await insert<Order>("ho_orders", { seller_id: seller.id, number: n, public_token: token(9), currency: "USD", risk, created_at: ago(ageH), updated_at: ago(Math.max(0, ageH - 1)), ...rest });
    created.push(o);
  }
  const ev = (o: Order, type: string, actor: string, message: string, h: number) => ({ order_id: o.id, seller_id: seller.id, type, actor, message, created_at: ago(h), read: h > 24 });
  const [g, nk, l, a, t, p, c, s, m, v] = created;
  await insert("ho_order_events", [
    ev(g, "created", "seller", "Invoice #1 created for Grace Okafor: $36.00", 140), ev(g, "paid", "buyer", "Grace Okafor paid $36.00 for #1. Funds are held until delivery is confirmed.", 139), ev(g, "shipped", "seller", "#1 marked shipped (Dispatch rider).", 120), ev(g, "settled", "system", "$36.00 released to the seller for #1. Both sides confirmed delivery.", 100),
    ev(nk, "created", "seller", "Invoice #2 created for Nneka Eze: $60.00", 160), ev(nk, "paid", "buyer", "Nneka Eze paid $60.00 for #2.", 159), ev(nk, "disputed", "buyer", 'Nneka Eze reported a problem with #2: "One of the 4 bracelets arrived broken."', 130), ev(nk, "partially_settled", "system", "$45.00 released to the seller for #2. Both parties agreed on a partial refund.", 110),
    ev(l, "created", "seller", "Invoice #3 created for Lola Adeyemi: $60.00", 120), ev(l, "paid", "buyer", "Lola Adeyemi paid $60.00 for #3.", 119), ev(l, "refunded", "system", "Hold on #3 released back to Lola Adeyemi. Seller cancelled the order (out of stock).", 90),
    ev(a, "created", "seller", "Invoice #4 created for Ada Nwosu: $50.00", 50), ev(a, "reminder", "seller", "Reminder sent to Ada Nwosu for #4.", 20),
    ev(t, "created", "seller", "Invoice #5 created for Tunde Bello: $120.00", 20), ev(t, "paid", "buyer", "Tunde Bello paid $120.00 for #5. Funds are held until delivery is confirmed.", 19),
    ev(p, "created", "seller", "Invoice #6 created for Paul Mensah: $45.00", 86), ev(p, "paid", "buyer", "Paul Mensah paid $45.00 for #6.", 85), ev(p, "auth_warning", "system", "#6: 3-day honor period is over. Reauthorize to keep the funds guaranteed.", 12),
    ev(c, "created", "seller", "Invoice #7 created for Chioma Obi: $75.00", 40), ev(c, "paid", "buyer", "Chioma Obi paid $75.00 for #7.", 39), ev(c, "shipped", "seller", "#7 marked shipped (DHL, tracking JD014600006281234567).", 30), ev(c, "reminder", "system", "Reminder sent to Chioma Obi for #7.", 6),
    ev(s, "created", "seller", "Invoice #8 created for Sam Carter: $40.00", 60), ev(s, "paid", "buyer", "Sam Carter paid $40.00 for #8.", 59), ev(s, "shipped", "seller", "#8 marked shipped.", 40), ev(s, "buyer_confirmed", "buyer", "Sam Carter confirmed #8 arrived safely.", 2),
    ev(m, "created", "seller", "Invoice #9 created for Mike Johnson: $85.00", 30), ev(m, "paid", "buyer", "Mike Johnson paid $85.00 for #9.", 29), ev(m, "shipped", "seller", "#9 marked shipped (Dispatch rider).", 10), ev(m, "disputed", "buyer", 'Mike Johnson reported a problem with #9: "The cake arrived crushed on one side..." Funds stay held.', 4),
    ev(v, "created", "seller", "Invoice #10 created for Victor: $1,450.00", 1), ev(v, "risk", "system", "Risk check on #10: Large order ($1,450). Disposable email address. Confirm the buyer before shipping.", 1),
  ]);
  await insert("ho_messages", [
    { order_id: m.id, author: "seller", body: "Sent with the rider at 2pm, it was boxed and upright when it left.", created_at: ago(9) },
    { order_id: m.id, author: "buyer", body: "The cake arrived crushed on one side and the top tier was leaning. We still served it but it looked bad at the party.", created_at: ago(4) },
    { order_id: c.id, author: "ai", body: "Hi Chioma, has order #7 arrived? Please confirm it's OK or report a problem. Payment releases to the seller automatically in about 18h if we don't hear from you.", created_at: ago(6) },
    { order_id: a.id, author: "seller", body: "Hi Ada, a friendly reminder that invoice #4 ($50.00) is waiting. Your money is only released to me after you confirm delivery.", created_at: ago(20) },
  ]);
  await insert("ho_evidence", [
    { order_id: m.id, author: "seller", kind: "note", caption: "Packed in a 12-inch box with dowels in the top tier.", created_at: ago(10) },
    { order_id: m.id, author: "buyer", kind: "note", caption: "Left side crushed, top tier leaning about 20 degrees.", created_at: ago(4) },
    { order_id: c.id, author: "seller", kind: "tracking", caption: "DHL JD014600006281234567", created_at: ago(30) },
  ]);
  return created;
}
