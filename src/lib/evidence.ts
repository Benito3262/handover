import { insert } from "./db";
import * as O from "./orders";

export async function addEvidence(o: { id: string; seller_id: string; number: number }, author: "seller" | "buyer", body: { caption?: string; image_data?: string; kind?: string }) {
  const img = body.image_data ? String(body.image_data) : null;
  if (img && (!/^data:image\/(jpeg|png|webp);base64,/.test(img) || img.length > 600_000)) throw new Error("Photo must be a JPEG/PNG under ~400KB");
  if (!img && !body.caption) throw new Error("Add a photo or a note");
  await insert("ho_evidence", { order_id: o.id, author, kind: img ? "photo" : body.kind === "tracking" ? "tracking" : "note", caption: body.caption ? String(body.caption).slice(0, 500) : null, image_data: img });
  await O.logEvent(o, o.seller_id, "evidence", author, `${author === "seller" ? "Seller" : "Buyer"} added ${img ? "a photo" : "a note"} to #${o.number}.`);
  return { ok: true };
}

