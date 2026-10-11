import Link from "next/link";
import { Logo } from "@/components/ui";
import { InteractiveDemo } from "@/components/InteractiveDemo";

const FAQ = [
  ["Is Handover free?", "Yes. It's free for sellers and buyers. PayPal's normal fees apply when a payment is actually captured; Handover adds nothing on top."],
  ["Where is the money while it's held?", "Nowhere new. PayPal authorizes the payment on the buyer's own account. The money is reserved for the seller but not taken until Handover captures it, so if the order goes wrong the hold is simply voided."],
  ["What if the buyer never confirms?", "Once the seller marks the order shipped, the buyer gets reminders. If they stay silent past the seller's window (48h by default), payment releases automatically. Buyers can't hold a seller's money hostage."],
  ["What if something goes wrong?", "The buyer reports a problem with a photo. The money stays held. The AI mediator reads both sides and the evidence and suggests a fair outcome: release, partial refund or full refund. Nothing happens until both parties accept."],
  ["How long can money be held?", "PayPal guarantees an authorization for 3 days (the honor period) and it stays valid up to 29 days. Handover tracks the age of every hold, warns you before the honor period ends, and lets you reauthorize in one click."],
  ["Do I need to learn an app?", "No. Talk to the assistant like a person: “Invoice Ada $50 for 2 cakes”, “who hasn't paid?”, “mark order 7 shipped”. It does the rest."],
  ["Is this live money?", "This hackathon build runs on the PayPal sandbox only. No real money moves."],
];

export default function Landing() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 glow" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[700px] grid-bg" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-mute md:flex">
          <a href="#how" className="hover:text-white">How it works</a>
          <a href="#demo" className="hover:text-white">Demo</a>
          <a href="#sellers" className="hover:text-white">Sellers</a>
          <a href="#buyers" className="hover:text-white">Buyers</a>
          <a href="#faq" className="hover:text-white">FAQ</a>
          <Link href="/judges" className="hover:text-white">Judges</Link>
        </nav>
        <div className="flex gap-2">
          <Link href="/login" className="btn btn-ghost hidden sm:inline-flex">Sign in</Link>
          <Link href="/login?demo=1" className="btn btn-primary">Try the demo</Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20 pt-14 text-center md:pt-24">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-panel/80 px-3 py-1 text-xs text-mute">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Built on PayPal Orders v2 · authorize now, capture on delivery
        </div>
        <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Get paid upfront.<br />
          <span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">Release on delivery.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-mute">
          Handover is an AI money assistant for small sellers. Buyers pay with PayPal, the money is held, and it only clears once the goods arrive safely and <b className="text-white">both sides confirm</b>. Strangers can finally trust each other.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/login?demo=1" className="btn btn-primary px-6 py-3 text-base">Open the demo shop →</Link>
          <a href="#how" className="btn btn-ghost px-6 py-3 text-base">See how it works</a>
        </div>
        <p className="mt-4 text-xs text-mute">Free for sellers and buyers · PayPal sandbox · no card needed</p>

        <div className="mx-auto mt-16 grid max-w-4xl gap-3 sm:grid-cols-3">
          {[
            ["$0", "to start. No subscription, no setup fee."],
            ["48h", "default auto-release, so buyers can't stall."],
            ["2 of 2", "confirmations before money moves."],
          ].map(([a, b]) => (
            <div key={a} className="card p-5 text-left">
              <div className="text-3xl font-extrabold text-brand">{a}</div>
              <div className="mt-1 text-sm text-mute">{b}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="relative z-10 mx-auto max-w-6xl px-5 py-20">
        <div className="label text-brand">How it works</div>
        <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Five steps, one sentence to start.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {[
            ["1", "Invoice by chat", "“Invoice Ada $50 for 2 cakes, delivery Friday.” The AI builds the order and a buyer link."],
            ["2", "Buyer pays, money is held", "Ada pays with PayPal. It's authorized, not captured: reserved, not taken."],
            ["3", "Seller ships", "Add tracking or a photo. Ada is notified and nudged to confirm."],
            ["4", "Both confirm", "Ada confirms it arrived OK, the seller confirms the handover."],
            ["5", "Money releases", "Handover captures the payment. Problems go to the AI mediator instead."],
          ].map(([n, t, d]) => (
            <div key={n} className="card relative p-5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15 font-bold text-brand">{n}</div>
              <div className="mt-4 font-semibold">{t}</div>
              <p className="mt-1.5 text-sm text-mute">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="demo" className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <div className="label text-brand">Interactive demo</div>
        <h2 className="mt-2 mb-8 text-3xl font-bold sm:text-4xl">Click through a real order.</h2>
        <InteractiveDemo />
        <div className="mt-5 text-center text-sm text-mute">Want the real thing? <Link href="/login?demo=1" className="text-brand underline">Open the demo shop</Link>, which has 10 sample orders in every state.</div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-5 px-5 py-20 md:grid-cols-2">
        <div id="sellers" className="card p-7">
          <div className="label text-brand">For sellers</div>
          <h3 className="mt-2 text-2xl font-bold">Sell to strangers without the fear.</h3>
          <ul className="mt-5 space-y-3 text-sm text-mute">
            {[
              "Money is locked in before you bake, sew or ship.",
              "A chat assistant that invoices, chases late payers and marks orders shipped.",
              "Auto-release if a buyer goes quiet, so you're never stuck.",
              "Risk flags on unusual orders: huge amounts, new buyers, disposable emails.",
              "A weekly AI summary: what sold, who owes you, what needs action.",
              "Dispute replies drafted for you, backed by your photos and tracking.",
            ].map((x) => <li key={x} className="flex gap-2"><span className="text-brand">✓</span>{x}</li>)}
          </ul>
        </div>
        <div id="buyers" className="card p-7">
          <div className="label text-brand2">For buyers</div>
          <h3 className="mt-2 text-2xl font-bold">Pay first, and still be protected.</h3>
          <ul className="mt-5 space-y-3 text-sm text-mute">
            {[
              "Pay with PayPal. The seller only gets paid after you confirm.",
              "Track every step on one link, no account needed.",
              "Something wrong? Report it with a photo and your money stays held.",
              "A neutral AI mediator suggests a fair fix. Nothing happens until you agree.",
              "Reminders before anything auto-releases, so you're never surprised.",
            ].map((x) => <li key={x} className="flex gap-2"><span className="text-brand2">✓</span>{x}</li>)}
          </ul>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 py-12">
        <div className="label text-brand">Where the AI works</div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Invoice parser", "Plain sentences become structured orders with items, totals and dates."],
            ["Tool-calling assistant", "Acts on your real orders: remind, ship, summarize, look up."],
            ["Dispute mediator", "Reads both sides and photos, proposes release, partial or refund."],
            ["Risk + reminders", "Flags odd orders and nudges buyers before auto-release."],
          ].map(([t, d]) => (
            <div key={t} className="card p-5"><div className="font-semibold">{t}</div><p className="mt-1.5 text-sm text-mute">{d}</p></div>
          ))}
        </div>
      </section>

      <section id="faq" className="relative z-10 mx-auto max-w-3xl px-5 py-20">
        <h2 className="text-center text-3xl font-bold">Questions</h2>
        <div className="mt-8 space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="card group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">{q}<span className="text-mute transition group-open:rotate-45">+</span></summary>
              <p className="mt-3 text-sm text-mute">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-24">
        <div className="card flex flex-col items-center gap-4 bg-gradient-to-br from-brand/10 to-brand2/10 p-10 text-center">
          <h2 className="text-3xl font-bold">Judging? Start here.</h2>
          <p className="max-w-xl text-mute">One click logs you into a seeded demo shop. Play the seller in the dashboard and the buyer on any order link.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/login?demo=1" className="btn btn-primary">Open the demo shop</Link>
            <Link href="/judges" className="btn btn-ghost">Judge quick start</Link>
          </div>
        </div>
      </section>
      <footer className="relative z-10 border-t border-line py-8 text-center text-xs text-mute">
        Handover · PayPal AI Hackathon 2026 · Sandbox only · <a className="underline" href="https://github.com/Benito3262/handover">GitHub</a>
      </footer>
    </main>
  );
}
