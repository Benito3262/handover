import Link from "next/link";
import type { OrderStatus, RiskFlag } from "@/lib/types";

const STATUS: Record<string, { label: string; cls: string }> = {
  created: { label: "Awaiting payment", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  held: { label: "Paid & held", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  shipped: { label: "Shipped", cls: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
  delivered: { label: "Delivered", cls: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
  disputed: { label: "In dispute", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  settled: { label: "Settled", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  partially_settled: { label: "Partly settled", cls: "bg-emerald-500/10 text-emerald-200 border-emerald-500/20" },
  refunded: { label: "Refunded", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  cancelled: { label: "Cancelled", cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
};

export function StatusBadge({ status }: { status: OrderStatus | string }) {
  const s = STATUS[status] ?? STATUS.created;
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

export function RiskBadge({ flags }: { flags: RiskFlag[] | null }) {
  if (!flags?.length) return null;
  const high = flags.some((f) => f.level === "high");
  const med = flags.some((f) => f.level === "medium");
  if (!high && !med) return null;
  return (
    <span title={flags.map((f) => f.message).join("\n")} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${high ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"}`}>
      ⚑ {high ? "High risk" : "Check"}
    </span>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-bold tracking-tight">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand2 text-[13px] font-black text-ink">H</span>
      <span>Handover</span>
    </Link>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "brand" | "warn" | "blue" }) {
  const c = tone === "brand" ? "text-brand" : tone === "warn" ? "text-warn" : tone === "blue" ? "text-brand2" : "text-white";
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${c}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-mute">{sub}</div>}
    </div>
  );
}

export function DemoPaymentBanner() {
  return (
    <div className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm text-amber-200">
      <b>Demo payment, PayPal sandbox not connected.</b> Payments, holds and releases are simulated with fake authorization IDs. Add <code className="text-amber-100">PAYPAL_CLIENT_ID</code> and <code className="text-amber-100">PAYPAL_CLIENT_SECRET</code> to switch to the real PayPal sandbox automatically.
    </div>
  );
}

export const money = (v: number | string, c = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(Number(v));
  } catch {
    return `${c} ${Number(v).toFixed(2)}`;
  }
};

export const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
