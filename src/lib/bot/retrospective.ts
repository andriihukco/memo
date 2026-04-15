import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

const MODEL = "gemini-2.5-flash";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReportInsight {
  type: "strength" | "pattern" | "concern" | "action" | "celebration";
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
  return data ?? [];
}

// ── Generate retrospective ────────────────────────────────────────────────────

const RETRO_SYSTEM_PROMPT = `Ти — психолог і коуч з аналізу поведінки та особистісного розвитку.
Твоє завдання — проаналізувати записи щоденника користувача за певний період і скласти глибокий, корисний звіт.

Аналізуй:
1. ПАТЕРНИ ПОВЕДІНКИ — що повторюється? Які звички формуються або руйнуються?
2. ЕМОЦІЙНИЙ СТАН — як змінювався настрій? Що впливало на нього?
3. ФІЗИЧНЕ ЗДОРОВ'Я — активність, харчування, сон, стреси
4. ПРОГРЕС ДО ЦІЛЕЙ — що досягнуто? Що застрягло?
5. СИЛЬНІ СТОРОНИ — що людина робить добре, що варто продовжувати
6. ЗОНИ РОСТУ — що можна покращити, без осуду
7. КОНКРЕТНІ ДІЇ — 2-3 практичні кроки на наступний період

Тон: теплий, підтримуючий, як розумний друг-психолог. Не повчай. Не осуджуй.
Відповідай мовою записів користувача.
Використовуй Telegram Markdown: *жирний*, _курсив_, емодзі для структури.

Формат відповіді — JSON:
{
  "content": "<повний звіт у Telegram Markdown>",
  "summary": "<1-2 речення TLDR>",
  "insights": [
    {"type": "celebration|strength|pattern|concern|action", "text": "<інсайт>", "emoji": "<емодзі>"}
  ]
}

Типи інсайтів:
- celebration — досягнення, перемоги, прогрес
- strength — сильні сторони, що варто продовжувати
- pattern — помічені патерни (нейтрально)
- concern — зони уваги (без осуду, з турботою)
- action — конкретна дія на наступний тиждень`;

export async function generateRetrospective(
  userId: string,
  periodType: "daily" | "weekly" | "monthly" | "custom",
  from: Date,
  to: Date
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
      systemInstruction: RETRO_SYSTEM_PROMPT,
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

export async function loadReports(userId: string, limit = 10) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("reports")
    .select("id, period_type, period_from, period_to, summary, insights, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

// ── Delete report ─────────────────────────────────────────────────────────────

export async function deleteReport(userId: string, reportId: string): Promise<void> {
  const supabase = getServiceClient();
  await supabase.from("reports").delete().eq("id", reportId).eq("user_id", userId);
}

// ── Report schedule helpers ───────────────────────────────────────────────────

export interface ReportSchedule {
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
  time: string; // "HH:MM"
}

export async function getReportSchedule(userId: string): Promise<ReportSchedule> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", userId)
    .single();
  return (data?.settings?.report_schedule as ReportSchedule) ?? {
    daily: false, weekly: true, monthly: true, time: "09:00",
  };
}

export async function setReportSchedule(userId: string, schedule: ReportSchedule): Promise<void> {
  const supabase = getServiceClient();
  const { data } = await supabase.from("profiles").select("settings").eq("id", userId).single();
  await supabase.from("profiles").update({
    settings: { ...(data?.settings ?? {}), report_schedule: schedule },
  }).eq("id", userId);
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
