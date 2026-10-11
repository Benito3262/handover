import { one } from "@/lib/db";
import { setSession, verifyPasscode } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import type { Seller } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const { handle, passcode } = await req.json();
    const s = await one<Seller>("ho_sellers", { slug: `eq.${String(handle || "").toLowerCase().trim()}` });
    if (!s || !verifyPasscode(String(passcode || ""), s.passcode_hash)) return fail("Wrong shop handle or passcode", 401);
    await setSession(s.id);
    return ok();
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
