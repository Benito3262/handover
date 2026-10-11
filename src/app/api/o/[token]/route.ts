import { insert } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import * as O from "@/lib/orders";
import { paypalConfigured } from "@/lib/env";
import { suggestResolution } from "@/lib/ai";
import { token as rnd } from "@/lib/auth";
import { addEvidence } from "@/lib/evidence";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const o = await O.getOrderByToken(token);
    if (!o) return fail("Order not found", 404);
    switch (body.action) {
      case "simulate_pay": {
        if (o.status !== "created") throw new Error("Already paid");
        if (paypalConfigured() && !body.force) throw new Error("PayPal sandbox is live. Please pay with the PayPal button.");
        return ok(await O.markAuthorized(o, { authorizationId: `SIM-AUTH-${rnd(6)}`, simulated: true }));
      }
      case "confirm":
        return ok(await O.buyerConfirm(o));
      case "problem": {
        const reason = String(body.reason || "").trim();
        if (reason.length < 5) throw new Error("Tell the seller what went wrong");
        let u = await O.raiseProblem(o, reason.slice(0, 1000));
        if (body.image_data) await addEvidence(u, "buyer", { image_data: body.image_data, caption: "Photo from buyer" });
        const t = await O.orderThread(u.id);
        const r = await suggestResolution(u, t.messages, t.evidence);
        u = await O.setResolution(u, r, "ai");
        return ok(u);
      }
      case "ai_propose": {
        const t = await O.orderThread(o.id);
        return ok(await O.setResolution(o, await suggestResolution(o, t.messages, t.evidence), "ai"));
      }
      case "accept":
        return ok(await O.acceptResolution(o, "buyer", true));
      case "reject":
        return ok(await O.acceptResolution(o, "buyer", false));
      case "message":
        if (!String(body.body || "").trim()) throw new Error("Empty message");
        await insert("ho_messages", { order_id: o.id, author: "buyer", body: String(body.body).slice(0, 2000) });
        await O.logEvent(o, o.seller_id, "message", "buyer", `${o.buyer_name} sent a message on #${o.number}.`);
        return ok();
      case "evidence":
        return ok(await addEvidence(o, "buyer", body));
      default:
        return fail("Unknown action");
    }
  } catch (e) {
    return fail((e as Error).message);
  }
}
