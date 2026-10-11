"use client";
import { useState } from "react";

const STEPS = [
  { who: "Seller", chat: "Invoice Ada $50 for 2 cakes, delivery Friday", status: "Awaiting payment", held: 0, note: "The assistant turns one sentence into an invoice and a buyer link." },
  { who: "Buyer", chat: "Ada pays with PayPal", status: "Paid & held", held: 50, note: "PayPal authorizes $50. The money is reserved on Ada's account, not sent yet." },
  { who: "Seller", chat: "Mark order 4 shipped, rider, photo attached", status: "Shipped", held: 50, note: "Ada gets a nudge. If she stays silent past 48h, payment auto-releases." },
  { who: "Buyer", chat: "Received, cakes look great 🎂", status: "Delivered", held: 50, note: "Ada confirms. Now the seller confirms the handover too." },
  { who: "Both", chat: "Both confirmed", status: "Settled", held: 0, note: "Handover captures the authorization. $50 lands with the seller." },
];

export function InteractiveDemo() {
  const [i, setI] = useState(0);
  const [problem, setProblem] = useState(false);
  const s = STEPS[i];
  const done = i === STEPS.length - 1;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3 text-sm">
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand pulse-dot" /> Order #4 · Ada Nwosu · 2 × Chocolate cake</div>
        <div className="text-mute">Step {i + 1} / {STEPS.length}</div>
      </div>
      <div className="grid gap-0 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3 p-5">
          {STEPS.slice(0, i + 1).map((st, k) => (
            <div key={k} className={`fade-in flex ${st.who === "Buyer" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${st.who === "Buyer" ? "bg-brand2/15 text-sky-100" : st.who === "Both" ? "bg-brand/15 text-emerald-100" : "bg-panel2 text-white"}`}>
                <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-mute">{st.who}</div>
                {st.chat}
              </div>
            </div>
          ))}
          {problem && (
            <div className="fade-in rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-amber-100">
              <b>If Ada had reported a problem instead:</b> the money stays held, the AI reads both sides and photos, and suggests e.g. “seller keeps $35, Ada gets $15 back”. Nothing moves until both accept.
            </div>
          )}
        </div>
        <div className="border-t border-line bg-panel2/60 p-5 md:border-l md:border-t-0">
          <div className="label">Status</div>
          <div className="mt-1 text-xl font-bold text-brand">{s.status}</div>
          <div className="mt-4 label">Held by PayPal</div>
          <div className="mt-1 text-3xl font-extrabold">${s.held.toFixed(2)}</div>
          <div className="mt-4 label">Released to seller</div>
          <div className="mt-1 text-xl font-bold">{done ? "$50.00" : "$0.00"}</div>
          <p className="mt-4 text-sm text-mute">{s.note}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {!done ? (
              <button className="btn btn-primary" onClick={() => setI(i + 1)}>Next step →</button>
            ) : (
              <button className="btn btn-primary" onClick={() => { setI(0); setProblem(false); }}>Replay</button>
            )}
            <button className="btn btn-ghost" onClick={() => setProblem(!problem)}>What if there&apos;s a problem?</button>
          </div>
        </div>
      </div>
    </div>
  );
}
