/**
 * /api/cron/reports — Daily cron at 09:00 UTC
 *
 * Responsibilities:
 * 1. Deliver scheduled paid reports to users who have enabled auto-reports
 *    in profiles.settings.report_schedule.
 * 2. Every Monday (getDay() === 1): deliver a free weekly summary to all users
 *    who have ≥5 entries in the past 7 days and have not already received a
 *    summary this week (deduplication via notifications_log type='weekly_summary').
 *    Paid users who already have a scheduled report for today are skipped to
 *    avoid duplicate messages.
 *
 * Protected by CRON_SECRET (Authorization: Bearer <secret>).
 */

export const runtime = "nodejs";
export const maxDuration = 300; // up to 5 min for bulk AI generation

import { createClient } from "@supabase/supabase-js";
import { generateRetrospective, generateWeeklySummary, saveReport } from "@/lib/bot/retrospective";
import { deriveUserKey, decryptField } from "@/lib/crypto";
import { env } from "@/lib/env";

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export async function GET(req: Request): Promise<Response> {
  // Verify Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const results = {
    scheduled_reports: 0,
    weekly_summaries: 0,
    skipped: 0,
    errors: 0,
  };

  const isMonday = new Date().getDay() === 1;

  try {
    // ── 1. Deliver scheduled paid reports ──────────────────────────────────────
    await deliverScheduledReports(results);

    // ── 2. Deliver weekly summaries on Mondays ─────────────────────────────────
    if (isMonday) {
      await deliverWeeklySummaries(results);
    }

    return Response.json({ ok: true, isMonday, ...results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/reports] Fatal error:", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

// ── Scheduled paid reports ─────────────────────────────────────────────────────

async function deliverScheduledReports(results: { scheduled_reports: number; errors: number; skipped: number; weekly_summaries: number }): Promise<void> {
  const supabase = getServiceClient();
  const now = new Date();
  const todayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][now.getDay()];

  // Fetch profiles with report_schedule enabled
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, telegram_id, settings, subscription_tier")
    .not("settings->report_schedule", "is", null);

  if (error) {
    console.error("[cron/reports] deliverScheduledReports: fetch error:", error.message);
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("[cron/reports] TELEGRAM_BOT_TOKEN not set");
    return;
  }

  for (const profile of profiles ?? []) {
    try {
      const settings = (profile.settings ?? {}) as Record<string, unknown>;
      const schedule = (settings.report_schedule ?? {}) as Record<string, unknown>;

      // Check if this user has a report scheduled for today
      const periodType = schedule[todayName] as string | undefined;
      if (!periodType || !["daily", "weekly", "monthly"].includes(periodType)) continue;

      // Generate the report
      const toDate = now;
      let fromDate: Date;
      if (periodType === "daily") {
        fromDate = new Date(now); fromDate.setHours(0, 0, 0, 0);
      } else if (periodType === "weekly") {
        fromDate = new Date(now); fromDate.setDate(now.getDate() - 7); fromDate.setHours(0, 0, 0, 0);
      } else {
        fromDate = new Date(now); fromDate.setDate(1); fromDate.setHours(0, 0, 0, 0);
      }

      const locale = (settings.language as string) ?? "uk";
      const report = await generateRetrospective(
        profile.id,
        periodType as "daily" | "weekly" | "monthly",
        fromDate,
        toDate,
        locale as import("@/i18n/locales").Locale
      );

      if (!report) {
        results.skipped++;
        continue;
      }

      const reportId = await saveReport(profile.id, report);
      if (!reportId) {
        results.errors++;
        continue;
      }

      // Send via Telegram
      const periodLabel = { daily: "📅 Щоденний звіт", weekly: "📊 Тижневий звіт", monthly: "🗓 Місячний звіт" }[periodType as "daily" | "weekly" | "monthly"];
      const from = new Date(report.period_from).toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
      const to = new Date(report.period_to).toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
      const messageText = `${periodLabel} · ${from} — ${to}\n\n${report.content}`;

      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: String(profile.telegram_id),
            text: messageText,
            parse_mode: "Markdown",
          }),
        }
      );

      if (!res.ok) {
        const body = await res.text();
        console.error(`[cron/reports] sendMessage failed for user ${profile.id}:`, body);
        results.errors++;
      } else {
        results.scheduled_reports++;
      }
    } catch (err) {
      console.error(`[cron/reports] deliverScheduledReports error for user ${profile.id}:`, err);
      results.errors++;
    }
  }
}

// ── Weekly summaries (free users, every Monday) ────────────────────────────────

async function deliverWeeklySummaries(results: { scheduled_reports: number; weekly_summaries: number; skipped: number; errors: number }): Promise<void> {
  const supabase = getServiceClient();
  const now = new Date();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const periodFrom = weekAgo.toISOString();
  const periodTo = now.toISOString();

  // ISO week identifier for deduplication: YYYY-Www
  const weekKey = getISOWeekKey(now);

  // Fetch all profiles that have NOT opted out of weekly summaries
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, telegram_id, subscription_tier, settings")
    .filter("settings->notifications_weekly", "neq", false);

  if (profilesError) {
    console.error("[cron/reports] deliverWeeklySummaries: fetch error:", profilesError.message);
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("[cron/reports] TELEGRAM_BOT_TOKEN not set");
    return;
  }

  // Build set of user IDs that already have a scheduled paid report today
  // (populated by deliverScheduledReports above — we re-check via settings)
  const todayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][now.getDay()];

  for (const profile of profiles ?? []) {
    try {
      const settings = (profile.settings ?? {}) as Record<string, unknown>;

      // 7.4 — Skip paid users who already have a scheduled report for today
      const schedule = (settings.report_schedule ?? {}) as Record<string, unknown>;
      const hasPaidReportToday = !!schedule[todayName];
      if (hasPaidReportToday) {
        results.skipped++;
        continue;
      }

      // 7.5 — Skip users with fewer than 5 entries in the past 7 days
      const { count: recentCount, error: countError } = await supabase
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .gte("created_at", periodFrom);

      if (countError) {
        console.error(`[cron/reports] count error for user ${profile.id}:`, countError.message);
        results.errors++;
        continue;
      }

      if ((recentCount ?? 0) < 5) {
        results.skipped++;
        continue;
      }

      // 7.6 — Deduplication via notifications_log (type='weekly_summary', date=weekKey)
      const { error: logError } = await supabase
        .from("notifications_log")
        .insert({ user_id: profile.id, type: "weekly_summary", date: weekKey })
        .select("id")
        .single();

      if (logError) {
        // 23505 = unique_violation — already sent this week
        if (logError.code === "23505") {
          results.skipped++;
          continue;
        }
        console.error(`[cron/reports] notifications_log insert error for user ${profile.id}:`, logError.message);
        results.errors++;
        continue;
      }

      // Fetch and decrypt entries for the week
      const { data: rawEntries } = await supabase
        .from("entries")
        .select("content, category, metadata, created_at")
        .eq("user_id", profile.id)
        .gte("created_at", periodFrom)
        .lte("created_at", periodTo)
        .order("created_at", { ascending: true });

      let entries = rawEntries ?? [];

      // Decrypt entry content
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("telegram_id, encryption_salt")
          .eq("id", profile.id)
          .single();
        if (profileData?.telegram_id) {
          const key = await deriveUserKey(
            String(profileData.telegram_id),
            profileData.encryption_salt ?? null
          );
          entries = await Promise.all(
            entries.map(async (e: { content: string; category: string; metadata: Record<string, unknown>; created_at: string }) => ({
              ...e,
              content: await decryptField(e.content, key),
            }))
          );
        }
      } catch {
        // fallback: use raw entries
      }

      // Generate the weekly summary
      const locale = (settings.language as string) ?? "uk";
      const summary = await generateWeeklySummary(
        profile.id,
        entries as Array<{ content: string; category: string; metadata: Record<string, unknown>; created_at: string }>,
        locale as import("@/i18n/locales").Locale
      );

      if (!summary) {
        // Roll back the log entry so it can be retried
        await supabase
          .from("notifications_log")
          .delete()
          .eq("user_id", profile.id)
          .eq("type", "weekly_summary")
          .eq("date", weekKey);
        results.errors++;
        continue;
      }

      // Deliver via Telegram
      const fromLabel = weekAgo.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
      const toLabel = now.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
      const header = `📝 *Підсумок тижня* · ${fromLabel} — ${toLabel}\n\n`;
      const messageText = header + summary.content;

      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: String(profile.telegram_id),
            text: messageText,
            parse_mode: "Markdown",
          }),
        }
      );

      if (!res.ok) {
        const body = await res.text();
        console.error(`[cron/reports] weekly summary sendMessage failed for user ${profile.id}:`, body);
        // Roll back the log entry so it can be retried
        await supabase
          .from("notifications_log")
          .delete()
          .eq("user_id", profile.id)
          .eq("type", "weekly_summary")
          .eq("date", weekKey);
        results.errors++;
      } else {
        results.weekly_summaries++;
      }
    } catch (err) {
      console.error(`[cron/reports] deliverWeeklySummaries error for user ${profile.id}:`, err);
      results.errors++;
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns an ISO week key in the format YYYY-Www (e.g. "2024-W03").
 * Used as the `date` value in notifications_log for weekly_summary deduplication.
 */
function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ISO week: Thursday of the week determines the year
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
