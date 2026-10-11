import { createOrder } from "@/lib/orders";
import { baseUrl, withSeller } from "@/lib/http";
import { SUPPORTED_CURRENCIES } from "@/lib/env";

export async function POST(req: Request) {
  const d = await req.json();
  return withSeller(async (seller) => {
    const currency = String(d.currency || "USD").toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(currency)) throw new Error(`${currency} isn't supported by PayPal. Use USD, EUR, GBP or another PayPal currency.`);
    const items = (Array.isArray(d.items) ? d.items : []).map((i: { name: string; qty: number; unit_price: number }) => ({ name: String(i.name || "Item").slice(0, 80), qty: Math.max(1, Number(i.qty) || 1), unit_price: Math.max(0, Number(i.unit_price) || 0) }));
    const o = await createOrder(seller, {
      buyer_name: String(d.buyer_name || "").slice(0, 80),
      buyer_email: d.buyer_email ? String(d.buyer_email).slice(0, 120) : null,
      items,
      amount: Math.round(Number(d.amount) * 100) / 100,
      currency,
      delivery_date: d.delivery_date || null,
      note: d.note ? String(d.note).slice(0, 500) : null,
    });
    return { order: o, buyer_link: `${baseUrl(req)}/o/${o.public_token}` };
  });
}
