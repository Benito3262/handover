import { env, dbConfigured } from "./env";

// Minimal PostgREST client. Every request carries the secret x-handover-key header;
// RLS in Postgres rejects anything without it (see supabase/schema.sql).
type Q = Record<string, string | number | boolean | undefined>;

function headers(extra: Record<string, string> = {}) {
  return {
    apikey: env.supabaseKey,
    Authorization: `Bearer ${env.supabaseKey}`,
    "x-handover-key": env.dbKey,
    "Content-Type": "application/json",
    ...extra,
  };
}

function url(table: string, q: Q = {}) {
  const u = new URL(`${env.supabaseUrl}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(q)) if (v !== undefined) u.searchParams.set(k, String(v));
  return u.toString();
}

async function check(res: Response) {
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`DB ${res.status}: ${t.slice(0, 300)}`);
  }
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

export function assertDb() {
  if (!dbConfigured()) throw new Error("Database not configured: set SUPABASE_URL, SUPABASE_ANON_KEY and HANDOVER_DB_KEY");
}

export async function select<T>(table: string, q: Q = {}): Promise<T[]> {
  assertDb();
  const res = await fetch(url(table, { select: "*", ...q }), { headers: headers(), cache: "no-store" });
  return (await check(res)) as T[];
}

export async function one<T>(table: string, q: Q = {}): Promise<T | null> {
  const rows = await select<T>(table, { ...q, limit: 1 });
  return rows[0] ?? null;
}

export async function insert<T>(table: string, row: object | object[]): Promise<T[]> {
  assertDb();
  const res = await fetch(url(table), {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(row),
    cache: "no-store",
  });
  return (await check(res)) as T[];
}

export async function update<T>(table: string, q: Q, patch: object): Promise<T[]> {
  assertDb();
  const res = await fetch(url(table, q), {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  return (await check(res)) as T[];
}

export async function remove(table: string, q: Q): Promise<void> {
  assertDb();
  const res = await fetch(url(table, q), { method: "DELETE", headers: headers(), cache: "no-store" });
  await check(res);
}
