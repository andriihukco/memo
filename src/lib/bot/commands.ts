import { Context, InlineKeyboard } from "grammy";
import type { Profile } from "@/lib/profile";
import { generateRetrospective, saveReport, formatReportForTelegram } from "@/lib/bot/retrospective";
import { getRecommendationsForUser } from "@/lib/bot/recommendations";
import { sanitizeMarkdown } from "@/lib/utils";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { DashboardMetric } from "@/lib/classifier";

interface BotContext extends Context {
  profile?: Profile;
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

function miniappButton() {
  return new InlineKeyboard().webApp("📱 Відкрити Memo", env.MINIAPP_URL ?? "https://project-mb7a5.vercel.app/miniapp");
}

// ── Welcome ───────────────────────────────────────────────────────────────────

const WELCOME = `Привіт\\! Я *Memo* — твій особистий щоденник з AI 📓

Просто пиши або надсилай голосові — я сам розберусь що зберегти і як\\.

*Що вмію:*
🍽 Рахую калорії та БЖВ автоматично
🏃 Трекаю тренування і активність
💸 Веду облік витрат
💭 Слухаю думки і почуття
📊 Будую дашборд з твоїми метриками
🔍 Відповідаю на питання про твої записи
🧠 Запам'ятовую твої правила назавжди

*Спробуй написати:*
_"З'їв 200г курки і 50г рису"_
_"Пробіг 5км за 28 хвилин"_
_"Витратив 350 грн на продукти"_
_"Мій стакан \\= 300мл"_ — запам'ятаю назавжди

Всі записи синхронізуються з міні\\-додатком — там дашборд, графіки і ретроспективи\\.`;

// ── Help ──────────────────────────────────────────────────────────────────────

const HELP = `📖 *Довідка Memo*

*Просто пиши або говори — я сам розберусь:*

🍽 *Їжа*
_"З'їв 150г лосося і салат"_
_"Снідав вівсянкою з бананом"_

💪 *Тренування*
_"Зробив 40 присідань, 30 хв залу"_
_"Пробіг 5км за 28 хвилин"_

💸 *Витрати*
_"Витратив 350 грн на продукти"_
_"Кава 65 грн"_

💧 *Вода, сон, вага*
_"Випив 2 склянки води"_
_"Спав 7 годин, прокинувся бадьорим"_
_"Вага 78кг"_

💭 *Думки і почуття*
Просто пиши що думаєш — я збережу і не забуду

*Питання про свої дані:*
_"Скільки калорій я з'їв сьогодні?"_
_"Що я їв вчора?"_
_"Скільки витратив цього місяця?"_
_"Розкажи про мої тренування цього тижня"_

*Редагування і видалення:*
_"Видали записи про сон за сьогодні"_
_"Виправ останній запис — я пробіг 7км, не 5км"_

*Правила \\(запам'ятаю назавжди\\):*
_"Мій стакан \\= 300мл"_
_"Коли кажу зарядка — це 20 хв і 150 ккал"_
_"Я веган"_

*Команди:*
/stats — зведення за сьогодні
/report\\_daily — ретроспектива за сьогодні
/report\\_weekly — за тиждень
/report\\_monthly — за місяць
/recommendations — розумні поради

🎤 *Голосові:* просто надішли — я транскрибую і збережу`;

// ── /start ────────────────────────────────────────────────────────────────────

export async function handleStart(ctx: BotContext): Promise<void> {
  await ctx.reply(WELCOME, {
    parse_mode: "MarkdownV2",
    reply_markup: miniappButton(),
  });
}

// ── /help ─────────────────────────────────────────────────────────────────────

export async function handleHelp(ctx: BotContext): Promise<void> {
  await ctx.reply(HELP, {
    parse_mode: "MarkdownV2",
    reply_markup: miniappButton(),
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
      "За сьогодні ще нічого немає 🙂\n\nНапиши що-небудь — і я почну трекати!",
      { reply_markup: miniappButton() }
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

  const today = localNow().toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  let lines = `📊 *${cap(today)}*\n\n`;
  lines += `Записів за день: *${entries.length}*\n`;

  if (aggregated.length > 0) {
    lines += "\n";
    for (const m of aggregated) {
      lines += `${m.label}: *${m.value} ${m.unit}*\n`;
    }
  }

  // Energy balance
  const intake = aggregated.find(m => m.unit === "ккал" && !m.label.toLowerCase().includes("спален"));
  const burned = aggregated.find(m => m.label.toLowerCase().includes("спален"));
  if (intake && burned) {
    const net = Math.round(intake.value - burned.value);
    lines += `\nБаланс: *${net > 0 ? "+" : ""}${net} ккал* (${net < 0 ? "дефіцит 🔥" : "профіцит"})\n`;
  }

  if (catCount.size > 0) {
    const catList = [...catCount.entries()].map(([c, n]) => `${c} (${n})`).join(", ");
    lines += `\nКатегорії: ${catList}`;
  }

  await ctx.reply(lines, {
    parse_mode: "Markdown",
    reply_markup: new InlineKeyboard()
      .webApp("📱 Відкрити дашборд", env.MINIAPP_URL ?? "https://project-mb7a5.vercel.app/miniapp")
      .row()
      .text("📋 Ретроспектива тижня", "report:weekly"),
  });
}

// ── /report (and /report_daily, /report_weekly, /report_monthly) ──────────────

const REPORT_STATUS = [
  "Збираю твої записи... 📂",
  "Аналізую патерни... 🔍",
  "Оцінюю прогрес... 📈",
  "Шукаю інсайти... 💡",
  "Формую ретроспективу... ✍️",
  "Майже готово... ⏳",
];

async function runReport(ctx: BotContext, periodType: "daily" | "weekly" | "monthly"): Promise<void> {
  const profile = ctx.profile;
  if (!profile) return;

  const periodLabels = { daily: "сьогодні", weekly: "тиждень", monthly: "місяць" };
  const thinkingMsg = await ctx.reply(`${REPORT_STATUS[0]}\n\nАналізую ${periodLabels[periodType]}...`);

  let statusIdx = 1;
  const rotateInterval = setInterval(async () => {
    if (statusIdx >= REPORT_STATUS.length) return;
    try {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        thinkingMsg.message_id,
        `${REPORT_STATUS[statusIdx++]}\n\nАналізую ${periodLabels[periodType]}...`
      );
    } catch { /* ignore */ }
  }, 2800);

  let bounds: { from: Date; to: Date };
  if (periodType === "daily") bounds = localDayBounds();
  else if (periodType === "monthly") bounds = localMonthBounds();
  else bounds = localWeekBounds();

  const report = await generateRetrospective(profile.id, periodType, bounds.from, bounds.to);
  clearInterval(rotateInterval);

  if (!report) {
    await ctx.api.editMessageText(
      ctx.chat!.id,
      thinkingMsg.message_id,
      "Записів за цей період замало для ретроспективи 🙂\n\nПродовжуй вести щоденник — і я зроблю повний аналіз!"
    );
    return;
  }

  await saveReport(profile.id, report);
  const formatted = sanitizeMarkdown(formatReportForTelegram(report));

  const keyboard = new InlineKeyboard()
    .webApp("📱 Відкрити в додатку", env.MINIAPP_URL ?? "https://project-mb7a5.vercel.app/miniapp");

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

  await ctx.answerCallbackQuery();

  if (data === "report:daily") return runReport(ctx, "daily");
  if (data === "report:weekly") return runReport(ctx, "weekly");
  if (data === "report:monthly") return runReport(ctx, "monthly");
}

// ── /recommendations — intelligent insights ───────────────────────────────────

export async function handleRecommendations(ctx: BotContext): Promise<void> {
  const profile = ctx.profile;
  if (!profile) return;

  const thinkingMsg = await ctx.reply("Аналізую твої записи та звички... 🧠");

  const recommendationsText = await getRecommendationsForUser(profile.id);

  await ctx.api.editMessageText(ctx.chat!.id, thinkingMsg.message_id, recommendationsText, {
    parse_mode: "Markdown",
    reply_markup: miniappButton(),
  });
}
