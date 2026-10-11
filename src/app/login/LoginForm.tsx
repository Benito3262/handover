"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/ui";
import { post } from "@/components/client";

export function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ handle: "", passcode: "", name: "", email: "" });
  const auto = useRef(false);

  async function demo() {
    setBusy(true); setErr("");
    try { await post("/api/auth/demo"); router.push("/app"); router.refresh(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  useEffect(() => { if (sp.get("demo") === "1" && !auto.current) { auto.current = true; demo(); } }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      await post(tab === "in" ? "/api/auth/login" : "/api/auth/signup", tab === "in" ? { handle: f.handle, passcode: f.passcode } : f);
      router.push("/app"); router.refresh();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <main className="glow grid min-h-screen place-items-center px-5">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="card p-6">
          <button onClick={demo} disabled={busy} className="btn btn-primary w-full py-3">{busy && sp.get("demo") ? "Opening demo shop…" : "Enter the demo shop (no sign-up)"}</button>
          <p className="mt-2 text-center text-xs text-mute">Seeded with 10 orders in every state. Or sign in with handle <code>demo</code> / passcode <code>demo1234</code>.</p>
          <div className="my-6 flex items-center gap-3 text-xs text-mute"><div className="h-px flex-1 bg-line" />or<div className="h-px flex-1 bg-line" /></div>
          <div className="mb-4 grid grid-cols-2 rounded-lg border border-line p-1 text-sm">
            {(["in", "up"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-md py-1.5 font-semibold ${tab === t ? "bg-panel2 text-white" : "text-mute"}`}>{t === "in" ? "Sign in" : "Create a shop"}</button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-3">
            {tab === "up" && <input className="input" placeholder="Shop name, e.g. Ada's Bakes" value={f.name} onChange={set("name")} required />}
            <input className="input" placeholder="Shop handle, e.g. adas-bakes" value={f.handle} onChange={set("handle")} required />
            {tab === "up" && <input className="input" type="email" placeholder="Email (optional)" value={f.email} onChange={set("email")} />}
            <input className="input" type="password" placeholder="Passcode" value={f.passcode} onChange={set("passcode")} required />
            {err && <div className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-rose-300">{err}</div>}
            <button disabled={busy} className="btn btn-ghost w-full">{tab === "in" ? "Sign in" : "Create shop"}</button>
          </form>
        </div>
      </div>
    </main>
  );
}
