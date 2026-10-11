import { notFound } from "next/navigation";
import { getOrderByToken, orderThread } from "@/lib/orders";
import { one } from "@/lib/db";
import { env, paypalConfigured } from "@/lib/env";
import { Logo, StatusBadge, money, DemoPaymentBanner } from "@/components/ui";
import { Timeline } from "@/components/Timeline";
import { Thread } from "@/components/Thread";
import { DisputePanel } from "@/components/DisputePanel";
import { BuyerPanel } from "./BuyerPanel";
import type { Seller } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BuyerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const o = await getOrderByToken(token);
  if (!o) notFound();
  const seller = await one<Seller>("ho_sellers", { id: `eq.${o.seller_id}` });
  const t = await orderThread(o.id);
  const live = paypalConfigured();
  const reminders = t.messages.filter((m) => m.author === "ai" || (m.author === "seller" && /reminder/i.test(m.body))).slice(-1);
  return (
    <main className="glow min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5"><Logo /><span className="text-xs text-mute">Buyer protection by Handover</span></header>
      <div className="mx-auto max-w-3xl space-y-5 px-5 pb-20">
        {!live && <DemoPaymentBanner />}
        <div className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs text-mute">Order #{o.number} from</div>
              <h1 className="text-2xl font-bold">{seller?.name || "Seller"}</h1>
              <div className="mt-1 text-sm text-mute">For {o.buyer_name}{o.delivery_date ? ` · delivery ${new Date(o.delivery_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}` : ""}</div>
            </div>
            <div className="text-right"><StatusBadge status={o.status} /><div className="mt-2 text-3xl font-extrabold">{money(o.amount, o.currency)}</div></div>
          </div>
          <ul className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">{o.items.map((i, k) => <li key={k} className="flex justify-between"><span>{i.qty} × {i.name}</span><span className="text-mute">{money(i.qty * i.unit_price, o.currency)}</span></li>)}</ul>
          {o.note && <p className="mt-3 text-sm text-mute">{o.note}</p>}
          <div className="mt-6"><Timeline o={o} /></div>
        </div>
        {reminders.length > 0 && ["created", "shipped"].includes(o.status) && <div className="rounded-xl border border-brand2/30 bg-brand2/10 px-4 py-3 text-sm text-sky-100">🔔 {reminders[0].body}</div>}
        <BuyerPanel o={o} live={live} clientId={live ? env.paypalClientId : ""} sellerName={seller?.name || "the seller"} />
        {o.dispute && <DisputePanel o={o} me="buyer" endpoint={`/api/o/${o.public_token}`} />}
        {o.status !== "created" && <Thread messages={t.messages} evidence={t.evidence} me="buyer" endpoint={`/api/o/${o.public_token}`} />}
        <div className="card p-5 text-sm text-mute">
          <div className="font-semibold text-white">How your money is protected</div>
          <p className="mt-1.5">When you pay, PayPal <b className="text-white">authorizes</b> the amount: it&apos;s reserved, not sent. {seller?.name || "The seller"} only receives it after you confirm the order arrived OK. If something&apos;s wrong, report it and the money stays held while a fair fix is agreed. If you don&apos;t respond within {seller?.auto_release_hours ?? 48}h of shipping, it releases automatically (you&apos;ll get reminders first).</p>
        </div>
      </div>
    </main>
  );
}
