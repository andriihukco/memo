export const runtime = "nodejs";

/**
 * Cron job: runs every hour, checks which users need a scheduled report
 * and sends it via Telegram Bot API.
 *
 * Schedule logic (all times treated as UTC):
 *  - daily:   send every day at schedule.time
 *  - weekly:  send on schedule.weekly_day (0=Sun…6=Sat) at schedule.time
 *  - monthly: send on schedule.monthly_day of each month at schedule.time
 *
 * To avoid duplicate sends we check that no report of the same type was
 * already sent today (for daily) / this week (for weekly) / this month (for monthly).
 */

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import {
  generateRetrospective,
  saveReport,
  formatReportForTelegram,
  getReportSchedule,
  type ReportSchedule,
} from "@/lib/bot/retrospective";
import { sanitizeMarkdown } from "@/lib/utils";

function serviceDb() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function sendTelegram(chatId: string, text: string): Promise<void> {
  const chunks = text.match(/[\s\S]{1,4000}/g) ?? [text];
  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });
  }
}

/** Returns true if a report of this type was already sent in the current window */
async function alreadySent(
  supabase: ReturnType<typeof serviceDb>,
  userId: string,
  periodType: "daily" | "weekly" | "monthly",
  now: Date
): Promise<boolean> {
  let windowStart: Date;
  if (periodType === "daily") {
    windowStart = new Date(now); windowStart.setUTCHours(0, 0, 0, 0);
  } else if (periodType === "weekly") {
    windowStart = new Date(now); windowStart.setUTCDate(now.getUTCDate() - 6); windowStart.setUTCHours(0, 0, 0, 0);
  } else {
    windowStart = new Date(now); windowStart.setUTCDate(1); windowStart.setUTCHours(0, 0, 0, 0);
  }

  const { data } = await supabase
    .from("reports")
    .select("id")
    .eq("user_id", userId)
    .eq("period_type", periodType)
    .gte("created_at", windowStart.toISOString())
    .limit(1);

  return (data?.length ?? 0) > 0;
}

function shouldSendNow(schedule: ReportSchedule, type: "daily" | "weekly" | "monthly", now: Date): boolean {
  if (!schedule[type]) return false;

  const [hh, mm] = schedule.time.split(":").map(Number);
  const nowH = now.getUTCHours();
  const nowM = now.getUTCMinutes();

  // Match the hour — cron runs every hour, so we fire if current hour:00 matches schedule time
  // Allow a 59-minute window: if schedule is 09:00 and cron fires at 09:xx, send it
  if (nowH !== hh) return false;
  // Only send in the first 59 minutes of the scheduled hour (cron fires at :00 but may be delayed)
  if (nowM > 59) return false;

  if (type === "daily") return true;
  if (type === "weekly") return now.getUTCDay() === (schedule.weekly_day ?? 1);
  if (type === "monthly") {
    const day = schedule.monthly_day ?? 1;
    return now.getUTCDate() === day;
  }
  return false;
}

export async function GET(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = serviceDb();
  const now = new Date();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, telegram_id, settings");

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results: string[] = [];

  for (const profile of profiles ?? []) {
    const schedule = (profile.settings?.report_schedule as ReportSchedule) ?? {
      daily: false, weekly: false, monthly: false, time: "09:00", weekly_day: 1, monthly_day: 1,
    };
    const telegramId = profile.telegram_id?.toString();
    if (!telegramId) continue;

    for (const type of ["daily", "weekly", "monthly"] as const) {
      if (!shouldSendNow(schedule, type, now)) continue;
      if (await alreadySent(supabase, profile.id, type, now)) continue;

      // Build date range
      const to = new Date(now);
      let from: Date;
      if (type === "daily") {
        from = new Date(now); from.setUTCHours(0, 0, 0, 0);
        to.setUTCHours(23, 59, 59, 999);
      } else if (type === "weekly") {
        from = new Date(now); from.setUTCDate(now.getUTCDate() - 7); from.setUTCHours(0, 0, 0, 0);
      } else {
        from = new Date(now); from.setUTCDate(now.getUTCDate() - 30); from.setUTCHours(0, 0, 0, 0);
      }

      try {
        const report = await generateRetrospective(profile.id, type, from, to);
        if (!report) {
          results.push(`${profile.id}:${type}:no_data`);
          continue;
        }
        await saveReport(profile.id, report);
        const text = sanitizeMarkdown(formatReportForTelegram(report));
        await sendTelegram(telegramId, text);
        results.push(`${profile.id}:${type}:sent`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[cron/reports] failed for ${profile.id}:${type}:`, msg);
        results.push(`${profile.id}:${type}:error:${msg}`);
      }
    }
  }

  return Response.json({ ok: true, now: now.toISOString(), results });
}
