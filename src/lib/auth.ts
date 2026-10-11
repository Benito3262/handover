import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { env } from "./env";
import { one } from "./db";
import type { Seller } from "./types";

const COOKIE = "ho_session";

export function hashPasscode(pass: string) {
  const salt = randomBytes(12).toString("hex");
  const h = scryptSync(pass, salt, 32).toString("hex");
  return `${salt}:${h}`;
}

export function verifyPasscode(pass: string, stored: string) {
  const [salt, h] = stored.split(":");
  if (!salt || !h) return false;
  const test = scryptSync(pass, salt, 32);
  const want = Buffer.from(h, "hex");
  return want.length === test.length && timingSafeEqual(test, want);
}

function sign(v: string) {
  return createHmac("sha256", env.sessionSecret).update(v).digest("base64url");
}

export async function setSession(sellerId: string) {
  const v = `${sellerId}.${Date.now()}`;
  const jar = await cookies();
  jar.set(COOKIE, `${v}.${sign(v)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function currentSeller(): Promise<Seller | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const v = `${parts[0]}.${parts[1]}`;
  const a = Buffer.from(sign(v));
  const b = Buffer.from(parts[2]);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return await one<Seller>("ho_sellers", { id: `eq.${parts[0]}` });
  } catch {
    return null;
  }
}

export function token(n = 10) {
  return randomBytes(n).toString("base64url");
}
