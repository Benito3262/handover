"use client";
import { useEffect, useState } from "react";
import { post } from "@/components/client";

export function WeeklySummary() {
  const [d, setD] = useState<{ text: string; source: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => { setBusy(true); try { setD(await post("/api/summary")); } catch (e) { setD({ text: (e as Error).message, source: "error" }); } setBusy(false); };
  useEffect(() => { post<{ text: string; source: string }>("/api/summary").then(setD, (e) => setD({ text: e.message, source: "error" })); }, []);
  return (
    <div className="card bg-gradient-to-br from-brand/[.06] to-transparent p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">✦ Weekly business summary</h2>
        <button onClick={load} disabled={busy} className="text-xs text-brand">{busy ? "Thinking…" : "Refresh"}</button>
      </div>
      {!d ? <div className="h-16 animate-pulse rounded-lg bg-white/5" /> : <p className="whitespace-pre-line text-sm text-slate-200">{d.text}</p>}
      {d && <div className="mt-2 text-[10px] uppercase tracking-wider text-mute">{d.source === "ai" ? "Written by AI from your orders" : "Computed from your orders"}</div>}
    </div>
  );
}
