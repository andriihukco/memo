/**
 * POST /api/profile/export/send
 *
 * Generates the user's data export ZIP and sends it directly to their
 * Telegram chat via the bot's sendDocument API call.
 * This avoids the Telegram mini-app file download restriction entirely.
 *
 * Rate-limited to 3 sends per hour per user.
 */
export const runtime = "nodejs";

import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { deriveUserKey, decryptField } from "@/lib/crypto";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

function getUserJwt(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function makeServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(",");
  const body = rows
    .map((r) => columns.map((c) => JSON.stringify(r[c] ?? "")).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export async function POST(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`export-send:${jwt.slice(0, 16)}`, 3, 60 * 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const supabase = makeServiceClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  // Fetch all user data in parallel
  const [profileResult, entriesResult, categoriesResult, reportsResult, subscriptionsResult, transactionsResult] =
    await Promise.all([
      supabase.from("profiles").select("id, telegram_id, username, subscription_tier, subscription_status, subscription_ends_at, created_at, encryption_salt").eq("id", userId).single(),
      supabase.from("entries").select("id, content, category, metadata, created_at").eq("user_id", userId).order("created_at", { ascending: true }),
      supabase.from("categories").select("id, name, label_ua, color, icon, created_at").eq("user_id", userId).order("name"),
      supabase.from("reports").select("id, period_type, period_from, period_to, summary, created_at").eq("user_id", userId).order("created_at", { ascending: true }),
      supabase.from("subscriptions").select("id, tier, status, start_date, end_date, created_at").eq("user_id", userId).order("created_at", { ascending: true }),
      supabase.from("subscription_transactions").select("id, amount, currency, description, status, created_at").eq("user_id", userId).order("created_at", { ascending: true }),
    ]);

  const telegramId = profileResult.data?.telegram_id ? String(profileResult.data.telegram_id) : null;
  if (!telegramId) {
    return Response.json({ error: "No Telegram account linked" }, { status: 400 });
  }

  // Decrypt entries
  const rawEntries = entriesResult.data ?? [];
  let decryptedEntries = rawEntries;
  const encryptionSalt = profileResult.data?.encryption_salt ?? null;

  try {
    const key = await deriveUserKey(telegramId, encryptionSalt);
    decryptedEntries = await Promise.all(
      rawEntries.map(async (e) => {
        try { return { ...e, content: await decryptField(e.content, key) }; }
        catch { return e; }
      })
    );
  } catch { /* use raw entries */ }

  const entryCsvRows = decryptedEntries.map((e) => {
    const metrics = (e.metadata as Record<string, unknown> | null)?.dashboard_metrics;
    const firstMetric = Array.isArray(metrics) && metrics.length > 0 ? (metrics[0] as Record<string, unknown>) : null;
    return { id: e.id, created_at: e.created_at, content: e.content, category: e.category, metric_value: firstMetric?.value ?? "", metric_unit: firstMetric?.unit ?? "" };
  });

  // Build ZIP
  const zip = new JSZip();
  zip.file("entries.csv", toCsv(entryCsvRows as Record<string, unknown>[], ["id", "created_at", "content", "category", "metric_value", "metric_unit"]));
  zip.file("categories.csv", toCsv(categoriesResult.data ?? [], ["id", "name", "label_ua", "color", "icon", "created_at"]));
  zip.file("reports.csv", toCsv(reportsResult.data ?? [], ["id", "period_type", "period_from", "period_to", "summary", "created_at"]));
  zip.file("subscriptions.csv", toCsv(subscriptionsResult.data ?? [], ["id", "tier", "status", "start_date", "end_date", "created_at"]));
  zip.file("transactions.csv", toCsv(transactionsResult.data ?? [], ["id", "amount", "currency", "description", "status", "created_at"]));

  const zipUint8 = await zip.generateAsync({ type: "uint8array" });
  const filename = `memo-export-${new Date().toISOString().slice(0, 10)}.zip`;

  // Send via Telegram Bot API using multipart/form-data
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const formData = new FormData();
  formData.append("chat_id", telegramId);
  formData.append("document", new Blob([zipUint8], { type: "application/zip" }), filename);
  formData.append("caption", "📦 Your Memo data export is ready!");

  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: "POST",
    body: formData,
  });

  if (!tgRes.ok) {
    const tgErr = await tgRes.json().catch(() => ({}));
    console.error("[export/send] Telegram sendDocument failed:", tgErr);
    return Response.json({ error: "Failed to send via Telegram" }, { status: 502 });
  }

  return Response.json({ ok: true });
}
