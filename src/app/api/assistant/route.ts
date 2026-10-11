import { runAssistant } from "@/lib/agent";
import { baseUrl, withSeller } from "@/lib/http";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const history = (Array.isArray(messages) ? messages : [])
    .filter((m: { role: string; content: string }) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m: { role: "user" | "assistant"; content: string }) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  return withSeller((seller) => runAssistant(seller, history, baseUrl(req)));
}
