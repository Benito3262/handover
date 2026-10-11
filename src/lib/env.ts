export const env = {
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseKey: process.env.SUPABASE_ANON_KEY || "",
  dbKey: process.env.HANDOVER_DB_KEY || "",
  sessionSecret: process.env.SESSION_SECRET || process.env.HANDOVER_DB_KEY || "dev-only-secret",
  paypalClientId: process.env.PAYPAL_CLIENT_ID || "",
  paypalSecret: process.env.PAYPAL_CLIENT_SECRET || "",
  paypalBase: process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com",
  aiModel: process.env.AI_GATEWAY_MODEL || "spacexai/grok-4.1-fast-non-reasoning",
  cronSecret: process.env.CRON_SECRET || "",
};

export const paypalConfigured = () => Boolean(env.paypalClientId && env.paypalSecret);
export const dbConfigured = () => Boolean(env.supabaseUrl && env.supabaseKey && env.dbKey);
// AI is used when either:
//  - AI_API_KEY is set: any OpenAI-compatible endpoint (default: Google Gemini's free tier), or
//  - AI_GATEWAY_API_KEY is set, or AI_GATEWAY_ENABLED=1 on Vercel (OIDC; the team needs AI Gateway credits enabled).
// Otherwise every AI feature uses its deterministic fallback.
export const aiProvider = {
  key: process.env.AI_API_KEY || "",
  baseURL: process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
  model: process.env.AI_MODEL || "gemini-2.5-flash",
};
export const aiConfigured = () =>
  Boolean(aiProvider.key || process.env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_ENABLED === "1");
export const aiLabel = () => (aiProvider.key ? `${aiProvider.model} (OpenAI-compatible)` : `Vercel AI Gateway · ${env.aiModel}`);

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "SGD", "HKD", "NZD", "SEK", "NOK", "DKK", "PLN", "MXN", "BRL"];
