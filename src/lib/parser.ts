import type { InvoiceDraft, Item } from "./types";

// Deterministic fallback parser. The AI path (lib/ai.ts) is preferred; this keeps
// the app fully working with no model available.

const SYMBOLS: Record<string, string> = { "$": "USD", "US$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "C$": "CAD", "A$": "AUD", "₦": "NGN" };
const WORDS: Record<string, string> = { dollar: "USD", dollars: "USD", usd: "USD", euro: "EUR", euros: "EUR", eur: "EUR", pound: "GBP", pounds: "GBP", gbp: "GBP", cad: "CAD", aud: "AUD", jpy: "JPY", yen: "JPY", naira: "NGN", ngn: "NGN" };
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const NUMWORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, dozen: 12 };

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function parseDate(text: string, now = new Date()): string | null {
  const t = text.toLowerCase();
  const isoM = t.match(/\b(20\d\d-\d\d-\d\d)\b/);
  if (isoM) return isoM[1];
  if (/\btoday\b/.test(t)) return iso(now);
  if (/\btomorrow\b/.test(t)) return iso(new Date(now.getTime() + 86400000));
  const inN = t.match(/\bin (\d+) (day|days|week|weeks)\b/);
  if (inN) return iso(new Date(now.getTime() + Number(inN[1]) * (inN[2].startsWith("week") ? 7 : 1) * 86400000));
  const md = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/) || null;
  const dm = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (md || dm) {
    const day = Number(md ? md[1] : dm![2]);
    const mon = MONTHS.indexOf((md ? md[2] : dm![1]).slice(0, 3));
    let d = new Date(Date.UTC(now.getUTCFullYear(), mon, day));
    if (d.getTime() < now.getTime() - 86400000) d = new Date(Date.UTC(now.getUTCFullYear() + 1, mon, day));
    return iso(d);
  }
  const wd = t.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (wd) {
    const target = DAYS.indexOf(wd[2]);
    let diff = (target - now.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    if (wd[1]) diff += diff < 7 ? 7 : 0;
    return iso(new Date(now.getTime() + diff * 86400000));
  }
  if (/\bnext week\b/.test(t)) return iso(new Date(now.getTime() + 7 * 86400000));
  return null;
}

function findMoney(text: string): { amount: number; currency: string; each: boolean; index: number; raw: string } | null {
  const re = /(US\$|C\$|A\$|[$€£¥₦])\s?(\d[\d,]*(?:\.\d{1,2})?)\s*(k\b)?|(\d[\d,]*(?:\.\d{1,2})?)\s*(k\b)?\s*(usd|eur|gbp|cad|aud|jpy|ngn|dollars?|euros?|pounds?|yen|naira)\b|\b(usd|eur|gbp|cad|aud|jpy|ngn)\s?(\d[\d,]*(?:\.\d{1,2})?)/i;
  const m = text.match(re);
  if (!m) return null;
  let amount: number, currency: string;
  if (m[1]) { amount = Number(m[2].replace(/,/g, "")) * (m[3] ? 1000 : 1); currency = SYMBOLS[m[1]]; }
  else if (m[4]) { amount = Number(m[4].replace(/,/g, "")) * (m[5] ? 1000 : 1); currency = WORDS[m[6].toLowerCase()] || m[6].toUpperCase(); }
  else { amount = Number(m[8].replace(/,/g, "")); currency = m[7].toUpperCase(); }
  const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 12).toLowerCase();
  return { amount, currency, each: /^\s*(each|apiece|per|\/ea|ea\b)/.test(after), index: m.index ?? 0, raw: m[0] };
}

function cleanItem(s: string): Item | null {
  let x = s.trim().replace(/^(for|of)\s+/i, "").replace(/[.,;]+$/, "").trim();
  if (!x) return null;
  let qty = 1;
  const q = x.match(/^(\d+)\s*(x\s+)?(.*)$/i);
  if (q) { qty = Number(q[1]); x = q[3]; }
  else {
    const w = x.match(/^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|dozen)\s+(.*)$/i);
    if (w) { qty = NUMWORDS[w[1].toLowerCase()]; x = w[2]; }
  }
  x = x.replace(/\s*(at|@)\s*$/i, "").trim();
  if (!x || x.length > 80) return null;
  return { name: x.charAt(0).toUpperCase() + x.slice(1), qty, unit_price: 0 };
}

export function parseInvoice(text: string, now = new Date()): InvoiceDraft & { warnings: string[] } {
  const warnings: string[] = [];
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
  const money = findMoney(text);
  const delivery = parseDate(text, now);

  // Buyer: words after the verb, before the email, amount or "for".
  let buyer = "";
  const noEmail = email ? text.replace(email, " ") : text;
  const bm = noEmail.match(/\b(?:invoice|bill|charge|request(?:\s+payment)?\s+from|send(?:\s+an?)?\s+invoice\s+to|new order for|order for)\s+(.+)$/i);
  if (bm) {
    const toks = bm[1].split(/\s+/);
    const out: string[] = [];
    for (const tk of toks) {
      const w = tk.replace(/[,:;()]+$/g, "");
      if (!/^[A-Za-z][A-Za-z'.-]*$/.test(w) || /^(for|at|due|by|a|an|the|to|from|with)$/i.test(w)) break;
      if (out.length && !/^[A-Z]/.test(w)) break;
      out.push(w);
      if (out.length === 3 || /[,]$/.test(tk)) break;
    }
    buyer = out.join(" ");
  }
  if (!buyer && email) buyer = email.split("@")[0];
  if (!buyer) warnings.push("Couldn't find the buyer's name.");

  // Items: text after "for", until delivery / due / by / comma clause.
  let items: Item[] = [];
  const fm = text.match(/\bfor\s+(.+?)(?=,?\s*(?:delivery|deliver|delivered|due|by|ship|shipping|arriving|to be|before|on|email|\(|$)|\.|;|$)/i);
  if (fm) {
    const chunk = fm[1].replace(money?.raw ?? "@@", " ").replace(/\b(each|apiece|per item)\b/gi, " ").replace(/\s+(at|@)\s*$/i, "").replace(/\s+(at|@)\s+/gi, " ").replace(/\s{2,}/g, " ").trim();
    items = chunk.split(/\s*(?:,|\band\b|\+|&)\s*/i).map(cleanItem).filter((i): i is Item => !!i && !/^(each|total)$/i.test(i.name));
  }
  if (!items.length && money) {
    // "3 jars of honey at $12 each" / "2 cakes $50" without "for"
    const before = text.slice(0, money.index).replace(email ?? "@@", " ");
    const im = before.match(/(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+([A-Za-z][\w\s'-]{1,60}?)\s*(?:at|@|for|,)?\s*$/i);
    if (im) { const it = cleanItem(`${im[1]} ${im[2]}`); if (it) items = [it]; }
  }
  if (!items.length) items = [{ name: "Order", qty: 1, unit_price: 0 }];

  let amount = 0;
  let currency = "USD";
  if (money) {
    currency = money.currency;
    const units = items.reduce((s, i) => s + i.qty, 0);
    if (money.each && items.length === 1) { items[0].unit_price = money.amount; amount = money.amount * items[0].qty; }
    else {
      amount = money.amount;
      if (items.length === 1) items[0].unit_price = Math.round((amount / items[0].qty) * 100) / 100;
      else items.forEach((i) => (i.unit_price = Math.round((amount / units) * 100) / 100));
      const sum = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
      if (Math.abs(sum - amount) > 0.001 && items.length) {
        // put rounding into a single-line item so totals match exactly
        if (items.length === 1 && items[0].qty > 1) items = [{ name: `${items[0].qty} × ${items[0].name}`, qty: 1, unit_price: amount }];
      }
    }
  } else warnings.push("Couldn't find an amount.");
  if (currency === "NGN") warnings.push("PayPal can't process NGN. Switch the currency to USD (or another PayPal currency) before sending.");

  const noteM = text.match(/\b(?:note|notes|message)\s*[:\-]\s*(.+)$/i);
  return {
    buyer_name: buyer ? buyer.charAt(0).toUpperCase() + buyer.slice(1) : "",
    buyer_email: email,
    items,
    amount: Math.round(amount * 100) / 100,
    currency,
    delivery_date: delivery,
    note: noteM ? noteM[1].trim() : null,
    warnings,
  };
}

// Rule-based intent router for the assistant when no model is available.
export type Intent =
  | { kind: "create_invoice"; text: string }
  | { kind: "unpaid" }
  | { kind: "held" }
  | { kind: "remind"; who: string }
  | { kind: "ship"; number: number; tracking?: string; carrier?: string }
  | { kind: "deliver"; number: number }
  | { kind: "dispute_reply"; number: number | null }
  | { kind: "summary" }
  | { kind: "order"; number: number }
  | { kind: "list" }
  | { kind: "help" };

export function routeIntent(text: string): Intent {
  const t = text.trim();
  const low = t.toLowerCase();
  const num = low.match(/(?:order|#)\s*#?(\d+)/)?.[1];
  if (/^(invoice|bill|charge|send (an )?invoice|new order|request payment)\b/.test(low)) return { kind: "create_invoice", text: t };
  if (/(who|which).*(hasn'?t|not|haven'?t|didn'?t).*(pa(id|y))|unpaid|outstanding|owe/.test(low)) return { kind: "unpaid" };
  if (/held|on hold|escrow|holding|pending money|money.*(held|waiting)/.test(low)) return { kind: "held" };
  const rem = low.match(/\b(?:remind|nudge|chase|ping)\s+(.+?)(?:\s+(?:to|about|that)\b.*)?$/);
  if (rem) return { kind: "remind", who: rem[1].replace(/^(the buyer of |buyer )/, "").trim() };
  if (/ship|sent out|dispatched|posted/.test(low) && num) {
    const tr = t.match(/(?:tracking|track(?:ing)? (?:no|number|#)?)\s*[:#]?\s*([A-Z0-9-]{6,})/i)?.[1] || t.match(/\b([A-Z]{2}\d{9}[A-Z]{2}|1Z[0-9A-Z]{16}|\d{12,22})\b/)?.[1];
    const carrier = t.match(/\b(dhl|ups|fedex|usps|gig|royal mail|dpd|courier|dispatch rider|bolt|uber)\b/i)?.[1];
    return { kind: "ship", number: Number(num), tracking: tr, carrier };
  }
  if (/deliver(ed)?|handed over|dropped off/.test(low) && num) return { kind: "deliver", number: Number(num) };
  if (/dispute|complain|problem|reply to/.test(low)) return { kind: "dispute_reply", number: num ? Number(num) : null };
  if (/summar|this week|how.*(business|doing)|report|recap/.test(low)) return { kind: "summary" };
  if (num) return { kind: "order", number: Number(num) };
  if (/orders|list|show all|recent/.test(low)) return { kind: "list" };
  return { kind: "help" };
}
