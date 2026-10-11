import { fail, ok } from "@/lib/http";
import { getOrderByToken } from "@/lib/orders";
import { createAuthorizeOrder } from "@/lib/paypal";
import { update } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const o = await getOrderByToken(token);
    if (!o) return fail("Order not found", 404);
    if (o.status !== "created") return fail("This order is already paid");
    const pp = await createAuthorizeOrder({ ref: `HO-${o.number}-${o.id.slice(0, 8)}`, amount: Number(o.amount), currency: o.currency, description: `Order #${o.number}: ${o.items.map((i) => `${i.qty} x ${i.name}`).join(", ")}`, items: o.items });
    await update("ho_orders", { id: `eq.${o.id}` }, { paypal_order_id: pp.id });
    return ok({ id: pp.id });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
