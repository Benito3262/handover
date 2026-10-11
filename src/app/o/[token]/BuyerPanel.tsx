"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { post, fileToDataUrl } from "@/components/client";
import { money } from "@/components/ui";
import type { Order } from "@/lib/types";

declare global {
  interface Window { paypal?: { Buttons: (o: object) => { render: (el: HTMLElement) => Promise<void>; close?: () => void } } }
}

export function BuyerPanel({ o, live, clientId, sellerName }: { o: Order; live: boolean; clientId: string; sellerName: string }) {
  const r = useRouter();
  const ep = `/api/o/${o.public_token}`;
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [problem, setProblem] = useState(false);
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [sim, setSim] = useState<"closed" | "login" | "review" | "done">("closed");
  const btnRef = useRef<HTMLDivElement>(null);

  const act = async (action: string, extra?: object) => {
    setBusy(action); setErr("");
    try { await post(ep, { action, ...extra }); r.refresh(); setProblem(false); } catch (e) { setErr((e as Error).message); }
    setBusy("");
  };

  useEffect(() => {
    if (!live || o.status !== "created" || !btnRef.current) return;
    const el = btnRef.current;
    const render = () => {
      if (!window.paypal) return;
      el.innerHTML = "";
      window.paypal.Buttons({
        style: { layout: "vertical", color: "gold", shape: "rect", label: "pay" },
        createOrder: async () => (await post<{ id: string }>(`${ep}/paypal/create`)).id,
        onApprove: async (data: { orderID: string }) => {
          try { await post(`${ep}/paypal/authorize`, { orderID: data.orderID }); r.refresh(); } catch (e) { setErr((e as Error).message); }
        },
        onError: (e: unknown) => setErr(String((e as Error)?.message || e)),
      }).render(el);
    };
    const src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&intent=authorize&currency=${o.currency}&components=buttons`;
    let s = document.querySelector(`script[data-ho-pp]`) as HTMLScriptElement | null;
    if (s && s.src === src && window.paypal) render();
    else {
      s?.remove();
      s = document.createElement("script");
      s.src = src; s.dataset.hoPp = "1"; s.onload = render; s.onerror = () => setErr("Couldn't load PayPal");
      document.body.appendChild(s);
    }
  }, [live, o.status, clientId, o.currency, ep, r]);

  if (o.status === "created") {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold">Pay {money(o.amount, o.currency)} safely</h2>
        <p className="mt-1 text-sm text-mute">Your payment is held, not sent. {sellerName} only gets it after you confirm delivery.</p>
        <div className="mt-5">
          {live ? <div ref={btnRef} className="min-h-[50px]" /> : (
            <>
              <button onClick={() => setSim("login")} className="flex w-full items-center justify-center gap-2 rounded-md bg-[#ffc439] py-3 font-bold text-[#003087] hover:brightness-95">
                <span className="italic">Pay</span><span className="italic text-[#009cde]">Pal</span><span className="ml-1 rounded bg-[#003087] px-1.5 py-0.5 text-[10px] text-white not-italic">DEMO</span>
              </button>
              <p className="mt-2 text-center text-xs text-warn">Demo payment, PayPal sandbox not connected. No money moves.</p>
            </>
          )}
        </div>
        {err && <div className="mt-3 rounded-lg bg-bad/10 px-3 py-2 text-sm text-rose-300">{err}</div>}
        {sim !== "closed" && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => sim !== "done" && setSim("closed")}>
            <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between bg-[#f5f7fa] px-5 py-3">
                <div className="text-xl font-extrabold italic"><span className="text-[#003087]">Pay</span><span className="text-[#009cde]">Pal</span></div>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">DEMO · SANDBOX NOT CONNECTED</span>
              </div>
              <div className="space-y-4 p-5">
                {sim === "login" && (<>
                  <div className="text-sm font-semibold">Log in to the demo buyer account</div>
                  <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" defaultValue="sb-buyer@personal.example.com" />
                  <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="password" defaultValue="demopassword" />
                  <button className="w-full rounded-full bg-[#0070ba] py-2.5 font-bold text-white" onClick={() => setSim("review")}>Log in</button>
                </>)}
                {sim === "review" && (<>
                  <div className="text-sm text-slate-500">Pay {sellerName}</div>
                  <div className="text-3xl font-extrabold">{money(o.amount, o.currency)}</div>
                  <div className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600">Intent: <b>AUTHORIZE</b>. The amount is reserved on your account and only captured after you confirm delivery.</div>
                  <div className="rounded-lg border border-slate-200 p-3 text-sm">Pay with <b>PayPal balance (demo)</b></div>
                  <button disabled={!!busy} className="w-full rounded-full bg-[#0070ba] py-2.5 font-bold text-white disabled:opacity-60" onClick={async () => { await act("simulate_pay"); setSim("done"); }}>{busy ? "Authorizing…" : "Agree & Pay"}</button>
                  <button className="w-full text-sm text-[#0070ba]" onClick={() => setSim("closed")}>Cancel and return</button>
                </>)}
                {sim === "done" && (<>
                  <div className="text-center text-4xl">✓</div>
                  <div className="text-center font-bold">Payment authorized and held</div>
                  <p className="text-center text-xs text-slate-500">Simulated authorization. {sellerName} will be paid once you both confirm delivery.</p>
                  <button className="w-full rounded-full bg-[#0070ba] py-2.5 font-bold text-white" onClick={() => setSim("closed")}>Return to order</button>
                </>)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const canConfirm = ["held", "shipped"].includes(o.status) && !o.buyer_confirmed_at;
  return (
    <div className="card space-y-4 p-6">
      {o.status === "held" && <p className="text-sm"><b className="text-brand2">Paid & held.</b> <span className="text-mute">{sellerName} is preparing your order. Your money is reserved, not sent.</span></p>}
      {o.status === "shipped" && <p className="text-sm"><b className="text-brand">On its way!</b> <span className="text-mute">{o.carrier ? `Sent with ${o.carrier}. ` : ""}{o.tracking ? `Tracking: ${o.tracking}. ` : ""}When it arrives, confirm it&apos;s OK or report a problem.</span></p>}
      {o.status === "delivered" && <p className="text-sm text-emerald-200">Thanks for confirming! Payment releases as soon as {sellerName} confirms the handover.</p>}
      {o.status === "settled" && <p className="text-sm text-emerald-200">All done. {money(o.captured_amount ?? o.amount, o.currency)} was released to {sellerName}.{o.simulated ? " (demo payment)" : ""}</p>}
      {o.status === "partially_settled" && <p className="text-sm text-emerald-200">Resolved. {money(o.refunded_amount ?? 0, o.currency)} was returned to you, {money(o.captured_amount ?? 0, o.currency)} went to {sellerName}.</p>}
      {o.status === "refunded" && <p className="text-sm text-sky-200">The hold was released. You were not charged{o.simulated ? " (demo payment)" : ""}.</p>}
      {o.status === "cancelled" && <p className="text-sm text-mute">This invoice was cancelled.</p>}
      {o.status === "disputed" && <p className="text-sm text-amber-200">You reported a problem. Your money is still held while you and {sellerName} agree on a fix below.</p>}
      {canConfirm && (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={!!busy} onClick={() => act("confirm")}>{busy === "confirm" ? "…" : "✓ Received, all good"}</button>
          <button className="btn btn-danger" disabled={!!busy} onClick={() => setProblem(!problem)}>Report a problem</button>
        </div>
      )}
      {problem && (
        <div className="space-y-2 rounded-xl border border-warn/40 bg-warn/5 p-4">
          <div className="text-sm font-semibold">What went wrong?</div>
          <textarea className="input min-h-[80px]" placeholder="e.g. 1 of the 2 cakes arrived crushed" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <label className="btn btn-ghost">{photo ? "📷 Photo added ✓" : "📷 Add a photo"}<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPhoto(await fileToDataUrl(f)); }} /></label>
            <button className="btn btn-primary" disabled={!!busy || reason.trim().length < 5} onClick={() => act("problem", { reason, image_data: photo })}>{busy === "problem" ? "AI is reviewing…" : "Submit & keep money held"}</button>
          </div>
        </div>
      )}
      {err && <div className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-rose-300">{err}</div>}
    </div>
  );
}
