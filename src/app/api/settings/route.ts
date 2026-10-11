import { update } from "@/lib/db";
import { withSeller } from "@/lib/http";

export async function POST(req: Request) {
  const b = await req.json();
  return withSeller(async (seller) => {
    const hours = Math.min(24 * 14, Math.max(1, Math.round(Number(b.auto_release_hours) || 48)));
    const patch: Record<string, unknown> = { auto_release_hours: hours };
    if (!seller.is_demo) {
      if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim().slice(0, 80);
      if (typeof b.paypal_email === "string") patch.paypal_email = b.paypal_email.trim().slice(0, 120) || null;
    }
    const [s] = await update("ho_sellers", { id: `eq.${seller.id}` }, patch);
    return s;
  });
}
