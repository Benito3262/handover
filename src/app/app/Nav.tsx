"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { post } from "@/components/client";

const LINKS = [
  ["/app", "Dashboard", "◧"],
  ["/app/assistant", "Assistant", "✦"],
  ["/app/new", "New invoice", "+"],
  ["/app/orders", "Orders", "≡"],
  ["/app/notifications", "Notifications", "◔"],
  ["/app/settings", "Settings", "⚙"],
] as const;

export function Nav({ unread }: { unread: number }) {
  const p = usePathname();
  return (
    <nav className="mt-3 flex gap-1 overflow-x-auto md:flex-col">
      {LINKS.map(([href, label, icon]) => {
        const active = href === "/app" ? p === "/app" : p.startsWith(href);
        return (
          <Link key={href} href={href} className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-brand/10 text-brand" : "text-mute hover:bg-white/5 hover:text-white"}`}>
            <span className="w-4 text-center">{icon}</span>{label}
            {label === "Notifications" && unread > 0 && <span className="ml-auto rounded-full bg-brand px-1.5 text-[10px] font-bold text-ink">{unread}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function SignOut() {
  const r = useRouter();
  return <button className="text-xs text-mute hover:text-white" onClick={async () => { await post("/api/auth/logout"); r.push("/"); r.refresh(); }}>Sign out</button>;
}
