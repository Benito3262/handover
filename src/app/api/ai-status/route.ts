import { generateText } from "ai";
import { aiConfigured, aiLabel, env } from "@/lib/env";
import { model as appModel } from "@/lib/ai";
import { withSeller } from "@/lib/http";

// Seller-only diagnostic: makes one tiny model call through AI Gateway.
export async function GET(req: Request) {
  const m = new URL(req.url).searchParams.get("model");
  const model = m && /^[a-z0-9-]+\/[a-z0-9.\-]+$/.test(m) ? m : appModel();
  const label = m || aiLabel();
  return withSeller(async () => {
    if (!aiConfigured()) return { ok: false, reason: "No AI key set (rules fallback active). Set AI_API_KEY (free Gemini key) or enable AI Gateway." };
    try {
      const r = await generateText({ model, prompt: "Reply with the word OK." , maxOutputTokens: 5 });
      return { ok: true, model: label, text: r.text, oidc: Boolean(process.env.VERCEL_OIDC_TOKEN) };
    } catch (e) {
      return { ok: false, model: label, error: (e as Error).message.slice(0, 400), oidc: Boolean(process.env.VERCEL_OIDC_TOKEN) };
    }
  });
}
