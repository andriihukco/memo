import { Context } from "grammy";
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
  // Convert back to UTC
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

// ── Welcome ───────────────────────────────────────────────────────────────────

const WELCOME = `Привіт! Я Memo — твій особистий AI-щоденник.

Просто пиши або надсилай голосові — я сам розберусь що зберегти і як.

Що я вмію:
Записую їжу і рахую калорії, БЖВ автоматично
Трекаю тренування і активність
Веду облік витрат
Слухаю думки і почуття
Будую дашборд — відкрий міні-додаток
Відповідаю на питання про твої записи
Пам'ятаю твої правила і вподобання назавжди

Приклади:
"З'їв 200г курки і 50г рису" — рахую макроси
"Пробіг 5км" — трекаю активність
"Скільки я витратив цього тижня?" — аналізую
"Мій стакан = 300мл" — запам'ятаю назавжди
"Називай мене Андрій" — запам'ятаю

Напиши /help щоб побачити всі команди.`;

// ── Help ──────────────────────────────────────────────────────────────────────

const HELP = `Довідка Memo

ЗАПИСИ (просто пиши або говори):
Їжа: "З'їв 150г лосося і салат"
Тренування: "Зробив 40 присідань, 30 хв залу"
Витрати: "Витратив 350 грн на продукти"
Вода: "Випив 2 склянки води"
Сон: "Спав 7 годин, прокинувся бадьорим"
Вага: "Вага 78кг"
Стріки: "Не курю вже 10 днів"
Думки/почуття: просто пиши що думаєш

ПИТАННЯ (я шукаю в твоїх записах):
"Скільки калорій я з'їв сьогодні?"
"Що я їв вчора?"
"Скільки витратив цього місяця?"
"Розкажи про мої тренування цього тижня"
"Який у мене настрій останнім часом?"
"Що я казав про роботу минулого місяця?"

ДІЇ:
"Видали записи про сон за сьогодні"
"Виправ останній запис — я пробіг 7км, не 5км"
"Вмикай тижневий звіт щонеділі о 10:00"

ПРАВИЛА (я запам'ятаю назавжди):
"Мій стакан = 300мл"
"Коли кажу зарядка — це 20 хв і 150 ккал"
"Я веган"
"Називай мене Андрій"

КОМАНДИ:
/start — привітання
/help — ця довідка
/stats — зведення за сьогодні
/report — ретроспектива за тиждень
/recommendations — розумні рекомендації на основі твоїх записів
/report daily — за сьогодні
/report monthly — за місяць

Голосові: просто надішли — я транскрибую і збережу`;

// ── /start ────────────────────────────────────────────────────────────────────

export async function handleStart(ctx: BotContext): Promise<void> {
  await ctx.reply(WELCOME);
}

// ── /help ─────────────────────────────────────────────────────────────────────

export async function handleHelp(ctx: BotContext): Promise<void> {
  await ctx.reply(HELP);
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
    await ctx.reply("За сьогодні записів ще немає. Напиши що-небудь — і я почну трекати!");
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

  let lines = `Зведення за сьогодні (${today})\n\n`;
  lines += `Всього записів: ${entries.length}\n`;

  if (aggregated.length > 0) {
    lines += "\nМетрики:\n";
    for (const m of aggregated) {
      lines += `${m.label}: ${m.value} ${m.unit}\n`;
    }
  }

  // Energy balance
  const intake = aggregated.find(m => m.label.toLowerCase().includes("калорії") || m.unit === "ккал" && m.label.toLowerCase().includes("їж"));
  const burned = aggregated.find(m => m.label.toLowerCase().includes("спален"));
  if (intake && burned) {
    const net = intake.value - burned.value;
    lines += `\nЕнергетичний баланс: ${net > 0 ? "+" : ""}${net} ккал (${net < 0 ? "дефіцит" : "профіцит"})\n`;
  }

  lines += `\nКатегорії: ${[...catCount.entries()].map(([c, n]) => `${c} (${n})`).join(", ")}`;

  await ctx.reply(lines);
}

// ── /report ───────────────────────────────────────────────────────────────────

const REPORT_STATUS = [
  "Збираю твої записи...",
  "Аналізую патерни...",
  "Оцінюю прогрес...",
  "Шукаю інсайти...",
  "Формую ретроспективу...",
  "Майже готово...",
];

export async function handleReport(ctx: BotContext): Promise<void> {
  const profile = ctx.profile;
  if (!profile) return;

  const text = ctx.message?.text ?? "";
  const arg = text.split(" ")[1]?.trim().toLowerCase();
  const periodType = (["daily", "weekly", "monthly"].includes(arg ?? "") ? arg : "weekly") as "daily" | "weekly" | "monthly";

  const thinkingMsg = await ctx.reply(REPORT_STATUS[0]);

  let statusIdx = 1;
  const rotateInterval = setInterval(async () => {
    if (statusIdx >= REPORT_STATUS.length) return;
    try {
      await ctx.api.editMessageText(ctx.chat!.id, thinkingMsg.message_id, REPORT_STATUS[statusIdx++]);
    } catch { /* ignore */ }
  }, 3000);

  // Use UTC+3 aware bounds
  let bounds: { from: Date; to: Date };
  if (periodType === "daily") bounds = localDayBounds();
  else if (periodType === "monthly") bounds = localMonthBounds();
  else bounds = localWeekBounds();

  const report = await generateRetrospective(profile.id, periodType, bounds.from, bounds.to);
  clearInterval(rotateInterval);

  if (!report) {
    await ctx.api.editMessageText(ctx.chat!.id, thinkingMsg.message_id,
      "Недостатньо записів за цей період. Продовжуй вести щоденник!");
    return;
  }

  await saveReport(profile.id, report);
  const formatted = sanitizeMarkdown(formatReportForTelegram(report));

  if (formatted.length <= 4000) {
    await ctx.api.editMessageText(ctx.chat!.id, thinkingMsg.message_id, formatted);
  } else {
    await ctx.api.deleteMessage(ctx.chat!.id, thinkingMsg.message_id).catch(() => {});
    const chunks = formatted.match(/[\s\S]{1,3900}/g) ?? [formatted];
    for (const chunk of chunks) await ctx.reply(chunk);
  }
}

// ── /recommendations — intelligent insights ───────────────────────────────────

export async function handleRecommendations(ctx: BotContext): Promise<void> {
  const profile = ctx.profile;
  if (!profile) return;

  const thinkingMsg = await ctx.reply("Аналізую твої записи...");

  const recommendationsText = await getRecommendationsForUser(profile.id);

  await ctx.api.editMessageText(ctx.chat!.id, thinkingMsg.message_id, recommendationsText, {
    parse_mode: "Markdown",
  });
}
