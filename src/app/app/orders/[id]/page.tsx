import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { currentSeller } from "@/lib/auth";
import { authHealth, getOrder, orderThread } from "@/lib/orders";
import { StatusBadge, money } from "@/components/ui";
import { Timeline } from "@/components/Timeline";
import { Thread } from "@/components/Thread";
import { DisputePanel } from "@/components/DisputePanel";
import { SellerActions } from "./SellerActions";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seller = (await currentSeller())!;
  const o = await getOrder(seller.id, id);
  if (!o) notFound();
  const t = await orderThread(o.id);
  const h = await headers();
  const link = `${h.get("x-forwarded-proto") || "http"}://${h.get("x-forwarded-host") || h.get("host")}/o/${o.public_token}`;
  const health = authHealth(o);
  return (
    <div className="space-y-5">
      <Link href="/app/orders" className="text-sm text-mute hover:text-white">← Orders</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3"><h1 className="text-2xl font-bold">#{o.number} · {o.buyer_name}</h1><StatusBadge status={o.status} /></div>
          <div className="mt-1 text-sm text-mute">{o.buyer_email || "no email"} · created {new Date(o.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}{o.delivery_date ? ` · delivery ${o.delivery_date}` : ""}</div>
        </div>
        <div className="text-right"><div className="text-3xl font-extrabold">{money(o.amount, o.currency)}</div>{o.captured_amount != null && <div className="text-xs text-mute">released {money(o.captured_amount, o.currency)}{o.refunded_amount ? ` · refunded ${money(o.refunded_amount, o.currency)}` : ""}</div>}</div>
      </div>
      <div className="card p-5"><Timeline o={o} /></div>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <SellerActions o={o} link={link} autoHours={seller.auto_release_hours} health={health} />
          {o.dispute && <DisputePanel o={o} me="seller" endpoint={`/api/orders/${o.id}`} />}
          <Thread messages={t.messages} evidence={t.evidence} me="seller" endpoint={`/api/orders/${o.id}`} />
        </div>
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="mb-3 font-semibold">Items</h3>
            <ul className="space-y-1.5 text-sm">{o.items.map((i, k) => <li key={k} className="flex justify-between"><span>{i.qty} × {i.name}</span><span className="text-mute">{money(i.qty * i.unit_price, o.currency)}</span></li>)}</ul>
            {o.note && <p className="mt-3 border-t border-line pt-3 text-sm text-mute">{o.note}</p>}
          </div>
          <div className="card p-5 text-sm">
            <h3 className="mb-3 font-semibold">Payment</h3>
            <dl className="space-y-1.5">
              <Row k="Mode" v={o.authorization_id ? (o.simulated ? "Demo payment (simulated)" : "PayPal sandbox") : "Not paid"} />
              {o.paypal_order_id && <Row k="PayPal order" v={o.paypal_order_id} />}
              {o.authorization_id && <Row k="Authorization" v={o.authorization_id} />}
              {o.capture_id && <Row k="Capture" v={o.capture_id} />}
              {o.honor_expires_at && <Row k="Honor period ends" v={new Date(o.honor_expires_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} />}
              {o.auth_expires_at && <Row k="Hold expires" v={new Date(o.auth_expires_at).toLocaleDateString("en-US", { dateStyle: "medium" })} />}
              {o.tracking && <Row k="Tracking" v={`${o.carrier ? o.carrier + " " : ""}${o.tracking}`} />}
            </dl>
            {health && <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${health.level === "ok" ? "bg-brand/10 text-emerald-200" : "bg-warn/10 text-amber-200"}`}>{health.message}</div>}
          </div>
          {o.risk && o.risk.length > 0 && (
            <div className="card p-5">
              <h3 className="mb-2 font-semibold">Risk check</h3>
              <ul className="space-y-1.5 text-sm">{o.risk.map((f) => <li key={f.code} className="flex gap-2"><span className={f.level === "high" ? "text-bad" : f.level === "medium" ? "text-warn" : "text-mute"}>●</span>{f.message}</li>)}</ul>
            </div>
          )}
          <div className="card p-5">
            <h3 className="mb-3 font-semibold">Activity</h3>
            <ol className="space-y-2.5 border-l border-line pl-4 text-sm">
              {t.events.map((e) => <li key={e.id} className="relative"><span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand/70" /><div>{e.message}</div><div className="text-[11px] text-mute">{new Date(e.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {e.actor}</div></li>)}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-mute">{k}</dt><dd className="truncate font-mono text-xs">{v}</dd></div>;
}
