"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { post, fileToDataUrl } from "@/components/client";
import type { Order } from "@/lib/types";

export function SellerActions({ o, link, autoHours, health }: { o: Order; link: string; autoHours: number; health: { level: string; message: string } | null }) {
  const r = useRouter();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [ship, setShip] = useState({ carrier: o.carrier || "", tracking: o.tracking || "", note: "" });
  const [photo, setPhoto] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState("");
  const ep = `/api/orders/${o.id}`;
  const act = async (action: string, extra?: object, done?: string) => {
    setBusy(action); setErr(""); setMsg("");
    try {
      const res = await post<{ text?: string }>(ep, { action, ...extra });
      if (action === "draft_reply" && res.text) setDraft(res.text);
      if (done) setMsg(done);
      r.refresh();
    } catch (e) { setErr((e as Error).message); }
    setBusy("");
  };
  const doShip = async () => {
    if (photo) await post(ep, { action: "evidence", image_data: photo, caption: "Proof of dispatch" }).catch((e) => setErr(e.message));
    await act("ship", ship, "Marked shipped. The buyer has been notified.");
    setPhoto(null);
  };
  const b = (a: string, children: React.ReactNode, cls = "btn-ghost", extra?: object, done?: string) => (
    <button key={a} className={`btn ${cls}`} disabled={!!busy} onClick={() => act(a, extra, done)}>{busy === a ? "…" : children}</button>
  );
  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Next step</h3>
        <button className="text-xs text-brand" onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied ✓" : "Copy buyer link"}</button>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-black/20 px-3 py-2 text-xs"><span className="truncate font-mono text-mute">{link}</span><a href={link} target="_blank" className="ml-auto shrink-0 text-brand">Open as buyer ↗</a></div>

      {o.status === "created" && (
        <div className="space-y-2">
          <p className="text-sm text-mute">Waiting for {o.buyer_name} to pay. Share the link above.</p>
          <div className="flex flex-wrap gap-2">{b("remind", <>Send reminder</>, "btn-primary", undefined, "Reminder sent.")}{b("cancel", <>Cancel invoice</>, "btn-danger", undefined, undefined)}</div>
        </div>
      )}

      {(o.status === "held" || o.status === "shipped") && (
        <div className="space-y-3">
          <p className="text-sm text-mute">{o.status === "held" ? "Paid & held. Ship it and add proof so the buyer can confirm." : `Shipped. If the buyer stays silent for ${autoHours}h after shipping, payment auto-releases.`}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="input" placeholder="Carrier (DHL, rider…)" value={ship.carrier} onChange={(e) => setShip({ ...ship, carrier: e.target.value })} />
            <input className="input" placeholder="Tracking number" value={ship.tracking} onChange={(e) => setShip({ ...ship, tracking: e.target.value })} />
          </div>
          <input className="input" placeholder="Note to buyer (optional)" value={ship.note} onChange={(e) => setShip({ ...ship, note: e.target.value })} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn btn-ghost">{photo ? "📷 Photo ready ✓" : "📷 Add photo"}<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPhoto(await fileToDataUrl(f)); }} /></label>
            <button className="btn btn-primary" disabled={!!busy} onClick={doShip}>{busy === "ship" ? "…" : o.status === "held" ? "Mark shipped" : "Update shipping"}</button>
            {b("seller_confirm", <>Confirm delivered</>, undefined, undefined, "Confirmed. Waiting on the buyer.")}
            {o.status === "shipped" && b("remind", <>Remind buyer</>, undefined, undefined, "Reminder sent.")}
            {b("cancel", <>Cancel & release hold</>, "btn-danger", undefined, undefined)}
          </div>
        </div>
      )}

      {o.status === "delivered" && (
        <div className="space-y-2">
          <p className="text-sm text-emerald-200">{o.buyer_name} confirmed it arrived safely. Confirm the handover and the payment is captured.</p>
          {b("seller_confirm", <>Confirm delivered & get paid</>, "btn-primary", undefined, "Settled! Payment captured.")}
        </div>
      )}

      {o.status === "disputed" && (
        <div className="space-y-2">
          <p className="text-sm text-mute">Reply to the buyer below, or let the AI draft it. The proposal panel shows the suggested outcome.</p>
          {b("draft_reply", <>✦ Draft a reply with AI</>, undefined, undefined, undefined)}
          {draft && <div className="rounded-lg border border-brand2/30 bg-brand2/5 p-3 text-sm"><div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-brand2">Draft</div>{draft}<div className="mt-2"><button className="btn btn-primary" onClick={() => act("message", { body: draft }, "Reply sent.")}>Send this reply</button></div></div>}
        </div>
      )}

      {["settled", "partially_settled", "refunded", "cancelled"].includes(o.status) && <p className="text-sm text-mute">This order is closed.</p>}

      {health && (health.level === "reauth" || health.level === "soon") && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-warn/10 px-3 py-2 text-sm text-amber-200">⏱ {health.message}{b("reauthorize", <>Reauthorize</>, undefined, undefined, "Hold renewed for 3 more days.")}</div>
      )}

      {["held", "shipped", "delivered", "disputed"].includes(o.status) && (
        <details className="rounded-lg border border-dashed border-line p-3 text-sm">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-mute">Demo controls (time travel)</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {o.status === "shipped" && b("simulate_timeout", <>⏩ Simulate buyer silence ({autoHours}h)</>, undefined, undefined, "Fast-forwarded past the buyer window.")}
            {b("simulate_auth_age", <>⏩ Age hold to 4 days</>, undefined, { days: 4 }, "Hold aged to 4 days.")}
          </div>
        </details>
      )}
      {msg && <div className="text-sm text-brand">{msg}</div>}
      {err && <div className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-rose-300">{err}</div>}
    </div>
  );
}
