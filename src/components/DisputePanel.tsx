"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "./client";
import { money } from "./ui";
import type { Order } from "@/lib/types";

export function DisputePanel({ o, me, endpoint }: { o: Order; me: "seller" | "buyer"; endpoint: string }) {
  const r = useRouter();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [counter, setCounter] = useState(false);
  const [amt, setAmt] = useState(String(Math.round(Number(o.amount) * 50) / 100));
  const res = o.dispute?.resolution;
  const act = async (action: string, extra?: object) => {
    setBusy(action); setErr("");
    try { await post(endpoint, { action, ...extra }); r.refresh(); } catch (e) { setErr((e as Error).message); }
    setBusy("");
  };
  if (!o.dispute) return null;
  const total = Number(o.amount);
  const myAccepted = res ? (me === "seller" ? res.seller_accepted : res.buyer_accepted) : false;
  const theirAccepted = res ? (me === "seller" ? res.buyer_accepted : res.seller_accepted) : false;
  const settledDispute = o.status !== "disputed";
  return (
    <div className="card border-warn/40 p-5">
      <div className="flex items-center justify-between"><h3 className="font-semibold text-warn">⚠ Dispute</h3><span className="text-xs text-mute">Funds stay held until both agree</span></div>
      <p className="mt-2 text-sm">“{o.dispute.reason}”</p>
      {res ? (
        <div className="mt-4 rounded-xl border border-brand2/30 bg-brand2/5 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-brand2">{res.source === "ai" ? "✦ AI mediator proposal" : "Proposal"}</div>
          <div className="mt-1 text-lg font-bold">
            {res.outcome === "refund" ? "Full refund to buyer" : res.outcome === "release" ? "Release full payment to seller" : "Partial refund"}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-black/20 p-2"><div className="text-xs text-mute">Seller receives</div><div className="font-bold text-brand">{money(res.capture_amount, o.currency)}</div></div>
            <div className="rounded-lg bg-black/20 p-2"><div className="text-xs text-mute">Buyer gets back</div><div className="font-bold text-brand2">{money(total - res.capture_amount, o.currency)}</div></div>
          </div>
          <p className="mt-2 text-sm text-slate-300">{res.reasoning}</p>
          <div className="mt-2 flex gap-3 text-xs">
            <span className={res.seller_accepted ? "text-brand" : "text-mute"}>{res.seller_accepted ? "✓" : "○"} Seller</span>
            <span className={res.buyer_accepted ? "text-brand" : "text-mute"}>{res.buyer_accepted ? "✓" : "○"} Buyer</span>
          </div>
          {!settledDispute && (
            <div className="mt-3 flex flex-wrap gap-2">
              {!myAccepted && <button className="btn btn-primary" disabled={!!busy} onClick={() => act("accept")}>{busy === "accept" ? "…" : theirAccepted ? "Accept & execute" : "Accept"}</button>}
              {myAccepted && !theirAccepted && <span className="text-sm text-mute">Waiting for the {me === "seller" ? "buyer" : "seller"} to accept.</span>}
              <button className="btn btn-ghost" disabled={!!busy} onClick={() => setCounter(!counter)}>Counter-offer</button>
              <button className="btn btn-ghost" disabled={!!busy} onClick={() => act("ai_propose")}>{busy === "ai_propose" ? "Thinking…" : "✦ Ask AI again"}</button>
            </div>
          )}
        </div>
      ) : (
        !settledDispute && <button className="btn btn-primary mt-3" disabled={!!busy} onClick={() => act("ai_propose")}>{busy ? "Thinking…" : "✦ Ask AI mediator for a fair outcome"}</button>
      )}
      {counter && !settledDispute && me === "seller" && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div><div className="label mb-1">You receive</div><input className="input w-32" value={amt} onChange={(e) => setAmt(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={() => act("propose", { outcome: Number(amt) <= 0 ? "refund" : Number(amt) >= total ? "release" : "partial", capture_amount: Number(amt), reasoning: `Seller offers to keep ${money(Number(amt), o.currency)} and refund the rest.` })}>Send offer</button>
          <button className="btn btn-danger" onClick={() => act("propose", { outcome: "refund", reasoning: "Seller offers a full refund." })}>Offer full refund</button>
        </div>
      )}
      {counter && !settledDispute && me === "buyer" && (
        <p className="mt-3 text-sm text-mute">Reject and explain in a message below, then ask the AI again or wait for the seller&apos;s offer.
          <button className="btn btn-danger ml-2" onClick={() => act("reject")}>Reject proposal</button></p>
      )}
      {err && <div className="mt-2 text-xs text-rose-300">{err}</div>}
    </div>
  );
}
