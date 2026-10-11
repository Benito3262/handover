import Link from "next/link";
import { currentSeller } from "@/lib/auth";
import { authHealth, sellerOrders, stats } from "@/lib/orders";
import { riskLevel } from "@/lib/risk";
import { Stat, StatusBadge, money, ago } from "@/components/ui";
import { OrdersTable } from "@/components/OrdersTable";
import { WeeklySummary } from "./WeeklySummary";
import type { Order } from "@/lib/types";

export default async function Dashboard() {
  const seller = (await currentSeller())!;
  const orders = await sellerOrders(seller.id);
  const s = stats(orders);
  const c = s.currency;
  const attention: { o: Order; why: string; tone: string }[] = [];
  for (const o of orders) {
    if (o.status === "disputed") attention.push({ o, why: o.dispute?.resolution && !o.dispute.resolution.seller_accepted ? "Dispute: AI proposal waiting for you" : "Buyer reported a problem", tone: "text-warn" });
    else if (o.status === "delivered" && !o.seller_confirmed_at) attention.push({ o, why: "Buyer confirmed. Confirm the handover to get paid", tone: "text-brand" });
    else if (o.status === "held") attention.push({ o, why: "Paid & held. Ready to ship", tone: "text-brand2" });
    const h = authHealth(o);
    if (h && (h.level === "reauth" || h.level === "soon" || h.level === "expired")) attention.push({ o, why: h.message, tone: "text-warn" });
    if (riskLevel(o.risk) === "high" && ["created", "held"].includes(o.status)) attention.push({ o, why: o.risk!.filter((r) => r.level === "high").map((r) => r.message).join(" "), tone: "text-bad" });
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Good to see you, {seller.name.split(" ")[0].replace(/'s$/, "")}</h1>
          <p className="text-sm text-mute">Money is only released when both you and the buyer confirm delivery.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/assistant" className="btn btn-ghost">✦ Ask the assistant</Link>
          <Link href="/app/new" className="btn btn-primary">+ New invoice</Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Held for you" value={money(s.heldTotal, c)} sub={`${s.heldCount} order(s) paid, awaiting delivery`} tone="blue" />
        <Stat label="Settled" value={money(s.settledTotal, c)} sub={`${s.settledCount} order(s) released`} tone="brand" />
        <Stat label="Unpaid invoices" value={money(s.unpaidTotal, c)} sub={`${s.unpaid.length} buyer(s) haven't paid`} tone="warn" />
        <Stat label="This week" value={String(s.weekCount)} sub={`new orders · ${money(s.weekSettledTotal, c)} released`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Needs your attention</h2><span className="text-xs text-mute">{attention.length} item(s)</span></div>
          {attention.length === 0 ? <p className="text-sm text-mute">All clear.</p> : (
            <ul className="divide-y divide-line">
              {attention.slice(0, 8).map(({ o, why, tone }, i) => (
                <li key={i}><Link href={`/app/orders/${o.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                  <div className="min-w-0"><div className="text-sm font-medium">#{o.number} {o.buyer_name} · {money(o.amount, o.currency)}</div><div className={`truncate text-xs ${tone}`}>{why}</div></div>
                  <StatusBadge status={o.status} />
                </Link></li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-5">
          <WeeklySummary />
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Who hasn&apos;t paid</h2>
            {s.unpaid.length === 0 ? <p className="text-sm text-mute">Everyone has paid.</p> : (
              <ul className="space-y-2 text-sm">
                {s.unpaid.map((o) => (
                  <li key={o.id} className="flex items-center justify-between"><Link href={`/app/orders/${o.id}`} className="hover:text-brand">#{o.number} {o.buyer_name} <span className="text-xs text-mute">· {ago(o.created_at)}</span></Link><span className="font-semibold">{money(o.amount, o.currency)}</span></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <OrdersTable orders={orders.slice(0, 8)} title="Recent orders" more />
    </div>
  );
}

