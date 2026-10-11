import { select } from "@/lib/db";
import { env } from "@/lib/env";
import { sweep } from "@/lib/orders";
import { fail, ok } from "@/lib/http";
import type { Seller } from "@/lib/types";

// Daily Vercel cron (Hobby plan allows daily). The app also sweeps lazily
// whenever a seller opens the dashboard, so reminders/auto-release don't wait for cron.
export async function GET(req: Request) {
  if (env.cronSecret && req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) return fail("unauthorized", 401);
  const sellers = await select<Seller>("ho_sellers", { select: "*" });
  const out: Record<string, string[]> = {};
  for (const s of sellers) out[s.slug] = await sweep(s);
  return ok(out);
}
