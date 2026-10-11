"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { post, fileToDataUrl } from "./client";
import type { Evidence, Message } from "@/lib/types";

const who = (a: string, me: string) => (a === me ? "You" : a === "ai" ? "Handover AI" : a === "seller" ? "Seller" : a === "buyer" ? "Buyer" : "System");

export function Thread({ messages, evidence, me, endpoint, initialDraft }: { messages: Message[]; evidence: Evidence[]; me: "seller" | "buyer"; endpoint: string; initialDraft?: string }) {
  const r = useRouter();
  const [text, setText] = useState(initialDraft || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const items = [
    ...messages.map((m) => ({ t: m.created_at, kind: "m" as const, m })),
    ...evidence.map((e) => ({ t: e.created_at, kind: "e" as const, e })),
  ].sort((a, b) => a.t.localeCompare(b.t));

  async function send() {
    if (!text.trim()) return;
    setBusy(true); setErr("");
    try { await post(endpoint, { action: "message", body: text }); setText(""); r.refresh(); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  async function photo(f: File | undefined) {
    if (!f) return;
    setBusy(true); setErr("");
    try { await post(endpoint, { action: "evidence", image_data: await fileToDataUrl(f), caption: text || null }); setText(""); r.refresh(); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  return (
    <div className="card p-5">
      <h3 className="mb-3 font-semibold">Messages & evidence</h3>
      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
        {items.length === 0 && <p className="text-sm text-mute">No messages yet.</p>}
        {items.map((it, i) => {
          const author = it.kind === "m" ? it.m.author : it.e.author;
          const mine = author === me;
          return (
            <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-brand/15" : author === "ai" ? "border border-brand2/30 bg-brand2/10" : "bg-panel2"}`}>
                <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-mute">{who(author, me)} · {new Date(it.t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                {it.kind === "m" ? <div className="whitespace-pre-line">{it.m.body}</div> : (
                  <div>
                    <div className="text-xs font-semibold text-brand">{it.e.kind === "photo" ? "📷 Photo evidence" : it.e.kind === "tracking" ? "📦 Tracking" : "📝 Note"}</div>
                    {it.e.image_data && <img src={it.e.image_data} alt="evidence" className="mt-1.5 max-h-60 rounded-lg" />}
                    {it.e.caption && <div className="mt-1">{it.e.caption}</div>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 space-y-2">
        <textarea className="input min-h-[70px]" placeholder={`Message the ${me === "seller" ? "buyer" : "seller"}…`} value={text} onChange={(e) => setText(e.target.value)} />
        {err && <div className="text-xs text-rose-300">{err}</div>}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy || !text.trim()} onClick={send}>Send</button>
          <label className="btn btn-ghost">📷 Add photo<input type="file" accept="image/*" className="hidden" onChange={(e) => photo(e.target.files?.[0])} /></label>
        </div>
      </div>
    </div>
  );
}
