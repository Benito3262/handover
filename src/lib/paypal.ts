import { env, paypalConfigured } from "./env";

// PayPal REST (sandbox). Orders v2 with intent=AUTHORIZE, then Payments v2 for
// capture / void / reauthorize. https://developer.paypal.com/docs/api/orders/v2/

let cached: { token: string; exp: number } | null = null;

async function accessToken() {
  if (!paypalConfigured()) throw new Error("PayPal sandbox not configured");
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const res = await fetch(`${env.paypalBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${env.paypalClientId}:${env.paypalSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status})`);
  const j = await res.json();
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

async function pp(path: string, body?: unknown, requestId?: string) {
  const t = await accessToken();
  const res = await fetch(`${env.paypalBase}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = json?.details?.[0]?.description || json?.message || text.slice(0, 200);
    throw new Error(`PayPal ${res.status}: ${json?.name || ""} ${detail}`.trim());
  }
  return json;
}

const money = (v: number, c: string) => ({
  currency_code: c,
  value: c === "JPY" ? Math.round(v).toString() : v.toFixed(2),
});

export async function createAuthorizeOrder(o: {
  ref: string;
  amount: number;
  currency: string;
  description: string;
  items: { name: string; qty: number; unit_price: number }[];
}) {
  const itemTotal = o.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const useItems = Math.abs(itemTotal - o.amount) < 0.005 && o.items.length > 0;
  return pp(
    "/v2/checkout/orders",
    {
      intent: "AUTHORIZE",
      purchase_units: [
        {
          reference_id: o.ref,
          description: o.description.slice(0, 127),
          custom_id: o.ref,
          amount: useItems
            ? { ...money(o.amount, o.currency), breakdown: { item_total: money(o.amount, o.currency) } }
            : money(o.amount, o.currency),
          ...(useItems
            ? {
                items: o.items.map((i) => ({
                  name: i.name.slice(0, 127),
                  quantity: String(i.qty),
                  unit_amount: money(i.unit_price, o.currency),
                })),
              }
            : {}),
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            shipping_preference: "NO_SHIPPING",
            user_action: "CONTINUE",
            brand_name: "Handover",
          },
        },
      },
    },
    `create-${o.ref}-${Date.now()}`,
  );
}

export async function authorizeOrder(paypalOrderId: string) {
  const j = await pp(`/v2/checkout/orders/${paypalOrderId}/authorize`, {}, `auth-${paypalOrderId}`);
  const auth = j?.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth?.id) throw new Error("PayPal did not return an authorization");
  return { authorizationId: auth.id as string, status: auth.status as string, expiration: auth.expiration_time as string | undefined, raw: j };
}

export async function captureAuthorization(authId: string, amount?: { value: number; currency: string }, note?: string) {
  return pp(
    `/v2/payments/authorizations/${authId}/capture`,
    {
      ...(amount ? { amount: money(amount.value, amount.currency) } : {}),
      final_capture: true,
      note_to_payer: note?.slice(0, 255),
    },
    `cap-${authId}`,
  );
}

export async function voidAuthorization(authId: string) {
  return pp(`/v2/payments/authorizations/${authId}/void`, undefined, `void-${authId}`);
}

export async function reauthorize(authId: string, amount?: { value: number; currency: string }) {
  return pp(`/v2/payments/authorizations/${authId}/reauthorize`, amount ? { amount: money(amount.value, amount.currency) } : {});
}
