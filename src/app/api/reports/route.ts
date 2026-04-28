export const runtime = "nodejs"; // needs more memory for AI generation
export const maxDuration = 60; // allow up to 60s for Gemini generation

import { createClient } from "@supabase/supabase-js";
import { generateRetrospective, saveReport, loadReports, deleteReport } from "@/lib/bot/retrospective";
import { getEffectiveTier, TIER_INFO } from "@/lib/stars/paywall";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

function jwt(req: Request) {
  const a = req.headers.get("Authorization");
  return a?.startsWith("Bearer ") ? a.slice(7) : null;
}

// Use user JWT to get the profile id (respects RLS)
function userDb(token: string) {
  return createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

// GET — list reports
export async function GET(req: Request) {
  const token = jwt(req);
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = userDb(token);
  const { data: profile, error: profileErr } = await db.from("profiles").select("id").single();
  if (profileErr || !profile) {
    console.error("[reports GET] profile lookup failed:", profileErr?.message);
    return Response.json({ reports: [] });
  }

  // Apply historyDays cutoff based on user's tier
  const tier = await getEffectiveTier(profile.id);
  const historyDays = TIER_INFO[tier].limits.historyDays;
  const cutoff = historyDays !== Infinity
    ? new Date(Date.now() - historyDays * 86_400_000).toISOString()
    : null;

  const reports = await loadReports(profile.id, cutoff ?? undefined);
  return Response.json({ reports });
}

// POST — generate a new report
export async function POST(req: Request) {
  const token = jwt(req);
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 30 writes/min per JWT
  const rl = rateLimit(`reports:write:${token.slice(0, 16)}`, 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const body = await req.json().catch(() => ({}));
  const { period_type = "weekly", from, to } = body;

  const db = userDb(token);
  const { data: profile, error: profileErr } = await db.from("profiles").select("id, settings").single();
  if (profileErr || !profile) {
    console.error("[reports POST] profile lookup failed:", profileErr?.message);
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }
  const userLocale = (profile.settings as Record<string, unknown>)?.language as string ?? 'uk';

  // Enforce tier limits — free tier gets 5 reports per month
  const tier = await getEffectiveTier(profile.id);
  const limits = TIER_INFO[tier].limits;

  // Count reports created this calendar month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count } = await db
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .gte("created_at", monthStart.toISOString());

  if (limits.reports !== Infinity && (count ?? 0) >= limits.reports) {
    return new Response(JSON.stringify({
      error: "limit_exceeded",
      feature: tier === "free" ? "ai_reports" : "reports",
      limit: limits.reports,
      current: count,
      required_tier: tier === "free" ? "stars_basic" : "stars_pro",
    }), { status: 402, headers: { "Content-Type": "application/json" } });
  }

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

  console.log(`[reports POST] generating ${period_type} for user ${profile.id}, from=${fromDate.toISOString()} to=${toDate.toISOString()}`);

  try {
    const report = await generateRetrospective(profile.id, period_type, fromDate, toDate, userLocale as import('@/i18n/locales').Locale);
    if (!report) {
      return Response.json({ error: "not_enough_entries" }, { status: 422 });
    }

    const id = await saveReport(profile.id, report);
    return Response.json({ report: { ...report, id } }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[reports POST] generation error:", message);
    return Response.json({ error: "generation_failed", detail: message }, { status: 500 });
  }
}

// DELETE — remove a report
export async function DELETE(req: Request) {
  const token = jwt(req);
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id } = body;
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const db = userDb(token);
  const { data: profile } = await db.from("profiles").select("id").single();
  if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

  await deleteReport(profile.id, id);
  return Response.json({ ok: true });
}
