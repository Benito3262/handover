import type { Order, RiskFlag } from "./types";

// Simple, explainable rules. Run on create and after payment.
export function assessRisk(o: Pick<Order, "amount" | "buyer_email" | "buyer_name" | "items" | "currency">, history: Order[]): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const settled = history.filter((h) => ["settled", "partially_settled", "delivered", "shipped", "held"].includes(h.status));
  const avg = settled.length ? settled.reduce((s, h) => s + Number(h.amount), 0) / settled.length : 0;

  if (o.amount >= 1000) flags.push({ level: "high", code: "very_high_amount", message: `Large order (${o.amount} ${o.currency}). Confirm the buyer before shipping.` });
  else if (avg > 0 && o.amount > avg * 4 && o.amount > 100)
    flags.push({ level: "medium", code: "above_usual", message: `About ${Math.round(o.amount / avg)}x your usual order size.` });

  const email = (o.buyer_email || "").toLowerCase();
  const sameBuyer = history.filter((h) => (email && (h.buyer_email || "").toLowerCase() === email) || h.buyer_name.toLowerCase() === o.buyer_name.toLowerCase());
  if (sameBuyer.length === 0) flags.push({ level: "low", code: "new_buyer", message: "First order from this buyer." });
  if (sameBuyer.some((h) => h.status === "disputed" || h.status === "refunded"))
    flags.push({ level: "medium", code: "past_dispute", message: "This buyer has a past dispute or refund with you." });

  if (email) {
    const local = email.split("@")[0] || "";
    const first = o.buyer_name.toLowerCase().split(/\s+/)[0] || "";
    if (first.length >= 3 && local.length >= 3 && !local.includes(first.slice(0, 3)) && /\d{4,}/.test(local))
      flags.push({ level: "low", code: "name_email_mismatch", message: "Buyer name doesn't match the email address." });
    if (/(mailinator|tempmail|10minutemail|guerrillamail|yopmail)\./.test(email))
      flags.push({ level: "high", code: "disposable_email", message: "Disposable email address." });
  }

  const itemTotal = o.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  if (o.items.length && Math.abs(itemTotal - o.amount) > 0.01)
    flags.push({ level: "low", code: "total_mismatch", message: `Item prices add up to ${itemTotal.toFixed(2)}, invoice says ${o.amount.toFixed(2)}.` });

  const recent = history.filter((h) => Date.now() - new Date(h.created_at).getTime() < 3600_000 && h.buyer_name.toLowerCase() === o.buyer_name.toLowerCase());
  if (recent.length >= 3) flags.push({ level: "medium", code: "velocity", message: "Several orders for this buyer in the last hour." });
  return flags;
}

export const riskLevel = (flags: RiskFlag[] | null | undefined) =>
  !flags?.length ? "none" : flags.some((f) => f.level === "high") ? "high" : flags.some((f) => f.level === "medium") ? "medium" : "low";
