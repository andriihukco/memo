import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

interface EntryRow {
  id: string;
  content: string;
  category: string;
  metadata: Record<string, unknown>;
  embedding: string | null;
  branch_id: string | null;
  created_at: string;
}

/**
 * Cluster a user's embedded diary entries into thematic groups using a
 * union-find (disjoint-set) algorithm over pgvector cosine similarity.
 *
 * **Algorithm:**
 * 1. Fetch all entries for `userId` that have `embedding_status = 'done'`.
 * 2. For each entry, call the `find_similar_entries` RPC to retrieve the top-5
 *    nearest neighbours. Pairs whose cosine similarity exceeds **0.75** are
 *    added as edges in an adjacency map.
 * 3. Run union-find with path compression over the adjacency map to identify
 *    connected components (clusters).
 * 4. Discard clusters with fewer than **3** members — they are too small to be
 *    meaningful.
 * 5. Assign a stable `branch_id` UUID to each qualifying cluster: reuse an
 *    existing `branch_id` from any member entry if one is present, otherwise
 *    generate a new `crypto.randomUUID()`.
 * 6. Persist the `branch_id` to both `entries` and `insights` rows for all
 *    cluster members.
 *
 * **Output shape:** the function has no return value (`void`). Its observable
 * output is the updated `entries.branch_id` and `insights.branch_id` columns
 * in the database. Callers can query `entries` grouped by `branch_id` to
 * retrieve clusters.
 *
 * @param userId - UUID of the profile whose entries should be clustered.
 * @returns Resolves when all cluster assignments have been written to the DB.
 * @throws {Error} If the initial entries fetch fails (individual RPC or update
 *   errors are logged but do not abort the run).
 */
export async function clusterEntries(userId: string): Promise<void> {
  const supabase = getServiceClient();

  // Fetch all entries with embeddings for this user
  const { data: entries, error } = await supabase
    .from("entries")
    .select("id, content, category, metadata, embedding, branch_id, created_at")
    .eq("user_id", userId)
    .eq("embedding_status", "done")
    .not("embedding", "is", null);

  if (error) {
    throw new Error(`[loop] Failed to fetch entries for user ${userId}: ${error.message}`);
  }

  if (!entries || entries.length < 3) {
    return; // Not enough entries to form any cluster
  }

  // Build adjacency: for each entry, find top-5 similar entries with similarity > 0.75
  const adjacency = new Map<string, Set<string>>();

  for (const entry of entries as EntryRow[]) {
    if (!entry.embedding) continue;

    const { data: similar, error: rpcError } = await supabase.rpc("find_similar_entries", {
      p_user_id: userId,
      p_embedding: entry.embedding,
      p_exclude_id: entry.id,
      p_top_k: 5,
    });

    if (rpcError) {
      console.error(`[loop] RPC error for entry ${entry.id}:`, rpcError.message);
      continue;
    }

    const neighbors = (similar ?? []).filter((s: { similarity: number }) => s.similarity > 0.75);
    if (neighbors.length > 0) {
      if (!adjacency.has(entry.id)) adjacency.set(entry.id, new Set());
      for (const n of neighbors) {
        adjacency.get(entry.id)!.add(n.id);
        if (!adjacency.has(n.id)) adjacency.set(n.id, new Set());
        adjacency.get(n.id)!.add(entry.id);
      }
    }
  }

  // Union-Find to group connected components
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  };
  const union = (a: string, b: string) => {
    parent.set(find(a), find(b));
  };

  for (const [node, neighbors] of adjacency) {
    for (const neighbor of neighbors) {
      union(node, neighbor);
    }
  }

  // Group entries by cluster root
  const clusters = new Map<string, string[]>();
  for (const [node] of adjacency) {
    const root = find(node);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(node);
  }

  // Only keep clusters with ≥ 3 entries; assign a stable branch_id UUID per cluster
  for (const [, members] of clusters) {
    if (members.length < 3) continue;

    // Prefer existing branch_id from a member entry, else generate new
    const existingEntry = (entries as EntryRow[]).find(
      (e) => members.includes(e.id) && e.branch_id != null
    );
    const branchId = existingEntry?.branch_id ?? crypto.randomUUID();

    // Update entries
    const { error: entryUpdateError } = await supabase
      .from("entries")
      .update({ branch_id: branchId })
      .in("id", members);

    if (entryUpdateError) {
      console.error(`[loop] Failed to update branch_id for cluster:`, entryUpdateError.message);
    }

    // Update insights referencing these entries
    const { error: insightUpdateError } = await supabase
      .from("insights")
      .update({ branch_id: branchId })
      .in("entry_id", members);

    if (insightUpdateError) {
      console.error(`[loop] Failed to update insights branch_id:`, insightUpdateError.message);
    }
  }
}

/**
 * Auto-increment active streaks for a user.
 * Finds the most recent entry with a "last" aggregate metric (streak),
 * and if it was created yesterday or earlier today, creates a new entry with value+1.
 */
export async function autoIncrementStreaks(userId: string): Promise<void> {
  const supabase = getServiceClient();
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(todayStart.getDate() - 1);

  // Find entries from yesterday that have streak metrics (aggregate=last)
  const { data: entries } = await supabase
    .from("entries")
    .select("id, content, category, metadata, created_at")
    .eq("user_id", userId)
    .gte("created_at", yesterdayStart.toISOString())
    .lt("created_at", todayStart.toISOString());

  if (!entries || entries.length === 0) return;

  for (const entry of entries as Array<{ id: string; content: string; category: string; metadata: Record<string, unknown>; created_at: string }>) {
    const metrics = entry.metadata.dashboard_metrics as Array<{ key: string; value: number; aggregate: string; label: string; unit: string; icon?: string }> | undefined;
    if (!Array.isArray(metrics)) continue;

    const streakMetrics = metrics.filter(m => m.aggregate === "last" && m.key.endsWith("_days"));
    if (streakMetrics.length === 0) continue;

    // Create auto-incremented streak entry.
    // The unique index entries_auto_streak_unique_idx on (user_id, category, DATE(created_at))
    // WHERE auto_streak = true ensures that double-firing the cron on the same UTC day
    // silently skips the duplicate insert instead of creating a second streak row (Req 23.1).
    const newMetrics = streakMetrics.map(m => ({ ...m, value: m.value + 1 }));
    const newContent = entry.content.replace(/\d+/, String(streakMetrics[0].value + 1));

    // Use upsert with ignoreDuplicates=true (ON CONFLICT DO NOTHING) so that if the
    // cron fires twice on the same UTC day, the second insert is silently skipped
    // without raising an error (idempotent). The unique index
    // entries_auto_streak_unique_idx on (user_id, category, entries_created_at_utc_date(created_at))
    // WHERE auto_streak = true enforces the constraint (Req 23.1).
    const { error: insertError } = await supabase.from("entries").upsert(
      {
        user_id: userId,
        content: newContent,
        category: entry.category,
        metadata: { ...entry.metadata, dashboard_metrics: newMetrics, auto_streak: true },
        raw_media_url: null,
      },
      { ignoreDuplicates: true }
    );

    if (insertError) {
      console.error(`[loop] autoIncrementStreaks: insert failed for user ${userId}, category ${entry.category}:`, insertError.message);
    }
  }
}

/**
 * Re-embed entries that have embedding_status = 'pending'.
 * This covers:
 *   - New entries whose async embedding failed on first attempt
 *   - Edited entries (PATCH /api/entries resets status to 'pending')
 *
 * Processes up to 50 pending entries per user per cron run to stay within
 * Gemini API rate limits. Remaining entries are picked up in the next run.
 */
export async function reembedPendingEntries(userId: string): Promise<void> {
  const supabase = getServiceClient();

  const { data: pending, error } = await supabase
    .from("entries")
    .select("id, content")
    .eq("user_id", userId)
    .eq("embedding_status", "pending")
    .order("updated_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error(`[loop] reembedPendingEntries fetch error for user ${userId}:`, error.message);
    return;
  }

  if (!pending || pending.length === 0) return;

  const { embedEntry } = await import("@/lib/embedding");

  for (const entry of pending as Array<{ id: string; content: string }>) {
    try {
      await embedEntry(entry.id, entry.content);
    } catch (err) {
      console.error(`[loop] reembedPendingEntries failed for entry ${entry.id}:`, err);
      // embedEntry already marks as 'failed' after MAX_ATTEMPTS — continue to next
    }
  }
}

/**
 * Retry embedding for entries that previously failed, up to a maximum of 3
 * total attempts per entry. Queries entries where embedding_status='failed'
 * AND embedding_attempts < 3, then calls embedEntry() for each.
 *
 * embedEntry() handles incrementing embedding_attempts on each failure and
 * setting embedding_status='failed' after exhaustion, so this function only
 * needs to select candidates and dispatch.
 */
export async function retryFailedEmbeddings(userId: string): Promise<void> {
  const supabase = getServiceClient();

  const { data: failed, error } = await supabase
    .from("entries")
    .select("id, content")
    .eq("user_id", userId)
    .eq("embedding_status", "failed")
    .lt("embedding_attempts", 3);

  if (error) {
    console.error(`[loop] retryFailedEmbeddings fetch error for user ${userId}:`, error.message);
    return;
  }

  if (!failed || failed.length === 0) return;

  const { embedEntry } = await import("@/lib/embedding");

  for (const entry of failed as Array<{ id: string; content: string }>) {
    try {
      await embedEntry(entry.id, entry.content);
    } catch (err) {
      console.error(`[loop] retryFailedEmbeddings failed for entry ${entry.id}:`, err);
    }
  }
}

/**
 * Send due reminders to users via the Telegram Bot API.
 * Queries reminders where status='pending' AND scheduled_at <= now(),
 * sends each reminder text to the user, then updates status='sent'
 * using a conditional WHERE status='pending' to prevent double-sending
 * (idempotent per Req 23.3).
 */
export async function processReminders(): Promise<void> {
  const supabase = getServiceClient();

  const { data: due, error } = await supabase
    .from("reminders")
    .select("id, user_id, text")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString());

  if (error) {
    console.error("[loop] processReminders fetch error:", error.message);
    return;
  }

  if (!due || due.length === 0) return;

  // Fetch telegram_ids for all affected users in one query
  const userIds = [...new Set((due as Array<{ id: string; user_id: string; text: string }>).map(r => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, telegram_id")
    .in("id", userIds);

  const telegramIdByUserId = new Map<string, string>();
  for (const p of profiles ?? []) {
    telegramIdByUserId.set(p.id, String(p.telegram_id));
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("[loop] processReminders: TELEGRAM_BOT_TOKEN not set");
    return;
  }

  for (const reminder of due as Array<{ id: string; user_id: string; text: string }>) {
    const chatId = telegramIdByUserId.get(reminder.user_id);
    if (!chatId) {
      console.warn(`[loop] processReminders: no telegram_id for user ${reminder.user_id}`);
      continue;
    }

    try {
      // Send reminder message via Telegram Bot API
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `⏰ Нагадування: ${reminder.text}`,
          }),
        }
      );

      if (!res.ok) {
        const body = await res.text();
        console.error(`[loop] processReminders: sendMessage failed for reminder ${reminder.id}:`, body);
        continue;
      }

      // Conditionally update status to 'sent' only if still 'pending' (idempotent)
      const { error: updateError } = await supabase
        .from("reminders")
        .update({ status: "sent" })
        .eq("id", reminder.id)
        .eq("status", "pending");

      if (updateError) {
        console.error(`[loop] processReminders: update failed for reminder ${reminder.id}:`, updateError.message);
      }
    } catch (err) {
      console.error(`[loop] processReminders: error for reminder ${reminder.id}:`, err);
    }
  }
}

/**
 * Send streak reminder notifications to users who have not logged any entries
 * in the past 24 hours.
 *
 * Skips:
 *  - Users who have opted out via `settings.notifications_streak = false`
 *  - New users who have never created any entry
 *
 * Idempotency: inserts a row into `notifications_log` with `ON CONFLICT DO NOTHING`
 * on the unique constraint `(user_id, type, date)` so that double-firing the cron
 * on the same UTC day never sends duplicate messages (Req 11.4, Req 23.4).
 */
export async function processStreakNotifications(): Promise<void> {
  const supabase = getServiceClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Fetch all profiles that have NOT opted out of streak notifications.
  // settings->notifications_streak defaults to true when absent, so we
  // exclude only profiles where the flag is explicitly set to false.
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, telegram_id, settings")
    .filter("settings->notifications_streak", "neq", false);

  if (profilesError) {
    console.error("[loop] processStreakNotifications: failed to fetch profiles:", profilesError.message);
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("[loop] processStreakNotifications: TELEGRAM_BOT_TOKEN not set");
    return;
  }

  for (const profile of profiles ?? []) {
    try {
      // Check whether the user has logged anything in the past 24 hours
      const { count: recentCount, error: recentError } = await supabase
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .gte("created_at", cutoff);

      if (recentError) {
        console.error(`[loop] processStreakNotifications: recent count error for user ${profile.id}:`, recentError.message);
        continue;
      }

      // User has been active in the last 24 hours — no reminder needed
      if ((recentCount ?? 0) > 0) continue;

      // Skip new users who have never created any entry (Req 11.5)
      const { count: totalCount, error: totalError } = await supabase
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id);

      if (totalError) {
        console.error(`[loop] processStreakNotifications: total count error for user ${profile.id}:`, totalError.message);
        continue;
      }

      if ((totalCount ?? 0) === 0) continue;

      // Attempt to claim today's notification slot via ON CONFLICT DO NOTHING.
      // If a row already exists for (user_id, 'streak', today), the insert is
      // silently skipped and we do not send a duplicate message.
      const { error: logError, data: logData } = await supabase
        .from("notifications_log")
        .insert({ user_id: profile.id, type: "streak", date: today })
        .select("id")
        .single();

      if (logError) {
        // Unique constraint violation means we already sent today — skip
        if (logError.code === "23505") continue;
        console.error(`[loop] processStreakNotifications: log insert error for user ${profile.id}:`, logError.message);
        continue;
      }

      if (!logData) continue; // Should not happen, but guard anyway

      // Send the streak reminder via Telegram Bot API (Req 11.1, 11.3)
      const chatId = String(profile.telegram_id);
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "Не забудь зробити запис сьогодні! 📝",
          }),
        }
      );

      if (!res.ok) {
        const body = await res.text();
        console.error(`[loop] processStreakNotifications: sendMessage failed for user ${profile.id}:`, body);
        // Roll back the log entry so the notification can be retried
        await supabase
          .from("notifications_log")
          .delete()
          .eq("id", logData.id);
      }
    } catch (err) {
      console.error(`[loop] processStreakNotifications: error for user ${profile.id}:`, err);
    }
  }
}

/**
 * Generate and deliver weekly summary messages to users who have ≥3 entries
 * in the past 7 days and have not opted out of weekly summaries.
 *
 * Free-tier users receive a simplified 3-5 bullet highlights summary.
 * Paid-tier users receive the full retrospective format.
 *
 * Idempotency: inserts a row into `reports` with `ON CONFLICT DO NOTHING`
 * on the unique constraint `(user_id, period_from, period_to)` so that
 * double-firing the Monday cron never sends duplicate summaries (Req 23.2).
 */
export async function processWeeklySummaries(): Promise<void> {
  const supabase = getServiceClient();
  const now = new Date();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const periodFrom = weekAgo.toISOString();
  const periodTo = now.toISOString();

  // Fetch all profiles that have NOT opted out of weekly summaries.
  // settings->notifications_weekly defaults to true when absent, so we
  // exclude only profiles where the flag is explicitly set to false.
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, telegram_id, subscription_tier, settings")
    .filter("settings->notifications_weekly", "neq", false);

  if (profilesError) {
    console.error("[loop] processWeeklySummaries: failed to fetch profiles:", profilesError.message);
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("[loop] processWeeklySummaries: TELEGRAM_BOT_TOKEN not set");
    return;
  }

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const { env: appEnv } = await import("@/lib/env");
  const { deriveUserKey, decryptField } = await import("@/lib/crypto");

  for (const profile of profiles ?? []) {
    try {
      // Count entries in the past 7 days
      const { count: recentCount, error: countError } = await supabase
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .gte("created_at", periodFrom);

      if (countError) {
        console.error(`[loop] processWeeklySummaries: count error for user ${profile.id}:`, countError.message);
        continue;
      }

      // Skip users with fewer than 3 entries this week
      if ((recentCount ?? 0) < 3) continue;

      // Attempt to claim this week's report slot via ON CONFLICT DO NOTHING.
      // If a row already exists for (user_id, period_from, period_to), the
      // insert is silently skipped and we do not send a duplicate summary.
      const { error: conflictError } = await supabase
        .from("reports")
        .insert({
          user_id: profile.id,
          period_type: "weekly",
          period_from: periodFrom,
          period_to: periodTo,
          content: "__pending__",
          summary: "__pending__",
          insights: [],
        })
        .select("id")
        .single();

      if (conflictError) {
        // Unique constraint violation (23505) means we already processed this week — skip
        if (conflictError.code === "23505") continue;
        console.error(`[loop] processWeeklySummaries: report insert error for user ${profile.id}:`, conflictError.message);
        continue;
      }

      // Fetch entries for the week (decrypt content)
      const { data: entries } = await supabase
        .from("entries")
        .select("content, category, metadata, created_at")
        .eq("user_id", profile.id)
        .gte("created_at", periodFrom)
        .lte("created_at", periodTo)
        .order("created_at", { ascending: true });

      const rawEntries = entries ?? [];

      // Decrypt entry content
      let decryptedEntries = rawEntries;
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
          decryptedEntries = await Promise.all(
            rawEntries.map(async (e: { content: string; category: string; metadata: Record<string, unknown>; created_at: string }) => ({
              ...e,
              content: await decryptField(e.content, key),
            }))
          );
        }
      } catch {
        // fallback: use raw entries
      }

      // Build entries text for the prompt
      const entriesText = decryptedEntries.map((e: { created_at: string; category: string; content: string; metadata: Record<string, unknown> }) => {
        const date = new Date(e.created_at).toLocaleDateString("uk-UA", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
        const metrics = e.metadata?.dashboard_metrics as Array<{ label: string; value: number; unit: string }> | undefined;
        const metricsStr = Array.isArray(metrics) && metrics.length > 0
          ? ` [${metrics.map((m) => `${m.label}: ${m.value}${m.unit}`).join(", ")}]`
          : "";
        return `[${date}] (${e.category}) ${e.content}${metricsStr}`;
      }).join("\n");

      const isPaid = profile.subscription_tier === "stars_basic" || profile.subscription_tier === "stars_pro";

      // Generate summary via Gemini
      const genAI = new GoogleGenerativeAI(appEnv.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      let summaryText = "";
      let summaryContent = "";

      if (isPaid) {
        // Full retrospective format for paid users
        const fullPrompt = `Проаналізуй записи щоденника за тиждень (${weekAgo.toLocaleDateString("uk-UA")} — ${now.toLocaleDateString("uk-UA")}):

${entriesText}

Склади тижневу ретроспективу у форматі:
✅ ЩО ПРОЙШЛО ДОБРЕ?
❌ ЩО НЕ СПРАЦЮВАЛО?
🔄 СТАРТ / СТОП / ПРОДОВЖИТИ
🧪 ОДИН ЕКСПЕРИМЕНТ
💡 ГОЛОВНИЙ УРОК

Тон: теплий, підтримуючий. Відповідай українською мовою. Використовуй Telegram Markdown.`;

        try {
          const result = await model.generateContent(fullPrompt);
          summaryContent = result.response.text().trim();
          summaryText = summaryContent.split("\n").slice(0, 3).join(" ").substring(0, 200);
        } catch (err) {
          console.error(`[loop] processWeeklySummaries: Gemini full retro error for user ${profile.id}:`, err);
          // Clean up the placeholder report row
          await supabase
            .from("reports")
            .delete()
            .eq("user_id", profile.id)
            .eq("period_from", periodFrom)
            .eq("period_to", periodTo)
            .eq("content", "__pending__");
          continue;
        }
      } else {
        // Simplified highlights for free-tier users (3-5 bullets)
        const freePrompt = `Проаналізуй записи щоденника за тиждень (${weekAgo.toLocaleDateString("uk-UA")} — ${now.toLocaleDateString("uk-UA")}):

${entriesText}

Склади короткий підсумок тижня: 3-5 ключових моментів у вигляді маркованого списку.
Формат: кожен пункт починається з емодзі та короткого речення.
Відповідай українською мовою. Використовуй Telegram Markdown.`;

        try {
          const result = await model.generateContent(freePrompt);
          summaryContent = result.response.text().trim();
          summaryText = summaryContent.split("\n").slice(0, 2).join(" ").substring(0, 200);
        } catch (err) {
          console.error(`[loop] processWeeklySummaries: Gemini highlights error for user ${profile.id}:`, err);
          // Clean up the placeholder report row
          await supabase
            .from("reports")
            .delete()
            .eq("user_id", profile.id)
            .eq("period_from", periodFrom)
            .eq("period_to", periodTo)
            .eq("content", "__pending__");
          continue;
        }
      }

      // Update the placeholder report with the generated content
      const { error: updateError } = await supabase
        .from("reports")
        .update({
          content: summaryContent,
          summary: summaryText,
        })
        .eq("user_id", profile.id)
        .eq("period_from", periodFrom)
        .eq("period_to", periodTo)
        .eq("content", "__pending__");

      if (updateError) {
        console.error(`[loop] processWeeklySummaries: report update error for user ${profile.id}:`, updateError.message);
        continue;
      }

      // Deliver via Telegram bot message
      const fromLabel = weekAgo.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
      const toLabel = now.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
      const header = isPaid
        ? `📊 *Тижневий звіт* · ${fromLabel} — ${toLabel}\n\n`
        : `📝 *Підсумок тижня* · ${fromLabel} — ${toLabel}\n\n`;

      const messageText = header + summaryContent;
      const chatId = String(profile.telegram_id);

      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: messageText,
            parse_mode: "Markdown",
          }),
        }
      );

      if (!res.ok) {
        const body = await res.text();
        console.error(`[loop] processWeeklySummaries: sendMessage failed for user ${profile.id}:`, body);
      }
    } catch (err) {
      console.error(`[loop] processWeeklySummaries: error for user ${profile.id}:`, err);
    }
  }
}

/**
 * Main per-user processing function.
 * 1. Re-embeds pending entries (new + edited)
 * 2. Retries previously failed embeddings (up to 3 total attempts)
 * 3. Re-clusters entries via pgvector similarity
 * 4. Builds and saves widget configs (delegated to widgets.ts)
 * 5. Auto-increments active streaks
 */
export async function processUser(userId: string): Promise<void> {
  await reembedPendingEntries(userId).catch(err => console.error("[loop] reembedPendingEntries failed:", err));
  await retryFailedEmbeddings(userId).catch(err => console.error("[loop] retryFailedEmbeddings failed:", err));
  await clusterEntries(userId);
  const { buildAndSaveWidgets } = await import("./widgets");
  await buildAndSaveWidgets(userId);
  await autoIncrementStreaks(userId).catch(err => console.error("[loop] autoIncrementStreaks failed:", err));
}

/**
 * Process all users in the system.
 * Each user is processed in an isolated try/catch — one failure does not abort others.
 */
export async function processAllUsers(): Promise<void> {
  const supabase = getServiceClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id");

  if (error) {
    throw new Error(`[loop] Failed to fetch profiles: ${error.message}`);
  }

  for (const profile of profiles ?? []) {
    try {
      await processUser(profile.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[loop] processUser failed for user_id=${profile.id}:`, message);
      // Continue to next user
    }
  }
}
