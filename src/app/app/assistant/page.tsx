"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { post } from "@/components/client";

type Msg = { role: "user" | "assistant"; content: string; actions?: { kind: string; label: string; href?: string; text?: string }[]; source?: string };
const SUGGEST = ["Invoice Ada $50 for 2 cakes, delivery Friday", "Who hasn't paid?", "Show held money", "Remind Ada", "Mark order 5 shipped, DHL 1234567890", "Draft a reply to the dispute", "Summarize this week"];

export default function Assistant() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { const s = sessionStorage.getItem("ho_chat"); if (s) setMsgs(JSON.parse(s)); } catch {} }, []);
  useEffect(() => { sessionStorage.setItem("ho_chat", JSON.stringify(msgs.slice(-30))); end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send(t = text) {
    if (!t.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, content: t }];
    setMsgs(next); setText(""); setBusy(true);
    try {
      const r = await post<{ reply: string; actions: Msg["actions"]; source: string }>("/api/assistant", { messages: next.map(({ role, content }) => ({ role, content })) });
      setMsgs([...next, { role: "assistant", content: r.reply, actions: r.actions, source: r.source }]);
    } catch (e) { setMsgs([...next, { role: "assistant", content: (e as Error).message }]); }
    setBusy(false);
  }
  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">✦ Assistant</h1>{msgs.length > 0 && <button className="text-xs text-mute hover:text-white" onClick={() => setMsgs([])}>Clear chat</button>}</div>
      <p className="text-sm text-mute">Run your shop by chat. It works on your real orders.</p>
      <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-line bg-panel/50 p-4">
        {msgs.length === 0 && (
          <div className="grid h-full place-items-center text-center">
            <div><div className="text-4xl">✦</div><p className="mt-2 text-sm text-mute">Try one of these:</p>
              <div className="mt-3 flex max-w-lg flex-wrap justify-center gap-2">{SUGGEST.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-brand hover:text-brand">{s}</button>)}</div>
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-brand/15" : "bg-panel2"}`}>
              <div className="whitespace-pre-line break-words">{m.content}</div>
              {m.actions && m.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.actions.map((a, k) => a.kind === "draft" ? (
                    <Link key={k} href={a.href || "#"} className="rounded-lg border border-brand2/40 px-2 py-1 text-xs text-brand2">{a.label} →</Link>
                  ) : a.kind === "buyer_link" ? (
                    <button key={k} onClick={() => navigator.clipboard.writeText(a.href!)} className="rounded-lg border border-line px-2 py-1 text-xs text-mute hover:text-white">Copy buyer link</button>
                  ) : (
                    <Link key={k} href={a.href!} className="rounded-lg border border-brand/40 px-2 py-1 text-xs text-brand">{a.label} →</Link>
                  ))}
                </div>
              )}
              {m.source && <div className="mt-1 text-[10px] uppercase tracking-wider text-mute">{m.source === "ai" ? "AI · tool calls on your data" : "rules mode"}</div>}
            </div>
          </div>
        ))}
        {busy && <div className="text-sm text-mute">Working…</div>}
        <div ref={end} />
      </div>
      <div className="mt-3 flex gap-2">
        <input className="input" placeholder="Tell Handover what to do…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="btn btn-primary" disabled={busy || !text.trim()} onClick={() => send()}>Send</button>
      </div>
      {msgs.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{SUGGEST.slice(1).map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-mute hover:text-white">{s}</button>)}</div>}
    </div>
  );
}
