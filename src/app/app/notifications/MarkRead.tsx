"use client";
import { useRouter } from "next/navigation";
import { post } from "@/components/client";
export function MarkRead() {
  const r = useRouter();
  return <button className="btn btn-ghost" onClick={async () => { await post("/api/notifications"); r.refresh(); }}>Mark all read</button>;
}
