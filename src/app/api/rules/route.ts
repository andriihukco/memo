export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { CustomRule } from "@/lib/bot/teach";

function jwt(req: Request) {
  const a = req.headers.get("Authorization");
  return a?.startsWith("Bearer ") ? a.slice(7) : null;
}

function userDb(token: string) {
  return createClient(process.env.SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

function serviceDb() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

// GET — list rules
export async function GET(req: Request) {
  const token = jwt(req);
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = userDb(token);
  const { data: profile } = await db.from("profiles").select("id, settings").single();
  if (!profile) return Response.json({ rules: [] });
  const rules = (profile.settings?.custom_rules as CustomRule[]) ?? [];
  return Response.json({ rules });
}

// POST — add a new rule
export async function POST(req: Request) {
  const token = jwt(req);
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { instruction } = await req.json().catch(() => ({}));
  if (!instruction?.trim()) return Response.json({ error: "Missing instruction" }, { status: 400 });

  const db = userDb(token);
  const { data: profile } = await db.from("profiles").select("id, settings").single();
  if (!profile) return Response.json({ error: "Not found" }, { status: 404 });

  const existing = (profile.settings?.custom_rules as CustomRule[]) ?? [];
  const newRule: CustomRule = {
    id: crypto.randomUUID(),
    instruction: instruction.trim(),
    created_at: new Date().toISOString(),
  };
  const updated = [...existing, newRule];

  const svc = serviceDb();
  await svc.from("profiles").update({
    settings: { ...(profile.settings ?? {}), custom_rules: updated },
  }).eq("id", profile.id);

  return Response.json({ rule: newRule });
}

// DELETE — remove a rule by id
export async function DELETE(req: Request) {
  const token = jwt(req);
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const db = userDb(token);
  const { data: profile } = await db.from("profiles").select("id, settings").single();
  if (!profile) return Response.json({ error: "Not found" }, { status: 404 });

  const existing = (profile.settings?.custom_rules as CustomRule[]) ?? [];
  const updated = existing.filter((r) => r.id !== id);

  const svc = serviceDb();
  await svc.from("profiles").update({
    settings: { ...(profile.settings ?? {}), custom_rules: updated },
  }).eq("id", profile.id);

  return Response.json({ ok: true });
}
