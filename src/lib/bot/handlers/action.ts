import { Context } from "grammy";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Profile } from "@/lib/profile";
import type { ClassificationResult } from "@/lib/classifier";
import { deriveUserKey, decryptField } from "@/lib/crypto";
import type { Locale } from "@/i18n/locales";
import { t } from "@/i18n/t";

interface BotContext extends Context {
  profile?: Profile;
  locale: Locale;
}

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// UTC+3 aware period → UTC date range
const USER_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

function periodToRange(period: string | null): { from: Date; to: Date } | null {
  if (!period || period === "all") return null;

  // Shift now into user-local time
  const nowUtc = Date.now();
  const localNow = new Date(nowUtc + USER_UTC_OFFSET_MS);

  // Compute local midnight
  const localMidnight = new Date(localNow);
  localMidnight.setUTCHours(0, 0, 0, 0);

  // Convert local midnight back to UTC
  const todayStartUtc = new Date(localMidnight.getTime() - USER_UTC_OFFSET_MS);
  const todayEndUtc   = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

  if (period === "today") {
    return { from: todayStartUtc, to: todayEndUtc };
  }
  if (period === "week") {
    return { from: new Date(todayStartUtc.getTime() - 7 * 24 * 60 * 60 * 1000), to: new Date(nowUtc) };
  }
  if (period === "month") {
    return { from: new Date(todayStartUtc.getTime() - 30 * 24 * 60 * 60 * 1000), to: new Date(nowUtc) };
  }
  return null;
}

// ── Pending state helpers ─────────────────────────────────────────────────────
// Stored in profile.settings so it survives across messages

async function setPendingSetting(userId: string, key: string, value: unknown): Promise<void> {
  const supabase = getServiceClient();
  const { data } = await supabase.from("profiles").select("settings").eq("id", userId).single();
  await supabase.from("profiles").update({
    settings: { ...(data?.settings ?? {}), [key]: value },
  }).eq("id", userId);
}

async function clearPendingSetting(userId: string, key: string): Promise<void> {
  const supabase = getServiceClient();
  const { data } = await supabase.from("profiles").select("settings").eq("id", userId).single();
  if (data?.settings) {
    const settings = { ...(data.settings as Record<string, unknown>) };
    delete settings[key];
    await supabase.from("profiles").update({ settings }).eq("id", userId);
  }
}

// ── Check if user has a pending delete confirmation ───────────────────────────

export async function checkPendingDelete(ctx: BotContext): Promise<boolean> {
  const profile = ctx.profile;
  if (!profile) return false;

  const text = ctx.message?.text?.trim().toLowerCase();
  if (!text) return false;

  const supabase = getServiceClient();
  const { data } = await supabase.from("profiles").select("settings").eq("id", profile.id).single();
  const settings = (data?.settings ?? {}) as Record<string, unknown>;

  const pendingKey = Object.keys(settings).find(k => k.startsWith("del_"));
  if (!pendingKey) return false;

  const ids = settings[pendingKey] as string[];

  if (["так", "yes", "підтверджую", "видали", "delete"].includes(text)) {
    let totalDeleted = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const { error } = await supabase.from("entries").delete().in("id", batch);
      if (!error) totalDeleted += batch.length;
    }
    await clearPendingSetting(profile.id, pendingKey);
    await ctx.reply(t('bot.action.deleted', ctx.locale, { count: String(totalDeleted) }));
    return true;
  }

  if (["ні", "no", "скасувати", "скасуй", "cancel"].includes(text)) {
    await clearPendingSetting(profile.id, pendingKey);
    await ctx.reply(t('bot.action.cancel_delete', ctx.locale));
    return true;
  }

  await ctx.reply(
    t('bot.action.pending_delete', ctx.locale, { count: String(ids.length) }),
    { parse_mode: "Markdown" }
  );
  return true;
}

// ── Main action handler ───────────────────────────────────────────────────────

export async function handleAction(ctx: BotContext, result: ClassificationResult): Promise<void> {
  const profile = ctx.profile;
  if (!profile) return;

  const supabase = getServiceClient();
  const params = result.action_params as Record<string, unknown>;

  switch (result.action_type) {

    // ── DELETE ──────────────────────────────────────────────────────────────
    case "delete_entries": {
      const category = (params.category as string | null) || null;
      const period   = (params.period   as string | null) || null;
      const description = (params.description as string) ?? "записи";

      let query = supabase.from("entries").select("id, content, created_at").eq("user_id", profile.id);
      if (category) query = query.eq("category", category);
      const range = periodToRange(period);
      if (range) {
        query = query
          .gte("created_at", range.from.toISOString())
          .lte("created_at", range.to.toISOString());
      }

      const { data: toDelete } = await query;
      const ids = (toDelete ?? []).map((e: { id: string }) => e.id);

      if (ids.length === 0) {
        await ctx.reply(t('bot.action.not_found_delete', ctx.locale, { description }));
        return;
      }

      // Decrypt entry content for preview
      let cryptoKey: CryptoKey | null = null;
      try {
        const supabaseForSalt = getServiceClient();
        const { data: profileForSalt } = await supabaseForSalt
          .from("profiles")
          .select("encryption_salt")
          .eq("id", profile.id)
          .single();
        cryptoKey = await deriveUserKey(
          profile.telegram_id.toString(),
          profileForSalt?.encryption_salt ?? null
        );
      } catch { /* fallback */ }

      const decryptedEntries = await Promise.all(
        (toDelete ?? []).map(async (e: { id: string; content: string; created_at: string }) => {
          let content = e.content;
          if (cryptoKey) {
            try { content = await decryptField(content, cryptoKey); } catch { /* use as-is */ }
          }
          return { ...e, content };
        })
      );

      // Show a preview of what will be deleted
      const preview = decryptedEntries
        .slice(0, 3)
        .map((e) => `• ${e.content.slice(0, 60)}${e.content.length > 60 ? "…" : ""}`)
        .join("\n");

      const pendingKey = `del_${Date.now()}`;
      await setPendingSetting(profile.id, pendingKey, ids);

      await ctx.reply(
        t('bot.action.pending_delete', ctx.locale, { count: String(ids.length) }) +
          `\n\n${preview}${ids.length > 3 ? `\n_...і ще ${ids.length - 3}_` : ""}`,
        { parse_mode: "Markdown" }
      );
      break;
    }

    // ── UPDATE / EDIT ────────────────────────────────────────────────────────
    case "update_entry": {
      const entryId     = params.entry_id    as string | undefined;
      const newContent  = params.new_content  as string | undefined;
      const newCategory = params.new_category as string | undefined;
      // description is extracted for context but search uses category/entry_id

      // If no entry_id provided, find the most recent matching entry
      let targetId = entryId;
      if (!targetId) {
        const searchCategory = newCategory ?? (params.category as string | undefined);
        let q = supabase
          .from("entries")
          .select("id, content")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (searchCategory) q = q.eq("category", searchCategory);
        const { data } = await q;
        targetId = data?.[0]?.id;
      }

      if (!targetId) {
        await ctx.reply(t('bot.action.edit_not_found', ctx.locale), { parse_mode: "Markdown" });
        return;
      }

      const updates: Record<string, unknown> = {};
      if (newContent) updates.content = newContent;
      if (newCategory) updates.category = newCategory;

      if (Object.keys(updates).length === 0) {
        await ctx.reply(t('bot.action.edit_no_changes', ctx.locale), { parse_mode: "Markdown" });
        return;
      }

      const { data: updated, error } = await supabase
        .from("entries")
        .update(updates)
        .eq("id", targetId)
        .eq("user_id", profile.id)
        .select("content, category")
        .single();

      if (error || !updated) {
        console.error("[action] update_entry error:", error?.message);
        await ctx.reply(t('bot.action.edit_error', ctx.locale));
        return;
      }

      await ctx.reply(
        t('bot.action.edit_success', ctx.locale, { content: updated.content }),
        { parse_mode: "Markdown" }
      );

      // Re-embed the updated entry asynchronously
      const { embedEntry } = await import("@/lib/embedding");
      embedEntry(targetId, updated.content, {
        userId: profile.id,
        category: updated.category,
        created_at: new Date().toISOString(),
      }).catch((err) => console.error("[action] re-embed after update failed:", err));

      break;
    }

    // ── CREATE WIDGET ────────────────────────────────────────────────────────
    case "create_widget": {
      const metricKey   = params.metric_key  as string;
      const label       = params.label       as string;
      const unit        = params.unit        as string;
      const description = (params.description as string) ?? "";

      await ctx.reply(
        t('bot.action.widget_created', ctx.locale, {
          label,
          unit,
          description,
          metricKey,
        }),
        { parse_mode: "Markdown" }
      );
      break;
    }

    // ── MERGE WIDGETS ────────────────────────────────────────────────────────
    case "merge_widgets": {
      const keys     = params.keys      as string[];
      const newLabel = params.new_label as string;
      await ctx.reply(
        t('bot.action.merge_wip', ctx.locale, {
          keys: keys.join(" + "),
          newLabel,
        }),
        { parse_mode: "Markdown" }
      );
      break;
    }

    // ── UPDATE SCHEDULE ──────────────────────────────────────────────────────
    case "update_schedule": {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("settings")
        .eq("id", profile.id)
        .single();

      const currentSettings = (profileData?.settings ?? {}) as Record<string, unknown>;
      const currentSchedule = (currentSettings.report_schedule ?? {}) as Record<string, unknown>;

      // Merge only the fields the user mentioned
      const newSchedule: Record<string, unknown> = { ...currentSchedule };
      if (params.daily   !== undefined) newSchedule.daily   = params.daily;
      if (params.weekly  !== undefined) newSchedule.weekly  = params.weekly;
      if (params.monthly !== undefined) newSchedule.monthly = params.monthly;
      if (params.time    !== undefined) newSchedule.time    = params.time;

      await supabase.from("profiles").update({
        settings: { ...currentSettings, report_schedule: newSchedule },
      }).eq("id", profile.id);

      // Build a human-readable confirmation
      const parts: string[] = [];
      if (newSchedule.daily   === true)  parts.push(t('bot.action.schedule.daily_on', ctx.locale));
      if (newSchedule.daily   === false) parts.push(t('bot.action.schedule.daily_off', ctx.locale));
      if (newSchedule.weekly  === true)  parts.push(t('bot.action.schedule.weekly_on', ctx.locale));
      if (newSchedule.weekly  === false) parts.push(t('bot.action.schedule.weekly_off', ctx.locale));
      if (newSchedule.monthly === true)  parts.push(t('bot.action.schedule.monthly_on', ctx.locale));
      if (newSchedule.monthly === false) parts.push(t('bot.action.schedule.monthly_off', ctx.locale));
      const timeStr = newSchedule.time ? ` о *${newSchedule.time}*` : "";

      await ctx.reply(
        t('bot.action.schedule_updated', ctx.locale, {
          time: timeStr,
          parts: parts.join(", ") || t('bot.action.schedule.no_changes', ctx.locale),
        }),
        { parse_mode: "Markdown" }
      );
      break;
    }

    default:
      await ctx.reply(t('bot.action.unknown', ctx.locale));
  }
}
