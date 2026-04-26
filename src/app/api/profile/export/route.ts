/**
 * GET /api/profile/export
 *
 * GDPR Article 20 — Right to data portability.
 * Returns a complete JSON export of all user data:
 *   profile, entries (decrypted), categories, reports, subscriptions.
 *
 * The response is streamed as a downloadable JSON file.
 * Rate-limited to 5 exports per hour per user to prevent abuse.
 */
export const runtime = "nodejs";

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
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
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
      .select("id, telegram_id, username, settings, subscription_tier, subscription_status, subscription_ends_at, created_at, updated_at")
      .eq("id", userId)
      .single(),

    supabase
      .from("entries")
      .select("id, content, category, metadata, created_at, updated_at, thread_id, reply_to_entry_id, embedding_status, branch_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),

    supabase
      .from("categories")
      .select("id, name, label_ua, color, icon, created_at")
      .eq("user_id", userId)
      .order("name"),

    supabase
      .from("reports")
      .select("id, period_type, period_from, period_to, summary, went_well, didnt_go_well, start_stop_continue, experiment, lesson, insights, created_at")
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

  // Decrypt entry content
  let entries = entriesResult.data ?? [];
  try {
    const telegramId = profileResult.data?.telegram_id
      ? String(profileResult.data.telegram_id)
      : null;
    if (telegramId) {
      const key = await deriveUserKey(telegramId);
      entries = await Promise.all(
        entries.map(async (e) => {
          try {
            return { ...e, content: await decryptField(e.content, key) };
          } catch {
            return e; // legacy plaintext entry — return as-is
          }
        })
      );
    }
  } catch (err) {
    console.error("[api/profile/export] decryption error:", err);
    // Return encrypted content rather than failing the whole export
  }

  const exportData = {
    exported_at: new Date().toISOString(),
    memo_version: "1.0",
    user: {
      profile: profileResult.data ?? null,
      entries,
      categories: categoriesResult.data ?? [],
      reports: reportsResult.data ?? [],
      subscriptions: subscriptionsResult.data ?? [],
      transactions: transactionsResult.data ?? [],
    },
  };

  const filename = `memo-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
