import Link from "next/link";
import { currentSeller } from "@/lib/auth";
import { sellerOrders } from "@/lib/orders";
import { OrdersTable } from "@/components/OrdersTable";

const FILTERS = [["all", "All"], ["created", "Awaiting payment"], ["held", "Paid & held"], ["shipped", "Shipped"], ["delivered", "Delivered"], ["disputed", "In dispute"], ["settled", "Settled"], ["refunded", "Refunded"]];

export default async function Orders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "all" } = await searchParams;
  const seller = (await currentSeller())!;
  const all = await sellerOrders(seller.id);
  const orders = status === "all" ? all : all.filter((o) => o.status === status || (status === "settled" && o.status === "partially_settled"));
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Orders</h1><Link href="/app/new" className="btn btn-primary">+ New invoice</Link></div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([k, l]) => {
          const n = k === "all" ? all.length : all.filter((o) => o.status === k || (k === "settled" && o.status === "partially_settled")).length;
          return <Link key={k} href={`/app/orders?status=${k}`} className={`rounded-full border px-3 py-1 text-xs font-semibold ${status === k ? "border-brand bg-brand/10 text-brand" : "border-line text-mute hover:text-white"}`}>{l} · {n}</Link>;
        })}
      </div>
      <OrdersTable orders={orders} title={`${orders.length} order(s)`} />
    </div>
  );
}
