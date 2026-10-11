import Link from "next/link";
import { currentSeller } from "@/lib/auth";
import { select } from "@/lib/db";
import type { OrderEvent } from "@/lib/types";
import { MarkRead } from "./MarkRead";

const ICON: Record<string, string> = { created: "🧾", paid: "💳", shipped: "📦", buyer_confirmed: "✅", seller_confirmed: "✅", settled: "💰", auto_released: "⏱", partially_settled: "⚖️", refunded: "↩️", disputed: "⚠️", resolution_proposed: "✦", resolution_accepted: "🤝", resolution_rejected: "✋", reminder: "🔔", risk: "⚑", auth_warning: "⏳", reauthorized: "🔁", evidence: "📷", message: "💬", cancelled: "✕", demo: "⏩" };

export default async function Notifications() {
  const seller = (await currentSeller())!;
  const events = await select<OrderEvent>("ho_order_events", { seller_id: `eq.${seller.id}`, order: "created_at.desc", limit: 150 });
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Notifications</h1><MarkRead /></div>
      <div className="card divide-y divide-line">
        {events.map((e) => (
          <div key={e.id} className={`flex gap-3 px-5 py-3 ${e.read ? "" : "bg-brand/[.04]"}`}>
            <div className="w-6 text-center">{ICON[e.type] || "•"}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm">{e.order_id ? <Link href={`/app/orders/${e.order_id}`} className="hover:text-brand">{e.message}</Link> : e.message}</div>
              <div className="text-[11px] text-mute">{new Date(e.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · {e.actor}</div>
            </div>
            {!e.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-brand" />}
          </div>
        ))}
        {events.length === 0 && <div className="p-8 text-center text-sm text-mute">Nothing yet.</div>}
      </div>
    </div>
  );
}
