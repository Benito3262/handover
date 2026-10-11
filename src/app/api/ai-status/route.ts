import { generateText } from "ai";
import { aiConfigured, env } from "@/lib/env";
import { withSeller } from "@/lib/http";

// Seller-only diagnostic: makes one tiny model call through AI Gateway.
export async function GET() {
  return withSeller(async () => {
    if (!aiConfigured()) return { ok: false, reason: "No AI Gateway credentials (rules fallback active)" };
    try {
      const r = await generateText({ model: env.aiModel, prompt: "Reply with the word OK." , maxOutputTokens: 5 });
      return { ok: true, model: env.aiModel, text: r.text, oidc: Boolean(process.env.VERCEL_OIDC_TOKEN) };
    } catch (e) {
      return { ok: false, model: env.aiModel, error: (e as Error).message.slice(0, 400), oidc: Boolean(process.env.VERCEL_OIDC_TOKEN) };
    }
  });
}
