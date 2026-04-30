import { Context, InlineKeyboard } from "grammy";
import type { Profile } from "@/lib/profile";
import { generateRetrospective, saveReport, formatReportForTelegram } from "@/lib/bot/retrospective";
import { getRecommendationsForUser } from "@/lib/bot/recommendations";
import { sanitizeMarkdown } from "@/lib/utils";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { DashboardMetric } from "@/lib/classifier";
import type { Locale } from "@/i18n/locales";
import { SUPPORTED_LOCALES, LOCALE_META } from "@/i18n/locales";
import { t } from "@/i18n/t";
import { getMetricValueByKey } from "@/lib/nutrition";

interface BotContext extends Context {
  profile?: Profile;
  locale: Locale;
}

// UTC+3 offset
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

function localNow(): Date {
  return new Date(Date.now() + TZ_OFFSET_MS);
}

function localDayBounds(): { from: Date; to: Date } {
  const local = localNow();
  const midnight = new Date(local);
  midnight.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(midnight);
  endOfDay.setUTCHours(23, 59, 59, 999);
  return {
    from: new Date(midnight.getTime() - TZ_OFFSET_MS),
    to: new Date(endOfDay.getTime() - TZ_OFFSET_MS),
  };
}

function localWeekBounds(): { from: Date; to: Date } {
  const local = localNow();
  const day = local.getUTCDay();
  const monday = new Date(local);
  monday.setUTCDate(local.getUTCDate() + (day === 0 ? -6 : 1 - day));
  monday.setUTCHours(0, 0, 0, 0);
  return {
    from: new Date(monday.getTime() - TZ_OFFSET_MS),
    to: new Date(Date.now()),
  };
}

function localMonthBounds(): { from: Date; to: Date } {
  const local = localNow();
  const first = new Date(local);
  first.setUTCDate(1);
  first.setUTCHours(0, 0, 0, 0);
  return {
    from: new Date(first.getTime() - TZ_OFFSET_MS),
    to: new Date(Date.now()),
  };
}

// ── Inline keyboards ──────────────────────────────────────────────────────────

function miniappButton(locale?: Locale) {
  const label = t('bot.miniapp.button', locale ?? 'uk');
  return new InlineKeyboard().webApp(label, env.MINIAPP_URL ?? "https://project-mb7a5.vercel.app/miniapp");
}

// ── Profile language update ───────────────────────────────────────────────────

async function updateProfileLanguage(profileId: string, locale: Locale): Promise<void> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", profileId)
    .single();

  const currentSettings = (profile?.settings as Record<string, unknown>) ?? {};
  const newSettings = { ...currentSettings, language: locale };

  await supabase
    .from("profiles")
    .update({ settings: newSettings })
    .eq("id", profileId);
}

// ── Language selector ─────────────────────────────────────────────────────────

/**
 * Builds an InlineKeyboard with 11 language buttons in a 2-column layout.
 * Each button is labelled "{flag} {nativeName}" with callback data "lang:<locale>".
 */
export function buildLanguageSelectorKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  let col = 0;
  for (const locale of SUPPORTED_LOCALES) {
    const { nativeName, flag } = LOCALE_META[locale];
    kb.text(`${flag} ${nativeName}`, `lang:${locale}`);
    col++;
    if (col % 2 === 0) kb.row();
  }
  return kb;
}

export async function handleLanguage(ctx: BotContext): Promise<void> {
  const keyboard = buildLanguageSelectorKeyboard();
  await ctx.reply(t("bot.language.prompt", ctx.locale), {
    reply_markup: keyboard,
  });
}

// ── Help ──────────────────────────────────────────────────────────────────────

// ── /start ────────────────────────────────────────────────────────────────────

async function sendWelcome(ctx: BotContext): Promise<void> {
  await ctx.reply(t("bot.welcome", ctx.locale), {
    parse_mode: "MarkdownV2",
    reply_markup: miniappButton(ctx.locale),
  });
}

export async function handleStart(ctx: BotContext): Promise<void> {
  const isFirstRun = !ctx.profile?.settings?.language;
  if (isFirstRun) {
    const keyboard = buildLanguageSelectorKeyboard();
    await ctx.reply(t("bot.language.prompt", "en"), {
      reply_markup: keyboard,
    });
    return;
  }
  await sendWelcome(ctx);
}

// ── /help ─────────────────────────────────────────────────────────────────────

export async function handleHelp(ctx: BotContext): Promise<void> {
  await ctx.reply(t('bot.help', ctx.locale), {
    parse_mode: "MarkdownV2",
    reply_markup: miniappButton(ctx.locale),
  });
}

// ── /stats — today's summary ──────────────────────────────────────────────────

export async function handleStats(ctx: BotContext): Promise<void> {
  const profile = ctx.profile;
  if (!profile) return;

  const { from, to } = localDayBounds();

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: entries } = await supabase
    .from("entries")
    .select("content, category, metadata, created_at")
    .eq("user_id", profile.id)
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .order("created_at", { ascending: true });

  if (!entries || entries.length === 0) {
    await ctx.reply(
      t('bot.stats.empty', ctx.locale),
      { reply_markup: miniappButton(ctx.locale) }
    );
    return;
  }

  // Aggregate dashboard_metrics
  const metricMap = new Map<string, { metric: DashboardMetric; values: number[] }>();
  for (const entry of entries) {
    const metrics = (entry.metadata as Record<string, unknown>)?.dashboard_metrics as DashboardMetric[] | undefined;
    if (!Array.isArray(metrics)) continue;
    for (const m of metrics) {
      if (!metricMap.has(m.key)) metricMap.set(m.key, { metric: m, values: [] });
      metricMap.get(m.key)!.values.push(m.value);
      metricMap.get(m.key)!.metric = m;
    }
  }

  const aggregated: Array<{ label: string; value: number; unit: string; icon: string }> = [];
  for (const [, { metric, values }] of metricMap) {
    let value: number;
    if (metric.aggregate === "sum") value = values.reduce((a, b) => a + b, 0);
    else if (metric.aggregate === "avg") value = values.reduce((a, b) => a + b, 0) / values.length;
    else value = values[values.length - 1];
    aggregated.push({ label: metric.label, value: Math.round(value * 10) / 10, unit: metric.unit, icon: metric.icon ?? "" });
  }

  // Count by category
  const catCount = new Map<string, number>();
  for (const e of entries) {
    catCount.set(e.category, (catCount.get(e.category) ?? 0) + 1);
  }

  const localeCode = ctx.locale === 'uk' ? 'uk-UA' : ctx.locale === 'zh' ? 'zh-CN' : ctx.locale === 'ar' ? 'ar-SA' : ctx.locale;
  const today = localNow().toLocaleDateString(localeCode, { weekday: "long", day: "numeric", month: "long" });
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  let lines = `📊 *${cap(today)}*\n\n`;
  lines += `${t('bot.stats.entries_today', ctx.locale)}: *${entries.length}*\n`;

  if (aggregated.length > 0) {
    lines += "\n";
    for (const m of aggregated) {
      lines += `${m.label}: *${m.value} ${m.unit}*\n`;
    }
  }

  // Energy balance
  const intake = aggregated.find(m => m.label.toLowerCase().includes("калор") || m.label.toLowerCase().includes("calor"))
    ?? ((): { label: string; value: number; unit: string; icon: string } | undefined => {
      const values = entries
        .map((entry) => getMetricValueByKey(entry.metadata as Record<string, unknown>, "kcal_intake"))
        .filter((value): value is number => value !== null);
      if (values.length === 0) return undefined;
      return { label: "Calories", value: Math.round(values.reduce((a, b) => a + b, 0) * 10) / 10, unit: "kcal", icon: "" };
    })();
  const burned = ((): { label: string; value: number; unit: string; icon: string } | undefined => {
    const values = entries
      .map((entry) => getMetricValueByKey(entry.metadata as Record<string, unknown>, "kcal_burned"))
      .filter((value): value is number => value !== null);
    if (values.length === 0) return undefined;
    return { label: "Burned", value: Math.round(values.reduce((a, b) => a + b, 0) * 10) / 10, unit: "kcal", icon: "" };
  })();
  if (intake && burned) {
    const net = Math.round(intake.value - burned.value);
    const balanceLabel = t('bot.stats.balance', ctx.locale);
    const deficitLabel = t('bot.stats.deficit', ctx.locale);
    const surplusLabel = t('bot.stats.surplus', ctx.locale);
    lines += `\n${balanceLabel}: *${net > 0 ? "+" : ""}${net} ${intake.unit}* (${net < 0 ? `${deficitLabel} 🔥` : surplusLabel})\n`;
  }

  if (catCount.size > 0) {
    const catList = [...catCount.entries()].map(([c, n]) => `${c} (${n})`).join(", ");
    lines += `\n${t('bot.stats.categories', ctx.locale)}: ${catList}`;
  }

  await ctx.reply(lines, {
    parse_mode: "Markdown",
    reply_markup: new InlineKeyboard()
      .webApp(t('bot.miniapp.dashboard_button', ctx.locale), env.MINIAPP_URL ?? "https://project-mb7a5.vercel.app/miniapp")
      .row()
      .text(t('bot.stats.weekly_retro', ctx.locale), "report:weekly"),
  });
}

// ── /report (and /report_daily, /report_weekly, /report_monthly) ──────────────

async function runReport(ctx: BotContext, periodType: "daily" | "weekly" | "monthly"): Promise<void> {
  const profile = ctx.profile;
  if (!profile) return;

  const REPORT_STATUS = [
    t('bot.report.status.0', ctx.locale),
    t('bot.report.status.1', ctx.locale),
    t('bot.report.status.2', ctx.locale),
    t('bot.report.status.3', ctx.locale),
    t('bot.report.status.4', ctx.locale),
    t('bot.report.status.5', ctx.locale),
  ];

  const periodLabels = {
    daily: t('bot.report.period.daily', ctx.locale),
    weekly: t('bot.report.period.weekly', ctx.locale),
    monthly: t('bot.report.period.monthly', ctx.locale),
  };
  const thinkingMsg = await ctx.reply(`${REPORT_STATUS[0]}\n\n${t('bot.report.analyzing', ctx.locale, { period: periodLabels[periodType] })}`);

  let statusIdx = 1;
  const rotateInterval = setInterval(async () => {
    if (statusIdx >= REPORT_STATUS.length) return;
    try {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        thinkingMsg.message_id,
        `${REPORT_STATUS[statusIdx++]}\n\n${t('bot.report.analyzing', ctx.locale, { period: periodLabels[periodType] })}`
      );
    } catch { /* ignore */ }
  }, 2800);

  let bounds: { from: Date; to: Date };
  if (periodType === "daily") bounds = localDayBounds();
  else if (periodType === "monthly") bounds = localMonthBounds();
  else bounds = localWeekBounds();

  const report = await generateRetrospective(profile.id, periodType, bounds.from, bounds.to, ctx.locale);
  clearInterval(rotateInterval);

  if (!report) {
    await ctx.api.editMessageText(
      ctx.chat!.id,
      thinkingMsg.message_id,
      t('bot.report.empty', ctx.locale)
    );
    return;
  }

  await saveReport(profile.id, report);
  const formatted = sanitizeMarkdown(formatReportForTelegram(report));

  const keyboard = new InlineKeyboard()
    .webApp(t('bot.miniapp.app_button', ctx.locale), env.MINIAPP_URL ?? "https://project-mb7a5.vercel.app/miniapp");

  if (formatted.length <= 4000) {
    await ctx.api.editMessageText(ctx.chat!.id, thinkingMsg.message_id, formatted, {
      reply_markup: keyboard,
    });
  } else {
    await ctx.api.deleteMessage(ctx.chat!.id, thinkingMsg.message_id).catch(() => {});
    const chunks = formatted.match(/[\s\S]{1,3900}/g) ?? [formatted];
    for (let i = 0; i < chunks.length; i++) {
      await ctx.reply(chunks[i], i === chunks.length - 1 ? { reply_markup: keyboard } : undefined);
    }
  }
}

export async function handleReport(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text ?? "";
  const arg = text.split(/[\s_]/)[1]?.trim().toLowerCase();
  const periodType = (["daily", "weekly", "monthly"].includes(arg ?? "") ? arg : "weekly") as "daily" | "weekly" | "monthly";
  await runReport(ctx, periodType);
}

export async function handleReportDaily(ctx: BotContext): Promise<void> {
  await runReport(ctx, "daily");
}

export async function handleReportWeekly(ctx: BotContext): Promise<void> {
  await runReport(ctx, "weekly");
}

export async function handleReportMonthly(ctx: BotContext): Promise<void> {
  await runReport(ctx, "monthly");
}

// ── Callback query handler for inline buttons ─────────────────────────────────

export async function handleCallbackQuery(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  // Handle language selection callbacks before answering the query
  if (data.startsWith("lang:")) {
    const locale = data.slice(5) as Locale;
    if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
      await ctx.answerCallbackQuery();
      return;
    }
    if (ctx.profile?.id) {
      await updateProfileLanguage(ctx.profile.id, locale);
    }
    ctx.locale = locale;
    await ctx.answerCallbackQuery();
    const { nativeName } = LOCALE_META[locale];
    await ctx.reply(t("bot.language.changed", locale, { language: nativeName }));
    // Send the full welcome message after language is set
    await ctx.reply(t("bot.welcome", locale), {
      parse_mode: "MarkdownV2",
      reply_markup: new InlineKeyboard().webApp(t('bot.miniapp.button', locale), env.MINIAPP_URL ?? "https://project-mb7a5.vercel.app/miniapp"),
    });
    return;
  }

  await ctx.answerCallbackQuery();

  if (data === "report:daily") return runReport(ctx, "daily");
  if (data === "report:weekly") return runReport(ctx, "weekly");
  if (data === "report:monthly") return runReport(ctx, "monthly");
}

// ── /remind — schedule a reminder ────────────────────────────────────────────

export async function handleRemind(ctx: BotContext): Promise<void> {
  const profile = ctx.profile;
  if (!profile) return;

  const text = ctx.message?.text ?? "";
  // Parse: /remind <text> at <HH:MM>
  const match = text.match(/^\/remind (.+) at (\d{1,2}:\d{2})$/i);
  if (!match) {
    await ctx.reply(t('bot.remind.format', ctx.locale));
    return;
  }

  const [, reminderText, timeStr] = match;
  const [hoursStr, minutesStr] = timeStr.split(":");
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    await ctx.reply(t('bot.remind.invalid_time', ctx.locale));
    return;
  }

  // Build scheduled_at: today's date with the given HH:MM in UTC
  const now = new Date();
  const scheduledAt = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, minutes, 0, 0)
  );

  // If the time has already passed today, schedule for tomorrow
  if (scheduledAt.getTime() <= Date.now()) {
    scheduledAt.setUTCDate(scheduledAt.getUTCDate() + 1);
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { error } = await supabase.from("reminders").insert({
    user_id: profile.id,
    text: reminderText.trim(),
    scheduled_at: scheduledAt.toISOString(),
    status: "pending",
    // Also populate legacy columns for backward compatibility
    remind_at: scheduledAt.toISOString(),
    done: false,
  });

  if (error) {
    console.error("[handleRemind] insert error:", error.message);
    await ctx.reply(t('bot.remind.error', ctx.locale));
    return;
  }

  const timeLabel = scheduledAt.toISOString().slice(11, 16); // HH:MM UTC
  await ctx.reply(
    t('bot.remind.set', ctx.locale, { text: reminderText.trim(), time: timeLabel }),
    { parse_mode: "Markdown" }
  );
}

// ── /invite — referral link ───────────────────────────────────────────────────

export async function handleInvite(ctx: BotContext): Promise<void> {
  const profile = ctx.profile;
  if (!profile) return;

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Fetch any existing referral code for this user (regardless of referred_id status)
  const { data: existing } = await supabase
    .from("referrals")
    .select("code")
    .eq("referrer_id", profile.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let code: string;

  if (existing?.code) {
    code = existing.code;
  } else {
    // Generate a new unique referral code (12 hex chars)
    code = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { error } = await supabase.from("referrals").insert({
      referrer_id: profile.id,
      code,
    });

    if (error) {
      console.error("[handleInvite] insert error:", error.message);
      await ctx.reply(t('bot.invite.error', ctx.locale));
      return;
    }
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "memo_r0bot";
  const deepLink = `https://t.me/${botUsername}?start=ref_${code}`;

  // Use plain text (no parse_mode) to avoid MarkdownV2 escaping issues with URLs
  await ctx.reply(t('bot.invite.message', ctx.locale, { link: deepLink }));
}

// ── /cancel — abort current bot context / hard reboot ────────────────────────

export async function handleCancel(ctx: BotContext): Promise<void> {
  // Clears any pending bot state for the user and sends a fresh start prompt.
  // Useful when the bot gets stuck mid-conversation or the user wants to reset.
  await ctx.reply(
    t('bot.cancel.reply', ctx.locale),
    {
      reply_markup: miniappButton(ctx.locale),
    }
  );
}

// ── /recommendations — intelligent insights ───────────────────────────────────

export async function handleRecommendations(ctx: BotContext): Promise<void> {
  const profile = ctx.profile;
  if (!profile) return;

  const thinkingMsg = await ctx.reply(t('bot.recommendations.thinking', ctx.locale));

  const recommendationsText = await getRecommendationsForUser(profile.id, ctx.locale);

  await ctx.api.editMessageText(ctx.chat!.id, thinkingMsg.message_id, recommendationsText, {
    parse_mode: "Markdown",
    reply_markup: miniappButton(),
  });
}
