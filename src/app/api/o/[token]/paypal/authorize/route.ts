import { fail, ok } from "@/lib/http";
import { getOrderByToken, markAuthorized } from "@/lib/orders";
import { authorizeOrder } from "@/lib/paypal";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const { orderID } = await req.json();
    const o = await getOrderByToken(token);
    if (!o) return fail("Order not found", 404);
    if (o.status !== "created") return fail("This order is already paid");
    if (!orderID || orderID !== o.paypal_order_id) return fail("PayPal order mismatch");
    const a = await authorizeOrder(orderID);
    const u = await markAuthorized(o, { authorizationId: a.authorizationId, paypalOrderId: orderID, simulated: false });
    return ok({ order: u, status: a.status });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
