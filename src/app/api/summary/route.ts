import { weeklySummary } from "@/lib/ai";
import { sellerOrders } from "@/lib/orders";
import { withSeller } from "@/lib/http";

export const maxDuration = 30;
export async function POST() {
  return withSeller(async (seller) => weeklySummary(await sellerOrders(seller.id)));
}
