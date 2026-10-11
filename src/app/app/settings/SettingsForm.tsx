"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "@/components/client";

export function SettingsForm({ seller }: { seller: { name: string; slug: string; paypal_email: string | null; auto_release_hours: number; is_demo: boolean } }) {
  const r = useRouter();
  const [f, setF] = useState({ name: seller.name, paypal_email: seller.paypal_email || "", auto_release_hours: seller.auto_release_hours });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await post("/api/settings", f); setMsg("Saved."); r.refresh(); } catch (e) { setMsg((e as Error).message); } setBusy(false); };
  const reset = async () => { if (!confirm("Reset the demo shop to its 10 sample orders?")) return; setBusy(true); try { await post("/api/demo/reset"); setMsg("Demo reset."); r.refresh(); } catch (e) { setMsg((e as Error).message); } setBusy(false); };
  return (
    <div className="card space-y-4 p-5">
      <div><div className="label mb-1">Shop name</div><input className="input" disabled={seller.is_demo} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><div className="label mb-1">Shop handle</div><input className="input" disabled value={seller.slug} /></div>
      <div><div className="label mb-1">PayPal email for payouts</div><input className="input" disabled={seller.is_demo} placeholder="you@example.com" value={f.paypal_email} onChange={(e) => setF({ ...f, paypal_email: e.target.value })} /><p className="mt-1 text-xs text-mute">In the sandbox build all holds settle to the platform&apos;s sandbox business account. Per-seller payees are on the roadmap (PayPal multiparty).</p></div>
      <div><div className="label mb-1">Auto-release window (hours after shipping)</div><input className="input w-32" type="number" min={1} max={336} value={f.auto_release_hours} onChange={(e) => setF({ ...f, auto_release_hours: Number(e.target.value) })} /><p className="mt-1 text-xs text-mute">If the buyer stays silent this long after you ship, payment releases automatically. Reminders go out at 50% and 85%.</p></div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={busy} onClick={save}>Save</button>
        {seller.is_demo && <button className="btn btn-danger" disabled={busy} onClick={reset}>Reset demo data</button>}
      </div>
      {msg && <div className="text-sm text-brand">{msg}</div>}
    </div>
  );
}
