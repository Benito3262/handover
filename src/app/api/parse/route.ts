import { aiParseInvoice } from "@/lib/ai";
import { withSeller } from "@/lib/http";

export async function POST(req: Request) {
  const { text } = await req.json();
  return withSeller(async () => aiParseInvoice(String(text || "").slice(0, 800)));
}
