/**
 * Streak and expiry notification functions for the daily cron job.
 *
 * REQ-08: Streak Notifications
 * - Users with ≥3-day streak who haven't logged today get a reminder with streak count
 * - Users with no streak get a softer nudge (max once per 3 days)
 * - Only users active in the last 7 days are considered
 * - Deduplication via notifications_log (type: 'streak_reminder')
 *
 * REQ-11: Subscription Expiry Notifications
 * - 7-day warning before subscription expires
 * - 1-day warning before subscription expires
 * - Notification on day of expiry with renewal CTA
 * - Deduplication via notifications_log (types: 'subscription_expiry_7d', 'subscription_expiry_1d', 'subscription_expired')
 * - Each notification includes InlineKeyboard button → Mini App subscriptions page
 */

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { TIER_INFO, type SubscriptionTier } from "@/lib/stars/paywall";

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Calculate the current streak length for a user, counting consecutive days
 * with at least one entry going back from yesterday.
 *
 * @param userId - UUID of the user
 * @param supabase - Supabase client instance
 * @returns Number of consecutive days with entries (0 if no streak)
 */
export async function calculateStreakLength(
  userId: string,
  supabase: ReturnType<typeof createClient>
): Promise<number> {
  // Fetch entries from the last 90 days to cover any realistic streak
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: entries, error } = await supabase
    .from("entries")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", ninetyDaysAgo)
    .order("created_at", { ascending: false }) as unknown as { data: Array<{ created_at: string }> | null; error: unknown };

  if (error || !entries || entries.length === 0) {
    return 0;
  }

  // Build a set of unique dates (YYYY-MM-DD) that have entries
  const datesWithEntries = new Set<string>();
  for (const entry of entries) {
    const date = new Date(entry.created_at).toISOString().slice(0, 10);
    datesWithEntries.add(date);
  }

  // Count consecutive days going back from yesterday (all in UTC)
  const todayUTC = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  let streak = 0;
  // Start from yesterday in UTC
  const cursorDate = new Date(`${todayUTC}T00:00:00Z`);
  cursorDate.setUTCDate(cursorDate.getUTCDate() - 1);

  while (true) {
    const dateStr = cursorDate.toISOString().slice(0, 10);
    if (!datesWithEntries.has(dateStr)) {
      break;
    }
    streak++;
    cursorDate.setUTCDate(cursorDate.getUTCDate() - 1);
  }

  return streak;
}

/**
 * Send streak reminder notifications to users who:
 * 1. Have been active in the last 7 days
 * 2. Have NOT logged any entry today
 * 3. Have not already received a streak_reminder today (deduplication)
 *
 * Users with streak ≥3 days receive: "Не забудь записати свій день 🔥 Стрік: N днів"
 * Users with no streak receive a softer nudge (max once per 3 days)
 *
 * REQ-08 acceptance criteria:
 * - Daily cron at 20:00 UTC checks users who haven't logged any entry today
 * - Users with streak ≥3 days receive a gentle reminder with streak count
 * - Users with no streak receive a softer nudge (max once per 3 days)
 * - Notification only sent if user has interacted with bot in the last 7 days
 */
export async function sendStreakReminders(): Promise<void> {
  const supabase = getServiceClient();

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Find users who had entries in the last 7 days (active users)
  const { data: activeUserRows, error: activeError } = await supabase
    .from("entries")
    .select("user_id")
    .gte("created_at", sevenDaysAgo);

  if (activeError) {
    console.error("[notifications] sendStreakReminders: failed to fetch active users:", activeError.message);
    return;
  }

  if (!activeUserRows || activeUserRows.length === 0) return;

  // Deduplicate user IDs
  const activeUserIds = [...new Set(activeUserRows.map((r: { user_id: string }) => r.user_id))];

  // 2. Filter: users who have NOT logged any entry today
  const { data: todayEntryRows, error: todayError } = await supabase
    .from("entries")
    .select("user_id")
    .in("user_id", activeUserIds)
    .gte("created_at", todayStart.toISOString());

  if (todayError) {
    console.error("[notifications] sendStreakReminders: failed to fetch today's entries:", todayError.message);
    return;
  }

  const usersWithTodayEntry = new Set(
    (todayEntryRows ?? []).map((r: { user_id: string }) => r.user_id)
  );

  const usersToNotify = activeUserIds.filter((id) => !usersWithTodayEntry.has(id));

  if (usersToNotify.length === 0) return;

  // Fetch profiles for users to notify (telegram_id + settings for opt-out check)
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, telegram_id, settings")
    .in("id", usersToNotify);

  if (profilesError) {
    console.error("[notifications] sendStreakReminders: failed to fetch profiles:", profilesError.message);
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("[notifications] sendStreakReminders: TELEGRAM_BOT_TOKEN not set");
    return;
  }

  for (const profile of profiles ?? []) {
    try {
      // Check opt-out: skip if notifications_streak is explicitly false
      const settings = profile.settings as Record<string, unknown> | null;
      if (settings?.notifications_streak === false) continue;

      // 4. Check notifications_log — skip if streak_reminder already sent today
      const { data: existingLog, error: logCheckError } = await supabase
        .from("notifications_log")
        .select("id")
        .eq("user_id", profile.id)
        .eq("type", "streak_reminder")
        .eq("date", todayStr)
        .maybeSingle();

      if (logCheckError) {
        console.error(`[notifications] sendStreakReminders: log check error for user ${profile.id}:`, logCheckError.message);
        continue;
      }

      if (existingLog) continue; // Already sent today

      // 3. Calculate streak length from yesterday's entries
      const streakLength = await calculateStreakLength(profile.id, supabase);

      let messageText: string;

      if (streakLength >= 3) {
        // Users with streak ≥3 days: send reminder with streak count
        messageText = `Не забудь записати свій день 🔥 Стрік: ${streakLength} днів`;
      } else {
        // Users with no streak (or streak < 3): softer nudge, max once per 3 days
        // Check if we sent a nudge in the last 3 days
        const { data: recentNudge, error: nudgeCheckError } = await supabase
          .from("notifications_log")
          .select("id")
          .eq("user_id", profile.id)
          .eq("type", "streak_reminder")
          .gte("date", threeDaysAgo.slice(0, 10))
          .maybeSingle();

        if (nudgeCheckError) {
          console.error(`[notifications] sendStreakReminders: nudge check error for user ${profile.id}:`, nudgeCheckError.message);
          continue;
        }

        if (recentNudge) continue; // Already nudged within 3 days

        messageText = "Як пройшов твій день? Зроби запис 📝";
      }

      // 5. Check notifications_log before sending (already done above)
      // 6. Insert into notifications_log after sending
      const { error: insertError } = await supabase
        .from("notifications_log")
        .insert({ user_id: profile.id, type: "streak_reminder", date: todayStr });

      if (insertError) {
        // Unique constraint violation means we already sent today — skip
        if (insertError.code === "23505") continue;
        console.error(`[notifications] sendStreakReminders: log insert error for user ${profile.id}:`, insertError.message);
        continue;
      }

      // Send via Telegram Bot API
      const chatId = String(profile.telegram_id);
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: messageText,
          }),
        }
      );

      if (!res.ok) {
        const body = await res.text();
        console.error(`[notifications] sendStreakReminders: sendMessage failed for user ${profile.id}:`, body);
        // Roll back the log entry so the notification can be retried
        await supabase
          .from("notifications_log")
          .delete()
          .eq("user_id", profile.id)
          .eq("type", "streak_reminder")
          .eq("date", todayStr);
      }
    } catch (err) {
      console.error(`[notifications] sendStreakReminders: error for user ${profile.id}:`, err);
    }
  }
}

/**
 * Returns the human-readable tier name for use in notification messages.
 * e.g. "stars_basic" → "Memo Nova"
 */
function getTierDisplayName(tier: string): string {
  const info = TIER_INFO[tier as SubscriptionTier];
  return info ? info.name : tier;
}

/**
 * Send subscription expiry reminder notifications to users whose subscriptions
 * are expiring in 7 days, 1 day, or today.
 *
 * Notification types and messages:
 * - `subscription_expiry_7d`: "Твоя підписка {tier} закінчується через 7 днів. Продовж, щоб не втратити доступ."
 * - `subscription_expiry_1d`: "Завтра закінчується твоя підписка {tier}!"
 * - `subscription_expired`:   "Твоя підписка {tier} закінчилась. Твої дані в безпеці — поновити підписку?"
 *
 * Each notification includes an InlineKeyboard button linking to the Mini App subscriptions page.
 * Deduplication is handled via notifications_log — each type is sent at most once per day per user.
 *
 * REQ-11 acceptance criteria:
 * - Bot sends reminder 7 days before subscription expires
 * - Bot sends reminder 1 day before expiry
 * - Bot sends notification on day of expiry with renewal CTA
 * - Each notification sent only once (tracked in notifications_log)
 * - Notification includes inline button to open Mini App subscriptions page
 */
export async function sendExpiryReminders(): Promise<void> {
  const supabase = getServiceClient();

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("[notifications] sendExpiryReminders: TELEGRAM_BOT_TOKEN not set");
    return;
  }

  const miniAppUrl = process.env.MINIAPP_URL ?? env.MINIAPP_URL ?? "";
  const subscriptionsUrl = miniAppUrl
    ? `${miniAppUrl.replace(/\/$/, "")}/subscriptions`
    : "";

  // Query profiles with subscription_ends_at in the next 8 days (covers today through 7 days out)
  // This catches: expired today (ends_at <= now+0d), 1-day warning (ends_at ≈ now+1d), 7-day warning (ends_at ≈ now+7d)
  const eightDaysFromNow = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString();

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, telegram_id, subscription_tier, subscription_ends_at")
    .gte("subscription_ends_at", now.toISOString())
    .lte("subscription_ends_at", eightDaysFromNow)
    .not("subscription_tier", "eq", "free");

  if (profilesError) {
    console.error("[notifications] sendExpiryReminders: failed to fetch profiles:", profilesError.message);
    return;
  }

  if (!profiles || profiles.length === 0) return;

  for (const profile of profiles) {
    try {
      if (!profile.telegram_id || !profile.subscription_ends_at) continue;

      const endsAt = new Date(profile.subscription_ends_at);
      const tierName = getTierDisplayName(profile.subscription_tier ?? "free");

      // Calculate days until expiry (floor, so "today" = 0, "tomorrow" = 1, "7 days" = 7)
      const msUntilExpiry = endsAt.getTime() - now.getTime();
      const daysUntilExpiry = Math.floor(msUntilExpiry / (24 * 60 * 60 * 1000));

      // Determine which notification type applies
      let notificationType: string;
      let messageText: string;

      if (daysUntilExpiry <= 0) {
        // Subscription expires today (or already expired within the window)
        notificationType = "subscription_expired";
        messageText = `Твоя підписка ${tierName} закінчилась. Твої дані в безпеці — поновити підписку?`;
      } else if (daysUntilExpiry === 1) {
        // Expires tomorrow
        notificationType = "subscription_expiry_1d";
        messageText = `Завтра закінчується твоя підписка ${tierName}!`;
      } else if (daysUntilExpiry <= 7) {
        // Expires in 2–7 days — send the 7-day warning (only once, deduplicated by date)
        notificationType = "subscription_expiry_7d";
        messageText = `Твоя підписка ${tierName} закінчується через 7 днів. Продовж, щоб не втратити доступ.`;
      } else {
        // More than 7 days away — skip
        continue;
      }

      // Deduplication: check if this notification type was already sent today
      const { data: existingLog, error: logCheckError } = await supabase
        .from("notifications_log")
        .select("id")
        .eq("user_id", profile.id)
        .eq("type", notificationType)
        .eq("date", todayStr)
        .maybeSingle();

      if (logCheckError) {
        console.error(
          `[notifications] sendExpiryReminders: log check error for user ${profile.id}:`,
          logCheckError.message
        );
        continue;
      }

      if (existingLog) continue; // Already sent today

      // Insert into notifications_log before sending (prevents double-send on retry)
      const { error: insertError } = await supabase
        .from("notifications_log")
        .insert({ user_id: profile.id, type: notificationType, date: todayStr });

      if (insertError) {
        // Unique constraint violation means we already sent today — skip
        if (insertError.code === "23505") continue;
        console.error(
          `[notifications] sendExpiryReminders: log insert error for user ${profile.id}:`,
          insertError.message
        );
        continue;
      }

      // Build the message payload with InlineKeyboard button → subscriptions page
      const chatId = String(profile.telegram_id);
      const messagePayload: Record<string, unknown> = {
        chat_id: chatId,
        text: messageText,
      };

      if (subscriptionsUrl) {
        messagePayload.reply_markup = {
          inline_keyboard: [
            [
              {
                text: "Поновити підписку",
                web_app: { url: subscriptionsUrl },
              },
            ],
          ],
        };
      }

      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(messagePayload),
        }
      );

      if (!res.ok) {
        const body = await res.text();
        console.error(
          `[notifications] sendExpiryReminders: sendMessage failed for user ${profile.id}:`,
          body
        );
        // Roll back the log entry so the notification can be retried
        await supabase
          .from("notifications_log")
          .delete()
          .eq("user_id", profile.id)
          .eq("type", notificationType)
          .eq("date", todayStr);
      }
    } catch (err) {
      console.error(`[notifications] sendExpiryReminders: error for user ${profile.id}:`, err);
    }
  }
}
