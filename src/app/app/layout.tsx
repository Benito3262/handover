import { redirect } from "next/navigation";
import Link from "next/link";
import { currentSeller } from "@/lib/auth";
import { sweep } from "@/lib/orders";
import { select } from "@/lib/db";
import { paypalConfigured } from "@/lib/env";
import { Logo, DemoPaymentBanner } from "@/components/ui";
import { Nav, SignOut } from "./Nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const seller = await currentSeller();
  if (!seller) redirect("/login");
  // Lazy sweep: reminders, auto-release and hold warnings run whenever the seller opens the app.
  await sweep(seller).catch(() => []);
  const unread = (await select("ho_order_events", { seller_id: `eq.${seller.id}`, read: "eq.false", select: "id", limit: 99 }).catch(() => [])).length;
  return (
    <div className="min-h-screen md:grid md:grid-cols-[230px_1fr]">
      <aside className="border-b border-line bg-panel/60 p-4 md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
        <div className="flex items-center justify-between md:block">
          <Logo href="/app" />
          <div className="md:mt-6 md:mb-4">
            <div className="hidden text-xs text-mute md:block">Signed in as</div>
            <div className="hidden truncate text-sm font-semibold md:block">{seller.name}</div>
          </div>
        </div>
        <Nav unread={unread} />
        <div className="mt-6 hidden space-y-2 md:block">
          <Link href="/judges" className="block text-xs text-mute hover:text-white">Judge quick start ↗</Link>
          <SignOut />
        </div>
      </aside>
      <main className="min-w-0 p-4 md:p-8">
        {!paypalConfigured() && <div className="mb-5"><DemoPaymentBanner /></div>}
        {children}
      </main>
    </div>
  );
}
