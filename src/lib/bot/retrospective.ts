import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { deriveUserKey, decryptField } from "@/lib/crypto";
import type { Locale } from "@/i18n/locales";
import { aiLanguageInstruction } from "@/i18n/ai-locale";

const MODEL = "gemini-2.5-flash";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReportInsight {
  type: "went_well" | "didnt_go_well" | "start_stop_continue" | "experiment" | "lesson";
  text: string;
  emoji: string;
}

export interface Report {
  id?: string;
  period_type: "daily" | "weekly" | "monthly" | "custom";
  period_from: string;
  period_to: string;
  content: string;
  summary: string;
  went_well?: string;
  didnt_go_well?: string;
  start_stop_continue?: string;
  experiment?: string;
  lesson?: string;
  insights: ReportInsight[];
}

// ── Supabase ──────────────────────────────────────────────────────────────────

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ── Load entries for period ───────────────────────────────────────────────────

async function loadEntriesForPeriod(userId: string, from: Date, to: Date) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("entries")
    .select("content, category, metadata, created_at, bot_reply")
    .eq("user_id", userId)
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .order("created_at", { ascending: true });

  const raw = data ?? [];

  // Decrypt content
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_id, encryption_salt")
      .eq("id", userId)
      .single();
    if (profile?.telegram_id) {
      const key = await deriveUserKey(
        String(profile.telegram_id),
        profile.encryption_salt ?? null
      );
      return Promise.all(
        raw.map(async (e) => ({
          ...e,
          content: await decryptField(e.content, key),
          bot_reply: e.bot_reply ? await decryptField(e.bot_reply, key) : e.bot_reply,
        }))
      );
    }
  } catch {
    // fallback: return as-is
  }
  return raw;
}

// ── Generate retrospective ────────────────────────────────────────────────────

const RETRO_SYSTEM_PROMPT = `Ти — психолог і коуч з аналізу поведінки та особистісного розвитку.
Твоє завдання — проаналізувати записи щоденника користувача за певний період і скласти глибоку ретроспективу у форматі agile-ретро.

Структура звіту — ОБОВ'ЯЗКОВО п'ять розділів:

1. ✅ ЩО ПРОЙШЛО ДОБРЕ? — успіхи, перемоги, прогрес, звички що тримаються. Що варто повторювати?
2. ❌ ЩО НЕ СПРАЦЮВАЛО? — де були затики, зриви, стрес, втрата енергії. Без осуду — просто факти.
3. 🔄 СТАРТ / СТОП / ПРОДОВЖИТИ — конкретні дії: що почати робити, що зупинити, що продовжувати.
4. 🧪 ОДИН ЕКСПЕРИМЕНТ — одна невелика зміна або гіпотеза для наступного спринту. Конкретна і вимірювана.
5. 💡 ГОЛОВНИЙ УРОК — найважливіший інсайт або висновок цього періоду. Одне речення.

Тон: теплий, підтримуючий, як розумний друг-психолог. Не повчай. Не осуджуй.
Відповідай мовою записів користувача.
Використовуй Telegram Markdown: *жирний*, _курсив_, емодзі для структури.

Формат відповіді — JSON:
{
  "content": "<повний звіт у Telegram Markdown з усіма 5 розділами>",
  "summary": "<1-2 речення TLDR>",
  "went_well": "<текст розділу 1>",
  "didnt_go_well": "<текст розділу 2>",
  "start_stop_continue": "<текст розділу 3>",
  "experiment": "<текст розділу 4>",
  "lesson": "<текст розділу 5>",
  "insights": [
    {"type": "went_well|didnt_go_well|start_stop_continue|experiment|lesson", "text": "<інсайт>", "emoji": "<емодзі>"}
  ]
}

Типи інсайтів (відповідають розділам):
- went_well — успіхи та перемоги
- didnt_go_well — затики та проблеми
- start_stop_continue — дії (старт/стоп/продовжити)
- experiment — гіпотеза для наступного спринту
- lesson — головний урок`;

export async function generateRetrospective(
  userId: string,
  periodType: "daily" | "weekly" | "monthly" | "custom",
  from: Date,
  to: Date,
  locale: Locale = 'uk'
): Promise<Report | null> {
  const entries = await loadEntriesForPeriod(userId, from, to);

  if (entries.length === 0) return null;

  const periodLabel = {
    daily: "день",
    weekly: "тиждень",
    monthly: "місяць",
    custom: "обраний період",
  }[periodType];

  const entriesText = entries.map((e: {
    created_at: string;
    category: string;
    content: string;
    metadata: Record<string, unknown>;
    bot_reply: string | null;
  }) => {
    const date = new Date(e.created_at).toLocaleDateString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const metrics = e.metadata?.dashboard_metrics as Array<{ label: string; value: number; unit: string }> | undefined;
    const metricsStr = Array.isArray(metrics) && metrics.length > 0
      ? ` [${metrics.map(m => `${m.label}: ${m.value}${m.unit}`).join(", ")}]`
      : "";
    return `[${date}] (${e.category}) ${e.content}${metricsStr}`;
  }).join("\n");

  const prompt = `Проаналізуй записи щоденника за ${periodLabel} (${from.toLocaleDateString("uk-UA")} — ${to.toLocaleDateString("uk-UA")}):

${entriesText}

Склади ретроспективний звіт. Відповідь — ТІЛЬКИ JSON.`;

  try {
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: aiLanguageInstruction(locale) + '\n' + RETRO_SYSTEM_PROMPT,
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim()
      .replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(text);

    return {
      period_type: periodType,
      period_from: from.toISOString(),
      period_to: to.toISOString(),
      content: parsed.content ?? "",
      summary: parsed.summary ?? "",
      went_well: parsed.went_well ?? "",
      didnt_go_well: parsed.didnt_go_well ?? "",
      start_stop_continue: parsed.start_stop_continue ?? "",
      experiment: parsed.experiment ?? "",
      lesson: parsed.lesson ?? "",
      insights: parsed.insights ?? [],
    };
  } catch (err) {
    console.error("[retrospective] generation failed:", err);
    return null;
  }
}

// ── Save report to DB ─────────────────────────────────────────────────────────

export async function saveReport(userId: string, report: Report): Promise<string | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reports")
    .insert({
      user_id: userId,
      period_type: report.period_type,
      period_from: report.period_from,
      period_to: report.period_to,
      content: report.content,
      summary: report.summary,
      insights: report.insights,
      went_well: report.went_well ?? null,
      didnt_go_well: report.didnt_go_well ?? null,
      start_stop_continue: report.start_stop_continue ?? null,
      experiment: report.experiment ?? null,
      lesson: report.lesson ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[retrospective] save failed:", error.message);
    return null;
  }
  return data?.id ?? null;
}

// ── Load reports ──────────────────────────────────────────────────────────────

export async function loadReports(userId: string, cutoff?: string, limit = 10) {
  const supabase = getServiceClient();
  let query = supabase
    .from("reports")
    .select("id, period_type, period_from, period_to, summary, went_well, didnt_go_well, start_stop_continue, experiment, lesson, insights, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cutoff) {
    query = query.gte("created_at", cutoff);
  }

  const { data } = await query;
  return data ?? [];
}

// ── Delete report ─────────────────────────────────────────────────────────────

export async function deleteReport(userId: string, reportId: string): Promise<void> {
  const supabase = getServiceClient();
  await supabase.from("reports").delete().eq("id", reportId).eq("user_id", userId);
}

// ── Generate weekly summary (lighter version for free users) ─────────────────

const WEEKLY_SUMMARY_SYSTEM_PROMPT = `Ти — дружній асистент для аналізу щоденника.
Твоє завдання — скласти короткий тижневий підсумок на основі записів користувача.

Підсумок має містити:
1. Кількість записів за тиждень
2. Топ-3 категорії (найчастіші)
3. Один яскравий момент (highlight) — найцікавіший або найважливіший запис
4. Один AI-інсайт — коротке спостереження або порада на основі патернів тижня

Вимоги:
- Максимум 300 слів
- Без структурованих розділів — просто теплий, живий текст
- Тон: дружній, підтримуючий, як повідомлення від друга
- Відповідай мовою записів користувача
- Використовуй Telegram Markdown: *жирний*, _курсив_, емодзі`;

export interface WeeklySummary {
  content: string;
  entry_count: number;
  top_categories: string[];
}

export async function generateWeeklySummary(
  userId: string,
  entries: Array<{ content: string; category: string; metadata: Record<string, unknown>; created_at: string }>,
  locale: Locale = "uk"
): Promise<WeeklySummary | null> {
  if (entries.length === 0) return null;

  // Compute top categories
  const categoryCounts = new Map<string, number>();
  for (const e of entries) {
    categoryCounts.set(e.category, (categoryCounts.get(e.category) ?? 0) + 1);
  }
  const topCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  const entriesText = entries.map((e) => {
    const date = new Date(e.created_at).toLocaleDateString("uk-UA", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const metrics = e.metadata?.dashboard_metrics as Array<{ label: string; value: number; unit: string }> | undefined;
    const metricsStr =
      Array.isArray(metrics) && metrics.length > 0
        ? ` [${metrics.map((m) => `${m.label}: ${m.value}${m.unit}`).join(", ")}]`
        : "";
    return `[${date}] (${e.category}) ${e.content}${metricsStr}`;
  }).join("\n");

  const prompt = `Записи за тиждень (${entries.length} записів, топ категорії: ${topCategories.join(", ")}):

${entriesText}

Склади короткий тижневий підсумок. Максимум 300 слів. Відповідь — тільки текст підсумку, без JSON.`;

  try {
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: aiLanguageInstruction(locale) + "\n" + WEEKLY_SUMMARY_SYSTEM_PROMPT,
    });

    const result = await model.generateContent(prompt);
    const content = result.response.text().trim();

    return {
      content,
      entry_count: entries.length,
      top_categories: topCategories,
    };
  } catch (err) {
    console.error("[retrospective] generateWeeklySummary failed:", err);
    return null;
  }
}

// ── Format report for Telegram ────────────────────────────────────────────────

export function formatReportForTelegram(report: Report): string {
  const periodLabel = {
    daily: "📅 Щоденний звіт",
    weekly: "📊 Тижневий звіт",
    monthly: "🗓 Місячний звіт",
    custom: "📋 Звіт",
  }[report.period_type];

  const from = new Date(report.period_from).toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
  const to = new Date(report.period_to).toLocaleDateString("uk-UA", { day: "numeric", month: "short" });

  return `${periodLabel} · ${from} — ${to}\n\n${report.content}`;
}
