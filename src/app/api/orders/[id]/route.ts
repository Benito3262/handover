import { insert } from "@/lib/db";
import { withSeller } from "@/lib/http";
import * as O from "@/lib/orders";
import { draftDisputeReply, suggestResolution } from "@/lib/ai";
import { addEvidence } from "@/lib/evidence";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return withSeller(async (seller) => {
    const o = await O.getOrder(seller.id, id);
    if (!o) throw new Error("Order not found");
    switch (body.action) {
      case "ship":
        return O.markShipped(o, { carrier: body.carrier, tracking: body.tracking, note: body.note });
      case "seller_confirm":
        return O.sellerConfirm(o);
      case "remind":
        return O.remindBuyer(o, "seller", body.text);
      case "cancel":
        return O.cancelOrder(o);
      case "reauthorize":
        return O.reauthorizeOrder(o);
      case "simulate_timeout":
        return O.simulateTimeout(seller, o);
      case "simulate_auth_age":
        await O.simulateAuthAge(o, Number(body.days) || 4);
        return O.getOrder(seller.id, id);
      case "ai_propose": {
        const t = await O.orderThread(o.id);
        const r = await suggestResolution(o, t.messages, t.evidence);
        return O.setResolution(o, r, "ai");
      }
      case "propose":
        return O.setResolution(o, { outcome: body.outcome, capture_amount: body.outcome === "refund" ? 0 : body.outcome === "release" ? Number(o.amount) : Number(body.capture_amount), reasoning: String(body.reasoning || "Seller's offer."), source: "rules" }, "seller");
      case "accept":
        return O.acceptResolution(o, "seller", true);
      case "reject":
        return O.acceptResolution(o, "seller", false);
      case "message":
        if (!String(body.body || "").trim()) throw new Error("Empty message");
        await insert("ho_messages", { order_id: o.id, author: "seller", body: String(body.body).slice(0, 2000) });
        return o;
      case "evidence":
        return addEvidence(o, "seller", body);
      case "draft_reply": {
        const t = await O.orderThread(o.id);
        return draftDisputeReply(o, t.messages);
      }
      default:
        throw new Error("Unknown action");
    }
  });
}

export const dynamic = "force-dynamic";
