import type { Order } from "@/lib/types";

// The visual progression of an order through the escrow-style flow.
export function Timeline({ o }: { o: Order }) {
  const end =
    o.status === "refunded" ? { label: "Refunded", at: o.settled_at, bad: true }
    : o.status === "partially_settled" ? { label: "Partly settled", at: o.settled_at }
    : o.status === "cancelled" ? { label: "Cancelled", at: o.updated_at, bad: true }
    : { label: "Settled", at: o.settled_at };
  const steps = [
    { label: "Created", at: o.created_at },
    { label: "Paid & held", at: o.authorized_at },
    { label: "Shipped", at: o.shipped_at },
    o.status === "disputed" || o.dispute
      ? { label: "In dispute", at: o.dispute?.raised_at ?? null, warn: true }
      : { label: "Delivered", at: o.buyer_confirmed_at },
    end,
  ] as { label: string; at: string | null; warn?: boolean; bad?: boolean }[];
  const lastDone = steps.reduce((i, s, idx) => (s.at ? idx : i), 0);
  return (
    <ol className="flex w-full items-start">
      {steps.map((s, i) => {
        const done = !!s.at || i <= lastDone && i === 0;
        const color = s.bad && done ? "bg-bad" : s.warn && done ? "bg-warn" : done ? "bg-brand" : "bg-line";
        return (
          <li key={s.label} className="flex flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : i <= lastDone ? "bg-brand/60" : "bg-line"}`} />
              <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${color} ${done ? "text-ink" : "text-mute"}`}>{done ? "✓" : i + 1}</div>
              <div className={`h-0.5 flex-1 ${i === steps.length - 1 ? "opacity-0" : i < lastDone ? "bg-brand/60" : "bg-line"}`} />
            </div>
            <div className={`mt-1.5 text-[11px] font-semibold sm:text-xs ${done ? "text-white" : "text-mute"}`}>{s.label}</div>
            {s.at && <div className="text-[10px] text-mute">{new Date(s.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>}
          </li>
        );
      })}
    </ol>
  );
}
