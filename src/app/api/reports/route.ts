export const runtime = "nodejs"; // needs more memory for AI generation

import { createClient } from "@supabase/supabase-js";
import { generateRetrospective, saveReport, loadReports, deleteReport } from "@/lib/bot/retrospective";

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

// GET — list reports
export async function GET(req: Request) {
  const token = jwt(req);
  if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  const db = userDb(token);
  const { data: profile } = await db.from("profiles").select("id").single();
  if (!profile) return new Response(JSON.stringify({ reports: [] }), { status: 200, headers: { "Content-Type": "application/json" } });

  const reports = await loadReports(profile.id);
  return new Response(JSON.stringify({ reports }), { status: 200, headers: { "Content-Type": "application/json" } });
}

// POST — generate a new report
export async function POST(req: Request) {
  const token = jwt(req);
  if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  const body = await req.json().catch(() => ({}));
  const { period_type = "weekly", from, to } = body;

  const db = userDb(token);
  const { data: profile } = await db.from("profiles").select("id").single();
  if (!profile) return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers: { "Content-Type": "application/json" } });

  const now = new Date();
  let fromDate: Date, toDate: Date;

  if (from && to) {
    fromDate = new Date(from);
    toDate = new Date(to);
  } else if (period_type === "daily") {
    fromDate = new Date(now); fromDate.setHours(0,0,0,0);
    toDate = new Date(now); toDate.setHours(23,59,59,999);
  } else if (period_type === "weekly") {
    fromDate = new Date(now); fromDate.setDate(now.getDate() - 7); fromDate.setHours(0,0,0,0);
    toDate = now;
  } else {
    fromDate = new Date(now); fromDate.setDate(1); fromDate.setHours(0,0,0,0);
    toDate = now;
  }

  const report = await generateRetrospective(profile.id, period_type, fromDate, toDate);
  if (!report) {
    return new Response(JSON.stringify({ error: "Not enough data for this period" }), { status: 422, headers: { "Content-Type": "application/json" } });
  }

  const id = await saveReport(profile.id, report);
  return new Response(JSON.stringify({ report: { ...report, id } }), { status: 201, headers: { "Content-Type": "application/json" } });
}

// DELETE — remove a report
export async function DELETE(req: Request) {
  const token = jwt(req);
  if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  const body = await req.json().catch(() => ({}));
  const { id } = body;
  if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: { "Content-Type": "application/json" } });

  const db = userDb(token);
  const { data: profile } = await db.from("profiles").select("id").single();
  if (!profile) return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers: { "Content-Type": "application/json" } });

  await deleteReport(profile.id, id);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}
