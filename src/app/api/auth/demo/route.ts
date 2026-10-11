import { setSession } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { getOrCreateDemoSeller } from "@/lib/seed";

export async function POST() {
  try {
    const s = await getOrCreateDemoSeller();
    await setSession(s.id);
    return ok();
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
