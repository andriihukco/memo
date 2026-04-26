/**
 * GET /api/profile/export
 *
 * GDPR Article 20 — Right to data portability.
 * Returns a ZIP archive containing CSV files for all user data:
 *   entries.csv, categories.csv, reports.csv, subscriptions.csv, transactions.csv
 *
 * Rate-limited to 5 exports per hour per user to prevent abuse.
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

/**
 * Serialize an array of row objects to CSV.
 * Produces a header row followed by one row per object.
 * Each cell is JSON.stringify'd to handle commas, quotes, and newlines safely.
 */
function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(",");
  const body = rows
    .map((r) => columns.map((c) => JSON.stringify(r[c] ?? "")).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export async function GET(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rate limit: 5 exports per hour (exports are expensive — full table scans)
  const rl = rateLimit(`export:${jwt.slice(0, 16)}`, 5, 60 * 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const supabase = makeServiceClient();

  // Verify JWT and get user identity
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = user.id;

  // Fetch all user data in parallel
  const [
    profileResult,
    entriesResult,
    categoriesResult,
    reportsResult,
    subscriptionsResult,
    transactionsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, telegram_id, username, settings, subscription_tier, subscription_status, subscription_ends_at, created_at, updated_at, encryption_salt"
      )
      .eq("id", userId)
      .single(),

    supabase
      .from("entries")
      .select("id, content, category, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),

    supabase
      .from("categories")
      .select("id, name, label_ua, color, icon, created_at")
      .eq("user_id", userId)
      .order("name"),

    supabase
      .from("reports")
      .select("id, period_type, period_from, period_to, summary, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),

    supabase
      .from("subscriptions")
      .select("id, tier, status, start_date, end_date, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),

    supabase
      .from("subscription_transactions")
      .select("id, amount, currency, description, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  // ── Decrypt entry content (task 4.4: per-entry try/catch, fall back to raw) ──
  const rawEntries = entriesResult.data ?? [];
  let decryptedEntries: typeof rawEntries = rawEntries;

  const telegramId = profileResult.data?.telegram_id
    ? String(profileResult.data.telegram_id)
    : null;
  const encryptionSalt = profileResult.data?.encryption_salt ?? null;

  if (telegramId) {
    let key: CryptoKey | null = null;
    try {
      key = await deriveUserKey(telegramId, encryptionSalt);
    } catch (err) {
      console.error("[api/profile/export] key derivation error:", err);
      // key stays null — all entries will fall back to raw values below
    }

    if (key) {
      decryptedEntries = await Promise.all(
        rawEntries.map(async (e) => {
          try {
            return { ...e, content: await decryptField(e.content, key!) };
          } catch {
            // Decryption failed for this entry — include raw value (task 4.4)
            return e;
          }
        })
      );
    }
  }

  // ── Build CSV rows for entries ────────────────────────────────────────────
  // Extract metric_value and metric_unit from metadata.dashboard_metrics[0]
  const entryCsvRows = decryptedEntries.map((e) => {
    const metrics =
      (e.metadata as Record<string, unknown> | null)?.dashboard_metrics;
    const firstMetric =
      Array.isArray(metrics) && metrics.length > 0
        ? (metrics[0] as Record<string, unknown>)
        : null;
    return {
      id: e.id,
      created_at: e.created_at,
      content: e.content,
      category: e.category,
      metric_value: firstMetric?.value ?? "",
      metric_unit: firstMetric?.unit ?? "",
    };
  });

  // ── Assemble ZIP ──────────────────────────────────────────────────────────
  const zip = new JSZip();

  zip.file(
    "entries.csv",
    toCsv(entryCsvRows as Record<string, unknown>[], [
      "id",
      "created_at",
      "content",
      "category",
      "metric_value",
      "metric_unit",
    ])
  );

  zip.file(
    "categories.csv",
    toCsv(categoriesResult.data ?? [], [
      "id",
      "name",
      "label_ua",
      "color",
      "icon",
      "created_at",
    ])
  );

  zip.file(
    "reports.csv",
    toCsv(reportsResult.data ?? [], [
      "id",
      "period_type",
      "period_from",
      "period_to",
      "summary",
      "created_at",
    ])
  );

  zip.file(
    "subscriptions.csv",
    toCsv(subscriptionsResult.data ?? [], [
      "id",
      "tier",
      "status",
      "start_date",
      "end_date",
      "created_at",
    ])
  );

  zip.file(
    "transactions.csv",
    toCsv(transactionsResult.data ?? [], [
      "id",
      "amount",
      "currency",
      "description",
      "status",
      "created_at",
    ])
  );

  // Generate ZIP as an ArrayBuffer (compatible with Response BodyInit)
  const zipUint8 = await zip.generateAsync({ type: "uint8array" });
  const zipBuffer = zipUint8.buffer as ArrayBuffer;

  const filename = `memo-export-${new Date().toISOString().slice(0, 10)}.zip`;

  return new Response(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
