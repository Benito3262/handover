import Link from "next/link";
import { StatusBadge, RiskBadge, money, ago } from "./ui";
import type { Order } from "@/lib/types";

export function OrdersTable({ orders, title, more }: { orders: Order[]; title: string; more?: boolean }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="font-semibold">{title}</h2>{more && <Link href="/app/orders" className="text-xs text-brand">All orders →</Link>}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-mute"><tr><th className="px-5 py-2 font-medium">#</th><th className="font-medium">Buyer</th><th className="font-medium">Items</th><th className="font-medium">Amount</th><th className="font-medium">Status</th><th className="pr-5 font-medium">Updated</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-line hover:bg-white/[.02]">
                <td className="px-5 py-2.5"><Link href={`/app/orders/${o.id}`} className="font-semibold text-brand">#{o.number}</Link></td>
                <td><Link href={`/app/orders/${o.id}`}>{o.buyer_name}</Link> <RiskBadge flags={o.risk} /></td>
                <td className="max-w-[220px] truncate text-mute">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</td>
                <td className="font-semibold">{money(o.amount, o.currency)}</td>
                <td><StatusBadge status={o.status} /></td>
                <td className="pr-5 text-xs text-mute">{ago(o.updated_at)}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-mute">No orders yet. <Link href="/app/new" className="text-brand">Create your first invoice</Link>.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
