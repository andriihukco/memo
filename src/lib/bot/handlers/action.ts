import { Context } from "grammy";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Profile } from "@/lib/profile";
import type { ClassificationResult } from "@/lib/classifier";
import { getReportSchedule, setReportSchedule } from "@/lib/bot/retrospective";

interface BotContext extends Context {
  profile?: Profile;
}

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function periodToRange(period: string | null): { from: Date; to: Date } | null {
  if (!period || period === "all") return null;
  const now = new Date();
  if (period === "today") {
    const from = new Date(now); from.setHours(0,0,0,0);
    const to = new Date(now); to.setHours(23,59,59,999);
    return { from, to };
  }
  if (period === "week") {
    const from = new Date(now); from.setDate(now.getDate() - 7); from.setHours(0,0,0,0);
    return { from, to: now };
  }
  if (period === "month") {
    const from = new Date(now); from.setDate(now.getDate() - 30); from.setHours(0,0,0,0);
    return { from, to: now };
  }
  return null;
}

// ── Pending delete state ──────────────────────────────────────────────────────
// Stored in profile.settings so it survives across messages

async function setPendingDelete(userId: string, key: string, ids: string[]): Promise<void> {
  const supabase = getServiceClient();
  const { data } = await supabase.from("profiles").select("settings").eq("id", userId).single();
  await supabase.from("profiles").update({
    settings: { ...(data?.settings ?? {}), [key]: ids },
  }).eq("id", userId);
}

async function getPendingDelete(userId: string, key: string): Promise<string[] | null> {
  const supabase = getServiceClient();
  const { data } = await supabase.from("profiles").select("settings").eq("id", userId).single();
  return (data?.settings as Record<string, unknown>)?.[key] as string[] | null ?? null;
}

async function clearPendingDelete(userId: string, key: string): Promise<void> {
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

  // Find any pending delete key
  const pendingKey = Object.keys(settings).find(k => k.startsWith("del_"));
  if (!pendingKey) return false;

  const ids = settings[pendingKey] as string[];

  if (text === "так" || text === "yes" || text === "підтверджую" || text === "видали" || text === "delete") {
    // Execute delete
    const supabase2 = getServiceClient();
    let totalDeleted = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const { error } = await supabase2.from("entries").delete().in("id", batch);
      if (!error) totalDeleted += batch.length;
    }
    await clearPendingDelete(profile.id, pendingKey);
    await ctx.reply(`✅ Видалено ${totalDeleted} записів.`);
    return true;
  }

  if (text === "ні" || text === "no" || text === "скасувати" || text === "скасуй" || text === "cancel") {
    await clearPendingDelete(profile.id, pendingKey);
    await ctx.reply("❌ Видалення скасовано.");
    return true;
  }

  // User has a pending delete but typed something else — remind them
  await ctx.reply(
    `⏳ Очікую підтвердження видалення ${ids.length} записів.\n\nНапиши *так* щоб видалити або *ні* щоб скасувати.`,
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
    case "delete_entries": {
      const category = params.category as string | null;
      const period = params.period as string | null;
      const description = params.description as string ?? "записи";

      let query = supabase.from("entries").select("id").eq("user_id", profile.id);
      if (category) query = query.eq("category", category);
      const range = periodToRange(period);
      if (range) {
        query = query.gte("created_at", range.from.toISOString()).lte("created_at", range.to.toISOString());
      }

      const { data: toDelete } = await query;
      const ids = (toDelete ?? []).map((e: { id: string }) => e.id);

      if (ids.length === 0) {
        await ctx.reply(`Не знайшов записів для видалення (${description}). 🤷`);
        return;
      }

      const pendingKey = `del_${Date.now()}`;
      await setPendingDelete(profile.id, pendingKey, ids);

      await ctx.reply(
        `🗑 Знайшов *${ids.length}* записів (${description}).\n\nНапиши *так* щоб видалити або *ні* щоб скасувати. Це незворотньо.`,
        { parse_mode: "Markdown" }
      );
      break;
    }

    case "update_schedule": {
      const schedule = params as {
        daily?: boolean;
        weekly?: boolean;
        monthly?: boolean;
        time?: string;
      };
      const current = await getReportSchedule(profile.id);
      const updated = {
        daily:   schedule.daily   !== undefined ? schedule.daily   : current.daily,
        weekly:  schedule.weekly  !== undefined ? schedule.weekly  : current.weekly,
        monthly: schedule.monthly !== undefined ? schedule.monthly : current.monthly,
        time:    schedule.time    ?? current.time,
      };
      await setReportSchedule(profile.id, updated);
      await ctx.reply(
        `✅ Налаштування звітів оновлено:\n\n` +
        `Щоденний: ${updated.daily ? "✅" : "❌"}\n` +
        `Тижневий: ${updated.weekly ? "✅" : "❌"}\n` +
        `Місячний: ${updated.monthly ? "✅" : "❌"}\n` +
        `Час: ${updated.time}`
      );
      break;
    }

    case "create_widget": {
      const metricKey = params.metric_key as string;
      const label = params.label as string;
      const unit = params.unit as string;
      const description = params.description as string ?? "";

      await ctx.reply(
        `✨ Зрозумів! Виджет *${label}* (${unit}) буде з'являтись на дашборді автоматично, як тільки ти почнеш записувати ${description}.\n\nПросто скажи мені, наприклад: _"Медитував 20 хвилин"_ — і я сам додам метрику \`${metricKey}\` до запису.`,
        { parse_mode: "Markdown" }
      );
      break;
    }

    case "merge_widgets": {
      const keys = params.keys as string[];
      const newLabel = params.new_label as string;
      await ctx.reply(
        `🔗 Об'єднання виджетів *${keys.join(" + ")}* у *${newLabel}* — ця функція поки в розробці. Але я вже знаю про твоє бажання! 😊`,
        { parse_mode: "Markdown" }
      );
      break;
    }

    default:
      await ctx.reply("Не зрозумів, яку дію виконати. Спробуй сформулювати інакше.");
  }
}
