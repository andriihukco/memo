export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { ReportSchedule } from "@/lib/bot/retrospective";

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

const DEFAULT_SCHEDULE: ReportSchedule = { daily: false, weekly: true, monthly: true, time: "09:00" };

// GET
export async function GET(req: Request) {
  const token = jwt(req);
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = userDb(token);
  const { data: profile } = await db.from("profiles").select("settings").single();
  const schedule = (profile?.settings?.report_schedule as ReportSchedule) ?? DEFAULT_SCHEDULE;
  return Response.json({ schedule });
}

// PATCH — update schedule fields
export async function PATCH(req: Request) {
  const token = jwt(req);
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const db = userDb(token);
  const { data: profile } = await db.from("profiles").select("id, settings").single();
  if (!profile) return Response.json({ error: "Not found" }, { status: 404 });

  const current = (profile.settings?.report_schedule as ReportSchedule) ?? DEFAULT_SCHEDULE;
  const updated: ReportSchedule = {
    daily:   body.daily   !== undefined ? body.daily   : current.daily,
    weekly:  body.weekly  !== undefined ? body.weekly  : current.weekly,
    monthly: body.monthly !== undefined ? body.monthly : current.monthly,
    time:    body.time    ?? current.time,
  };

  const svc = serviceDb();
  await svc.from("profiles").update({
    settings: { ...(profile.settings ?? {}), report_schedule: updated },
  }).eq("id", profile.id);

  return Response.json({ schedule: updated });
}
