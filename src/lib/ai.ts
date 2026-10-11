import { generateText, Output, tool, isStepCount } from "ai";
import { z } from "zod";
import { aiConfigured, env } from "./env";
import { parseInvoice } from "./parser";
import { fmt, stats, STATUS_LABEL } from "./orders";
import type { Evidence, InvoiceDraft, Message, Order, Resolution } from "./types";

// All model calls go through Vercel AI Gateway (plain "provider/model" string,
// OIDC auth on Vercel). Every function has a deterministic fallback.

export const model = () => env.aiModel;

export async function aiParseInvoice(text: string): Promise<InvoiceDraft & { warnings: string[]; source: "ai" | "rules" }> {
  const fallback = { ...parseInvoice(text), source: "rules" as const };
  if (!aiConfigured()) return fallback;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { output } = await generateText({
      model: model(),
      output: Output.object({
        schema: z.object({
          buyer_name: z.string(),
          buyer_email: z.string().nullable(),
          items: z.array(z.object({ name: z.string(), qty: z.number(), unit_price: z.number() })),
          amount: z.number(),
          currency: z.string().describe("ISO 4217, e.g. USD"),
          delivery_date: z.string().nullable().describe("YYYY-MM-DD"),
          note: z.string().nullable(),
          warnings: z.array(z.string()),
        }),
      }),
      system: `You turn a small seller's message into an invoice. Today is ${today} (${new Date().toLocaleDateString("en-US", { weekday: "long" })}). Resolve relative dates. Item unit_price * qty must add up to amount. Default currency USD. If a value is missing, leave it empty and add a short warning. PayPal does not support NGN; if NGN is used, keep it and warn.`,
      prompt: text,
    });
    if (!output || !(output.amount > 0) || !output.buyer_name) return fallback;
    return { ...output, currency: output.currency.toUpperCase(), source: "ai" };
  } catch {
    return fallback;
  }
}

function resolutionRules(o: Order, messages: Message[], evidence: Evidence[]): Omit<Resolution, "proposed_at" | "seller_accepted" | "buyer_accepted"> {
  const txt = [o.dispute?.reason, ...messages.filter((m) => m.author === "buyer").map((m) => m.body)].join(" ").toLowerCase();
  const sellerProof = evidence.some((e) => e.author === "seller" && (e.kind === "photo" || e.kind === "tracking")) || !!o.tracking;
  const amt = Number(o.amount);
  if (/never (arrived|came|received)|not (arrived|received|delivered)|didn'?t (arrive|get|receive)|missing order|nothing came/.test(txt)) {
    return sellerProof
      ? { outcome: "partial", capture_amount: Math.round(amt * 0.5 * 100) / 100, reasoning: "The buyer says it didn't arrive, but the seller has shipping proof. Splitting the amount is fair until the parcel is traced.", source: "rules" }
      : { outcome: "refund", capture_amount: 0, reasoning: "The buyer says it never arrived and there's no tracking or delivery photo. Refund the buyer.", source: "rules" };
  }
  const m = txt.match(/(\d+)\s*(?:of|out of)\s*(?:the\s*)?(\d+)/);
  if (m && Number(m[2]) > 0 && Number(m[1]) < Number(m[2])) {
    const ok = Number(m[1]) / Number(m[2]);
    return { outcome: "partial", capture_amount: Math.round(amt * ok * 100) / 100, reasoning: `Only part of the order was fine (${m[1]} of ${m[2]}). The seller is paid for what arrived in good shape.`, source: "rules" };
  }
  if (/damag|broken|crushed|melted|spoil|wrong|torn|stain|defect|cracked|leak/.test(txt))
    return { outcome: "partial", capture_amount: Math.round(amt * 0.5 * 100) / 100, reasoning: "The item arrived but with a problem. A 50% partial refund covers the damage without the seller losing the whole sale.", source: "rules" };
  if (/late|delay/.test(txt))
    return { outcome: "partial", capture_amount: Math.round(amt * 0.85 * 100) / 100, reasoning: "The order arrived late but complete. A small 15% refund acknowledges the delay.", source: "rules" };
  return { outcome: "release", capture_amount: amt, reasoning: "The complaint doesn't describe a missing or damaged item. Release payment to the seller.", source: "rules" };
}

function dataUrlToFile(d: string) {
  const m = d.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!m) return null;
  return { type: "file" as const, mediaType: m[1], data: Buffer.from(m[2], "base64") };
}

export async function suggestResolution(o: Order, messages: Message[], evidence: Evidence[]) {
  const fallback = resolutionRules(o, messages, evidence);
  if (!aiConfigured()) return fallback;
  try {
    const transcript = messages.map((m) => `[${m.author}] ${m.body}`).join("\n");
    const ev = evidence.map((e) => `[${e.author} ${e.kind}] ${e.caption || ""}`).join("\n");
    const images = evidence.filter((e) => e.image_data).slice(-3).map((e) => dataUrlToFile(e.image_data!)).filter(Boolean) as { type: "file"; mediaType: string; data: Buffer }[];
    const { output } = await generateText({
      model: model(),
      output: Output.object({
        schema: z.object({
          outcome: z.enum(["release", "partial", "refund"]),
          capture_amount: z.number().describe("How much the SELLER receives. 0 for refund, full amount for release."),
          reasoning: z.string().describe("2-3 plain sentences both sides can read."),
        }),
      }),
      system: "You are a neutral mediator for a small online sale where the buyer's money is held until delivery. Read both sides and any photos. Suggest one fair outcome: release (seller gets everything), partial (seller gets part), or refund (buyer gets everything back). Be fair to both, cite the evidence, and keep it short and kind.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Order #${o.number}: ${o.items.map((i) => `${i.qty} x ${i.name}`).join(", ")} for ${fmt(o.amount, o.currency)}. Shipped: ${o.shipped_at ? "yes" : "no"}${o.carrier ? ` via ${o.carrier}` : ""}${o.tracking ? `, tracking ${o.tracking}` : ""}.\nBuyer's complaint: ${o.dispute?.reason}\n\nConversation:\n${transcript || "(none)"}\n\nEvidence:\n${ev || "(none)"}` },
            ...images,
          ],
        },
      ],
    });
    if (!output) return fallback;
    return { ...output, capture_amount: Math.min(Number(o.amount), Math.max(0, output.outcome === "refund" ? 0 : output.outcome === "release" ? Number(o.amount) : output.capture_amount)), source: "ai" as const };
  } catch {
    return fallback;
  }
}

export async function draftDisputeReply(o: Order, messages: Message[]) {
  const fallback = `Hi ${o.buyer_name}, I'm sorry about the trouble with order #${o.number}. ${o.tracking ? `It was sent${o.carrier ? ` with ${o.carrier}` : ""} (tracking ${o.tracking}). ` : ""}Your money is still held safely, so nothing is lost. Could you share a photo of what you received? I'll make it right, either with a replacement or a fair refund.`;
  if (!aiConfigured()) return { text: fallback, source: "rules" as const };
  try {
    const { text } = await generateText({
      model: model(),
      system: "Write a short, warm, professional reply from a small seller to a buyer who raised a problem. Max 90 words. No placeholders. Don't promise anything the seller didn't offer; suggest a next step.",
      prompt: `Order #${o.number}: ${o.items.map((i) => `${i.qty} x ${i.name}`).join(", ")} (${fmt(o.amount, o.currency)}). Shipped: ${o.shipped_at ? "yes" : "no"}${o.tracking ? `, tracking ${o.tracking}` : ""}.\nComplaint: ${o.dispute?.reason || "(none)"}\nThread:\n${messages.map((m) => `[${m.author}] ${m.body}`).join("\n")}`,
    });
    return { text: text.trim() || fallback, source: "ai" as const };
  } catch {
    return { text: fallback, source: "rules" as const };
  }
}

export function summaryFacts(orders: Order[]) {
  const s = stats(orders);
  const c = s.currency;
  const best = new Map<string, number>();
  for (const o of s.weekNew) for (const i of o.items) best.set(i.name, (best.get(i.name) || 0) + i.qty);
  const top = [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return {
    s,
    lines: [
      `New orders this week: ${s.weekCount}.`,
      `Released to you this week: ${fmt(s.weekSettledTotal, c)}.`,
      `Held right now (paid, waiting on delivery): ${fmt(s.heldTotal, c)} across ${s.heldCount} order(s).`,
      `Unpaid invoices: ${s.unpaid.length} (${fmt(s.unpaidTotal, c)})${s.unpaid.length ? `: ${s.unpaid.slice(0, 5).map((o) => `${o.buyer_name} #${o.number}`).join(", ")}` : ""}.`,
      `Open disputes: ${s.disputes.length}${s.disputes.length ? ` (${s.disputes.map((o) => `#${o.number}`).join(", ")})` : ""}.`,
      top.length ? `Top items: ${top.map(([n, q]) => `${n} (${q})`).join(", ")}.` : "",
    ].filter(Boolean),
  };
}

export async function weeklySummary(orders: Order[]) {
  const { lines } = summaryFacts(orders);
  const fallback = lines.join("\n");
  if (!aiConfigured()) return { text: fallback, source: "rules" as const };
  try {
    const { text } = await generateText({
      model: model(),
      system: "You're a friendly business coach for a small seller. Using ONLY these facts, write a short weekly summary: 1 sentence on how the week went, then 2-3 bullet points of what to do next (who to chase, what to ship, disputes to answer). Under 110 words. Plain text, bullets with '- '.",
      prompt: lines.join("\n"),
    });
    return { text: text.trim() || fallback, source: "ai" as const };
  } catch {
    return { text: fallback, source: "rules" as const };
  }
}

export { tool, isStepCount, generateText, z, STATUS_LABEL };
