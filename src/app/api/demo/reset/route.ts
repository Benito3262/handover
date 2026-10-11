import { seedDemo } from "@/lib/seed";
import { withSeller } from "@/lib/http";

export async function POST() {
  return withSeller(async (seller) => {
    if (!seller.is_demo) throw new Error("Only the demo shop can be reset");
    await seedDemo(seller);
    return { ok: true };
  });
}
