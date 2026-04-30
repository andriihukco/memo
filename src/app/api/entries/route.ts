export const runtime = "edge";

import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { deriveUserKey, encryptField, decryptField } from "@/lib/crypto";
import { getEffectiveTier, TIER_INFO } from "@/lib/stars/paywall";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { resolveCalorieMetrics } from "@/lib/nutrition";

function getUserJwt(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function makeSupabase(jwt: string) {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
}

/** Resolve the Telegram user ID and encryption salt from the JWT via the profiles table. */
async function getTelegramProfile(jwt: string): Promise<{ telegramId: string; encryptionSalt: string | null } | null> {
  const supabase = makeSupabase(jwt);
  const { data } = await supabase
    .from("profiles")
    .select("telegram_id, encryption_salt")
    .single();
  if (!data?.telegram_id) return null;
  return {
    telegramId: String(data.telegram_id),
    encryptionSalt: data.encryption_salt ?? null,
  };
}

// Re-extract dashboard_metrics from updated content using Gemini
async function recomputeMetrics(content: string): Promise<{ dashboard_metrics: Record<string, unknown>[]; metadata: Record<string, unknown> } | null> {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {},
    });

    const prompt = `Extract all measurable metrics from this diary entry as a JSON array.
Use nutritional knowledge to calculate kcal/protein/carbs/fat from food+weight mentions.
Standard values per 100g: chicken breast 165kcal/31g prot/0g carbs/3.6g fat, rice(cooked) 130kcal/2.7g prot/28g carbs/0.3g fat, buckwheat(cooked) 92kcal/3.4g prot/20g carbs/0.6g fat, egg 155kcal/13g prot/1g carbs/11g fat, salmon 208kcal/20g prot/0g carbs/13g fat, oats 389kcal/17g prot/66g carbs/7g fat.

Return ONLY a JSON array like: [{"key":"kcal_intake","label":"Калорії","value":330,"unit":"ккал","icon":"utensils","aggregate":"sum"},{"key":"protein_g","label":"Білки","value":62,"unit":"г","icon":"beef","aggregate":"sum"}]
If no measurable data, return: []

Entry: "${content.replace(/"/g, "'")}"`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim()
      .replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(text);
    const parsedMetrics = Array.isArray(parsed) ? parsed as Record<string, unknown>[] : [];
    const corrected = await resolveCalorieMetrics(content, {}, parsedMetrics);
    return {
      dashboard_metrics: corrected.metrics,
      metadata: corrected.metadata,
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rate limit: 30 writes/min per JWT (keyed on first 16 chars of token)
  const rl = rateLimit(`entries:write:${jwt.slice(0, 16)}`, 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const supabase = makeSupabase(jwt);

  // Resolve user profile id
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id")
    .single();
  if (profileErr || !profile) {
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = profile.id as string;

  // Enforce tier entry limit
  const tier = await getEffectiveTier(userId);
  const limits = TIER_INFO[tier].limits;

  const { count } = await supabase
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (limits.entries !== Infinity && (count ?? 0) >= limits.entries) {
    return new Response(JSON.stringify({
      error: "limit_exceeded",
      feature: "entries",
      limit: limits.entries,
      current: count,
      required_tier: "stars_basic",
    }), { status: 402, headers: { "Content-Type": "application/json" } });
  }

  // Parse body
  let content: string, category: string | undefined, metadata: Record<string, unknown> | undefined;
  try {
    const body = await req.json();
    content = body.content;
    category = body.category;
    metadata = body.metadata;
    if (!content) throw new Error("content required");
  } catch {
    return new Response(JSON.stringify({ error: "content required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Encrypt content
  let storedContent = content.trim();
  try {
    const telegramProfile = await getTelegramProfile(jwt);
    if (telegramProfile) {
      const key = await deriveUserKey(telegramProfile.telegramId, telegramProfile.encryptionSalt);
      storedContent = await encryptField(storedContent, key);
    }
  } catch (cryptoErr) {
    console.error("[api/entries POST] encryption error:", cryptoErr);
  }

  const { data, error } = await supabase
    .from("entries")
    .insert({
      user_id: userId,
      content: storedContent,
      category: category ?? "uncategorized",
      metadata: metadata ?? {},
    })
    .select("id, content, category, metadata, bot_reply, thread_id, reply_to_entry_id, created_at")
    .single();

  if (error) {
    console.error("[api/entries POST] insert error:", error.message);
    return new Response(JSON.stringify({ error: "Failed to create entry" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ entry: data }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PATCH(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  let id: string, content: string | undefined, category: string | undefined, metricOverride: { key: string; value: number } | undefined;
  try {
    const body = await req.json();
    id = body.id;
    content = body.content;
    category = body.category;
    metricOverride = body.metric_override;
    if (!id || (!content && !category && !metricOverride)) throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: "id and at least one of content/category/metric_override required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const supabase = makeSupabase(jwt);

  // Fetch current entry to get existing metadata and encrypted content
  const { data: existing } = await supabase
    .from("entries")
    .select("metadata, content")
    .eq("id", id)
    .single();

  // Derive encryption key
  let cryptoKey: CryptoKey | null = null;
  try {
    const telegramProfile = await getTelegramProfile(jwt);
    if (telegramProfile) cryptoKey = await deriveUserKey(telegramProfile.telegramId, telegramProfile.encryptionSalt);
  } catch (cryptoErr) {
    console.error("[api/entries] key derivation error:", cryptoErr);
  }

  const updates: Record<string, unknown> = {};

  if (content !== undefined) {
    const trimmed = content.trim();
    updates.content = cryptoKey ? await encryptField(trimmed, cryptoKey) : trimmed;
  }
  if (category !== undefined) updates.category = category.trim();

  if (metricOverride !== undefined) {
    const existingMeta = (existing?.metadata as Record<string, unknown>) ?? {};
    const existingMetrics = (existingMeta.dashboard_metrics as Record<string, unknown>[] | undefined) ?? [];
    const updatedMetrics = existingMetrics.map(m =>
      m.key === metricOverride!.key ? { ...m, value: metricOverride!.value } : m
    );
    if (updatedMetrics.some(m => m.key === metricOverride!.key)) {
      updates.metadata = { ...existingMeta, dashboard_metrics: updatedMetrics };
    }
  }

  // Re-compute metrics and reset embedding when content changes — use plaintext for AI
  if (content !== undefined) {
    const plainContent = content.trim();
    // Decrypt existing content for comparison
    let existingPlain = existing?.content ?? "";
    if (cryptoKey && existingPlain) {
      try { existingPlain = await decryptField(existingPlain, cryptoKey); } catch { /* legacy plaintext */ }
    }
    if (plainContent !== existingPlain) {
      const newMetrics = await recomputeMetrics(plainContent);
      if (newMetrics !== null) {
        const existingMeta = (existing?.metadata as Record<string, unknown>) ?? {};
        updates.metadata = { ...existingMeta, ...newMetrics.metadata, dashboard_metrics: newMetrics.dashboard_metrics };
      }
      // Reset embedding so the cron job re-embeds the updated content.
      // This keeps semantic search and clustering accurate after edits.
      updates.embedding_status = "pending";
    }
  }

  const { data, error } = await supabase
    .from("entries")
    .update(updates)
    .eq("id", id)
    .select("id, content, category, metadata, bot_reply, thread_id, reply_to_entry_id, created_at")
    .single();

  if (error) {
    console.error("[api/entries] patch error:", error.message);
    return new Response(JSON.stringify({ error: "Failed to update entry" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  // Decrypt before returning to client
  let entry = data;
  if (cryptoKey && entry) {
    try {
      entry = {
        ...entry,
        content: await decryptField(entry.content, cryptoKey),
        bot_reply: entry.bot_reply ? await decryptField(entry.bot_reply, cryptoKey) : entry.bot_reply,
      };
    } catch { /* return as-is */ }
  }

  return new Response(JSON.stringify({ entry }), { status: 200, headers: { "Content-Type": "application/json" } });
}

export async function DELETE(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let ids: string[];
  try {
    const body = await req.json();
    ids = body.ids;
    if (!Array.isArray(ids) || ids.length === 0) throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: "ids array required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = makeSupabase(jwt);
  const { error } = await supabase.from("entries").delete().in("id", ids);

  if (error) {
    console.error("[api/entries] delete error:", error.message);
    return new Response(JSON.stringify({ error: "Failed to delete entries" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ deleted: ids.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
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

  // Rate limit: 120 reads/min per JWT
  const rl = rateLimit(`entries:read:${jwt.slice(0, 16)}`, 120, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const supabase = makeSupabase(jwt);

  // Resolve user id for tier check
  const { data: profileForTier } = await supabase
    .from("profiles")
    .select("id")
    .single();

  const { searchParams } = new URL(req.url);
  const categoryParam = searchParams.get("category");
  const beforeParam = searchParams.get("before"); // cursor-based: entry ID to paginate before
  const limitParam = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const fromParam = searchParams.get("from");
  const toParam   = searchParams.get("to");

  // Legacy offset pagination support (ignored when cursor is present)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const category = categoryParam ?? null;

  let query = supabase
    .from("entries")
    .select("id, content, category, metadata, bot_reply, thread_id, reply_to_entry_id, created_at")
    .order("created_at", { ascending: false });

  if (category) query = query.eq("category", category);
  if (fromParam) query = query.gte("created_at", fromParam);
  if (toParam)   query = query.lte("created_at", toParam);

  // Cursor-based pagination: if `before` is provided, fetch the created_at of that entry
  // and filter to entries strictly older than it. Otherwise fall back to offset pagination.
  if (beforeParam) {
    const { data: cursorEntry } = await supabase
      .from("entries")
      .select("created_at")
      .eq("id", beforeParam)
      .single();
    if (cursorEntry?.created_at) {
      query = query.lt("created_at", cursorEntry.created_at);
    }
    // Fetch limit + 1 to determine has_more
    query = query.limit(limitParam + 1);
  } else if (searchParams.has("page")) {
    // Legacy offset pagination (backward compat)
    const offset = (page - 1) * limitParam;
    query = query.range(offset, offset + limitParam - 1);
  } else {
    // First page cursor fetch
    query = query.limit(limitParam + 1);
  }

  // Apply history filter based on effective tier
  if (profileForTier?.id) {
    const tier = await getEffectiveTier(profileForTier.id as string);
    const historyDays = TIER_INFO[tier].limits.historyDays;
    if (historyDays !== Infinity) {
      const cutoff = new Date(Date.now() - historyDays * 86_400_000).toISOString();
      query = query.gte("created_at", cutoff);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("[api/entries] query error:", error.message);
    return new Response(JSON.stringify({ error: "Failed to fetch entries" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Determine has_more and trim the extra row used for detection
  const rawEntries = data ?? [];
  const isLegacyOffset = searchParams.has("page") && !beforeParam;
  let hasMore = false;
  let pageEntries = rawEntries;

  if (!isLegacyOffset) {
    hasMore = rawEntries.length > limitParam;
    pageEntries = hasMore ? rawEntries.slice(0, limitParam) : rawEntries;
  }

  const nextCursor = hasMore && pageEntries.length > 0
    ? pageEntries[pageEntries.length - 1].id
    : null;

  // Decrypt content and bot_reply for each entry
  let entries = pageEntries;
  try {
    const telegramProfile = await getTelegramProfile(jwt);
    if (telegramProfile) {
      const key = await deriveUserKey(telegramProfile.telegramId, telegramProfile.encryptionSalt);
      entries = await Promise.all(
        entries.map(async (e) => ({
          ...e,
          content: await decryptField(e.content, key),
          bot_reply: e.bot_reply ? await decryptField(e.bot_reply, key) : e.bot_reply,
        }))
      );
    }
  } catch (cryptoErr) {
    console.error("[api/entries] decryption error:", cryptoErr);
    // Return entries as-is (may be plaintext legacy entries)
  }

  // Return cursor-based response shape; include legacy `total` and `page` for backward compat
  return new Response(
    JSON.stringify({
      entries,
      has_more: hasMore,
      next_cursor: nextCursor,
      // Legacy fields (kept for backward compat with existing callers)
      total: entries.length,
      page,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
