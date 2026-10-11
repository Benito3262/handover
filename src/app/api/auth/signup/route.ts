import { insert, one } from "@/lib/db";
import { hashPasscode, setSession } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import type { Seller } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const { name, handle, email, passcode } = await req.json();
    const slug = String(handle || "").toLowerCase().trim();
    if (!name?.trim()) return fail("Shop name is required");
    if (!/^[a-z0-9-]{3,30}$/.test(slug)) return fail("Handle: 3-30 letters, numbers or dashes");
    if (String(passcode || "").length < 6) return fail("Passcode needs at least 6 characters");
    if (slug === "demo" || (await one<Seller>("ho_sellers", { slug: `eq.${slug}` }))) return fail("That handle is taken");
    const [s] = await insert<Seller>("ho_sellers", { slug, name: name.trim(), email: email || null, passcode_hash: hashPasscode(passcode) });
    await setSession(s.id);
    return ok();
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
