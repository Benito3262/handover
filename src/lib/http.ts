import { NextResponse } from "next/server";
import { currentSeller } from "./auth";

export const ok = (data: unknown = { ok: true }) => NextResponse.json(data);
export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function withSeller<T>(fn: (seller: NonNullable<Awaited<ReturnType<typeof currentSeller>>>) => Promise<T>) {
  try {
    const seller = await currentSeller();
    if (!seller) return fail("Please sign in", 401);
    return ok(await fn(seller));
  } catch (e) {
    return fail((e as Error).message);
  }
}

export function baseUrl(req: Request) {
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}
