import Link from "next/link";
import { Logo, DemoPaymentBanner } from "@/components/ui";
import { paypalConfigured, aiConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function Judges() {
  const pp = paypalConfigured();
  const ai = aiConfigured();
  return (
    <main className="glow min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5"><Logo /><Link href="/login?demo=1" className="btn btn-primary">Open demo shop</Link></header>
      <div className="mx-auto max-w-4xl space-y-6 px-5 pb-24">
        <h1 className="text-4xl font-extrabold">Judge quick start</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full border px-3 py-1 ${pp ? "border-brand/40 text-brand" : "border-warn/40 text-warn"}`}>PayPal: {pp ? "sandbox connected" : "demo payments (sandbox not connected)"}</span>
          <span className={`rounded-full border px-3 py-1 ${ai ? "border-brand/40 text-brand" : "border-warn/40 text-warn"}`}>AI: {ai ? "Vercel AI Gateway" : "rules fallback"}</span>
        </div>
        {!pp && <DemoPaymentBanner />}
        <ol className="space-y-4">
          {[
            ["Open the demo shop", <>Click <Link className="text-brand underline" href="/login?demo=1">Open demo shop</Link> (or sign in with handle <code>demo</code>, passcode <code>demo1234</code>). You land on the seller dashboard with 10 orders in every state.</>],
            ["Create an invoice by chat", <>Go to <b>Assistant</b> and type <code>Invoice Ada $50 for 2 cakes, delivery Friday</code>. You get an order and a buyer link.</>],
            ["Be the buyer", <>Open the buyer link in a new tab (no login). {pp ? <>Pay with the PayPal button using a <b>sandbox personal account</b> (see README). The payment is <b>authorized, not captured</b>.</> : <>Click <b>Pay with PayPal (demo)</b> and approve. It is marked <b>Paid &amp; held</b> with a simulated authorization ID.</>}</>],
            ["Ship it", <>Back on the order page as the seller: add a carrier/tracking, or a photo, and click <b>Mark shipped</b>. Or tell the assistant <code>mark order 11 shipped DHL 1234567890</code>.</>],
            ["Confirm both sides", <>Buyer clicks <b>Received, all good</b>; seller clicks <b>Confirm delivered</b>. The authorization is captured and the order is <b>Settled</b>.</>],
            ["Try a dispute", <>On another order, as the buyer click <b>Report a problem</b> (add a photo). The AI mediator proposes an outcome. Accept on both sides to execute it (void = refund, partial capture, or full release). Order <b>#9</b> is already in dispute.</>],
            ["Auto-release + hold age", <>On shipped order <b>#7</b>, press <b>Simulate buyer silence</b> to fast-forward past the 48h window: it captures automatically. Order <b>#6</b> has a 3.5-day-old hold: see the warning and click <b>Reauthorize</b>.</>],
            ["Everything else", <>Weekly AI summary and totals on the dashboard, risk flags on order <b>#10</b>, notifications log, settings for the auto-release window, and <b>Reset demo</b> in Settings.</>],
          ].map(([t, d], i) => (
            <li key={i} className="card flex gap-4 p-5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/15 font-bold text-brand">{i + 1}</div>
              <div><div className="font-semibold">{t}</div><div className="mt-1 text-sm text-mute">{d}</div></div>
            </li>
          ))}
        </ol>
        <div className="card p-5 text-sm text-mute">
          <div className="font-semibold text-white">PayPal APIs used</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><code>POST /v2/checkout/orders</code> with <code>intent: AUTHORIZE</code> (JS SDK buttons on the buyer page)</li>
            <li><code>POST /v2/checkout/orders/:id/authorize</code> to place the hold</li>
            <li><code>POST /v2/payments/authorizations/:id/capture</code> for full and partial release</li>
            <li><code>POST /v2/payments/authorizations/:id/void</code> for refunds before capture</li>
            <li><code>POST /v2/payments/authorizations/:id/reauthorize</code> after the 3-day honor period</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
