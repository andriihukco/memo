import { Context } from "grammy";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Profile } from "@/lib/profile";
import type { ClassificationResult } from "@/lib/classifier";

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

      // Build query
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

      // Store ids in profiles.settings.pending_delete so callback can retrieve them
      const { data: profileData } = await supabase.from("profiles").select("settings").eq("id", profile.id).single();
      const pendingKey = `del_${Date.now()}`;
      await supabase.from("profiles").update({
        settings: { ...(profileData?.settings ?? {}), [pendingKey]: ids },
      }).eq("id", profile.id);

      await ctx.reply(
        `🗑 Знайшов *${ids.length}* записів (${description}).\n\nВидалити їх? Це незворотньо.`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Так, видалити", callback_data: `del:key:${pendingKey}` },
              { text: "❌ Скасувати", callback_data: `del:cancel:${pendingKey}` },
            ]],
          },
        }
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

// ── Callback handler for delete confirmation ──────────────────────────────────

export async function handleDeleteCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("del:")) return;

  await ctx.answerCallbackQuery();

  if (data.startsWith("del:cancel:")) {
    const pendingKey = data.slice("del:cancel:".length);
    // Clean up pending key
    const supabase = getServiceClient();
    const profile = ctx.profile;
    if (profile) {
      const { data: profileData } = await supabase.from("profiles").select("settings").eq("id", profile.id).single();
      if (profileData?.settings) {
        const settings = { ...(profileData.settings as Record<string, unknown>) };
        delete settings[pendingKey];
        await supabase.from("profiles").update({ settings }).eq("id", profile.id);
      }
    }
    await ctx.editMessageText("❌ Видалення скасовано.");
    return;
  }

  if (data.startsWith("del:key:")) {
    const pendingKey = data.slice("del:key:".length);
    const supabase = getServiceClient();
    const profile = ctx.profile;
    if (!profile) return;

    // Retrieve ids from profile settings
    const { data: profileData } = await supabase.from("profiles").select("settings").eq("id", profile.id).single();
    const ids = (profileData?.settings as Record<string, unknown>)?.[pendingKey] as string[] | undefined;

    if (!ids || ids.length === 0) {
      await ctx.editMessageText("⚠️ Не вдалося знайти записи для видалення.");
      return;
    }

    // Delete in batches of 100 to avoid query limits
    let totalDeleted = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const { error } = await supabase.from("entries").delete().in("id", batch);
      if (error) {
        console.error("[action] batch delete error:", error.message);
      } else {
        totalDeleted += batch.length;
      }
    }

    // Clean up pending key
    const settings = { ...(profileData?.settings as Record<string, unknown>) };
    delete settings[pendingKey];
    await supabase.from("profiles").update({ settings }).eq("id", profile.id);

    await ctx.editMessageText(`✅ Видалено *${totalDeleted}* записів.`, { parse_mode: "Markdown" });
    return;
  }
}
