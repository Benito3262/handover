import { update } from "@/lib/db";
import { withSeller } from "@/lib/http";

export async function POST() {
  return withSeller(async (seller) => {
    await update("ho_order_events", { seller_id: `eq.${seller.id}`, read: "eq.false" }, { read: true });
    return { ok: true };
  });
}
