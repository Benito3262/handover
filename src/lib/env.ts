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
export const aiConfigured = () =>
  Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL);

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "SGD", "HKD", "NZD", "SEK", "NOK", "DKK", "PLN", "MXN", "BRL"];
