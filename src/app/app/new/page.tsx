"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "@/components/client";
import type { Item } from "@/lib/types";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"];
const EXAMPLES = ["Invoice Ada $50 for 2 cakes, delivery Friday", "Bill Tunde tunde@example.com 3 tote bags at $25 each, due Oct 20", "Charge Grace €120 for a logo design, delivery in 5 days"];

export default function NewInvoice() {
  const r = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [warn, setWarn] = useState<string[]>([]);
  const [src, setSrc] = useState("");
  const [f, setF] = useState({ buyer_name: "", buyer_email: "", currency: "USD", delivery_date: "", note: "" });
  const [items, setItems] = useState<Item[]>([{ name: "", qty: 1, unit_price: 0 }]);
  const total = Math.round(items.reduce((s, i) => s + i.qty * i.unit_price, 0) * 100) / 100;

  async function parse() {
    setBusy(true); setErr("");
    try {
      const d = await post<{ buyer_name: string; buyer_email: string | null; items: Item[]; amount: number; currency: string; delivery_date: string | null; note: string | null; warnings: string[]; source: string }>("/api/parse", { text });
      setF({ buyer_name: d.buyer_name, buyer_email: d.buyer_email || "", currency: CURRENCIES.includes(d.currency) ? d.currency : "USD", delivery_date: d.delivery_date || "", note: d.note || "" });
      const its = d.items.length ? d.items : [{ name: "Order", qty: 1, unit_price: d.amount }];
      const sum = its.reduce((s, i) => s + i.qty * i.unit_price, 0);
      setItems(Math.abs(sum - d.amount) > 0.01 && d.amount > 0 ? [{ name: its.map((i) => `${i.qty} × ${i.name}`).join(", "), qty: 1, unit_price: d.amount }] : its);
      setWarn(d.warnings); setSrc(d.source);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  async function create() {
    setBusy(true); setErr("");
    try {
      const res = await post<{ order: { id: string } }>("/api/orders", { ...f, buyer_email: f.buyer_email || null, delivery_date: f.delivery_date || null, items: items.filter((i) => i.name), amount: total });
      r.push(`/app/orders/${res.order.id}`); r.refresh();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  const setItem = (k: number, p: Partial<Item>) => setItems(items.map((it, i) => (i === k ? { ...it, ...p } : it)));
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">New invoice</h1>
      <div className="card p-5">
        <div className="label mb-2">✦ Describe it in one sentence</div>
        <div className="flex gap-2">
          <input className="input" placeholder="Invoice Ada $50 for 2 cakes, delivery Friday" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && text && parse()} />
          <button className="btn btn-primary shrink-0" disabled={busy || !text} onClick={parse}>{busy ? "…" : "Fill form"}</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">{EXAMPLES.map((x) => <button key={x} className="rounded-full border border-line px-2.5 py-1 text-xs text-mute hover:text-white" onClick={() => setText(x)}>{x}</button>)}</div>
        {src && <div className="mt-2 text-[11px] text-mute">Parsed by {src === "ai" ? "AI" : "rules fallback"}. Check the fields below.</div>}
        {warn.map((w) => <div key={w} className="mt-2 rounded-lg bg-warn/10 px-3 py-1.5 text-xs text-amber-200">{w}</div>)}
      </div>
      <div className="card space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><div className="label mb-1">Buyer name</div><input className="input" value={f.buyer_name} onChange={(e) => setF({ ...f, buyer_name: e.target.value })} /></div>
          <div><div className="label mb-1">Buyer email (optional)</div><input className="input" value={f.buyer_email} onChange={(e) => setF({ ...f, buyer_email: e.target.value })} /></div>
        </div>
        <div>
          <div className="label mb-1">Items</div>
          <div className="space-y-2">
            {items.map((it, k) => (
              <div key={k} className="grid grid-cols-[1fr_70px_110px_32px] gap-2">
                <input className="input" placeholder="Item" value={it.name} onChange={(e) => setItem(k, { name: e.target.value })} />
                <input className="input" type="number" min={1} value={it.qty} onChange={(e) => setItem(k, { qty: Number(e.target.value) })} />
                <input className="input" type="number" min={0} step="0.01" value={it.unit_price} onChange={(e) => setItem(k, { unit_price: Number(e.target.value) })} />
                <button className="text-mute hover:text-bad" onClick={() => setItems(items.filter((_, i) => i !== k))}>✕</button>
              </div>
            ))}
          </div>
          <button className="mt-2 text-xs text-brand" onClick={() => setItems([...items, { name: "", qty: 1, unit_price: 0 }])}>+ Add item</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><div className="label mb-1">Currency</div><select className="input" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><div className="label mb-1">Delivery date</div><input className="input" type="date" value={f.delivery_date} onChange={(e) => setF({ ...f, delivery_date: e.target.value })} /></div>
          <div><div className="label mb-1">Total</div><div className="py-2 text-xl font-bold">{new Intl.NumberFormat("en-US", { style: "currency", currency: f.currency }).format(total)}</div></div>
        </div>
        <div><div className="label mb-1">Note (optional)</div><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        {err && <div className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-rose-300">{err}</div>}
        <button className="btn btn-primary w-full py-3" disabled={busy || !f.buyer_name || total <= 0} onClick={create}>Create invoice & buyer link</button>
      </div>
    </div>
  );
}
