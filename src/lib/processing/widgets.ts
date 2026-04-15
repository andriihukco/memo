import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// ── Types ─────────────────────────────────────────────────────────────────────

type WidgetType =
  | "calories_today"
  | "expenses_today"
  | "mood_trend"
  | "life_theme"
  | "daily_summary"
  | "weekly_summary"
  | "monthly_summary"
  | "insight_cluster";

interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  data: Record<string, unknown>;
  generated_at: string;
  min_entries?: number;
}

interface EntryRow {
  id: string;
  content: string;
  category: string;
  metadata: Record<string, unknown>;
  branch_id: string | null;
  created_at: string;
}

interface InsightRow {
  id: string;
  entry_id: string;
  insight_text: string;
  branch_id: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SUMMARY_MODEL = "gemini-2.5-flash";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function nowISO(): string {
  return new Date().toISOString();
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

async function generateText(prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: SUMMARY_MODEL });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// ── Widget builders ───────────────────────────────────────────────────────────

function buildCaloriesTodayWidget(entries: EntryRow[]): Widget {
  const today = startOfDay(new Date());
  const total = entries
    .filter(
      (e) =>
        e.category === "calories" && new Date(e.created_at) >= today
    )
    .reduce((sum, e) => {
      const kcal = Number(e.metadata?.estimated_calories ?? 0);
      return sum + (isFinite(kcal) ? kcal : 0);
    }, 0);

  return {
    id: "calories-today",
    type: "calories_today",
    title: "Calories Today",
    data: { total },
    generated_at: nowISO(),
  };
}

function buildExpensesTodayWidget(entries: EntryRow[]): Widget {
  const today = startOfDay(new Date());
  const totals: Record<string, number> = {};

  entries
    .filter(
      (e) =>
        e.category === "expenses" && new Date(e.created_at) >= today
    )
    .forEach((e) => {
      const amount = Number(e.metadata?.amount ?? 0);
      const currency = String(e.metadata?.currency ?? "USD");
      if (isFinite(amount)) {
        totals[currency] = (totals[currency] ?? 0) + amount;
      }
    });

  return {
    id: "expenses-today",
    type: "expenses_today",
    title: "Expenses Today",
    data: { totals },
    generated_at: nowISO(),
  };
}

async function buildMoodTrendWidget(
  entries: EntryRow[]
): Promise<Widget | null> {
  const feelings = entries.filter((e) => e.category === "feelings");
  if (feelings.length < 3) return null;

  const entriesText = feelings
    .map((e) => `[${e.created_at}] ${e.content}`)
    .join("\n");

  const prompt = `You are an empathetic mood analyst. Based on the following diary entries about feelings, determine the overall mood trend and write a brief 1-2 sentence summary.

Entries:
${entriesText}

Respond with ONLY a valid JSON object:
{"trend": "<improving|stable|declining>", "summary": "<1-2 sentence summary>"}`;

  let trend: "improving" | "stable" | "declining" = "stable";
  let summary = "";

  try {
    const raw = await generateText(prompt);
    const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
    trend = parsed.trend ?? "stable";
    summary = parsed.summary ?? "";
  } catch {
    summary = "Unable to determine mood trend at this time.";
  }

  return {
    id: "mood-trend",
    type: "mood_trend",
    title: "Mood Trend",
    data: { trend, summary },
    generated_at: nowISO(),
    min_entries: 3,
  };
}

async function buildLifeThemeWidgets(entries: EntryRow[]): Promise<Widget[]> {
  // Group entries by branch_id (only non-null)
  const clusters = new Map<string, EntryRow[]>();
  for (const e of entries) {
    if (!e.branch_id) continue;
    if (!clusters.has(e.branch_id)) clusters.set(e.branch_id, []);
    clusters.get(e.branch_id)!.push(e);
  }

  const widgets: Widget[] = [];

  for (const [branchId, members] of clusters) {
    if (members.length < 3) continue;

    const entriesText = members
      .map((e) => `[${e.created_at}] (${e.category}) ${e.content}`)
      .join("\n");

    const prompt = `You are a life coach. Based on the following diary entries that share a common theme, identify the life theme in 3-5 words.

Entries:
${entriesText}

Respond with ONLY the theme label (3-5 words, no punctuation).`;

    let theme = "Recurring Life Theme";
    try {
      theme = await generateText(prompt);
    } catch {
      // keep default
    }

    widgets.push({
      id: `life-theme-${branchId}`,
      type: "life_theme",
      title: theme,
      data: { branch_id: branchId, theme, entry_count: members.length },
      generated_at: nowISO(),
      min_entries: 3,
    });
  }

  return widgets;
}

async function buildSummaryWidget(
  type: "daily_summary" | "weekly_summary" | "monthly_summary",
  entries: EntryRow[]
): Promise<Widget> {
  const now = new Date();
  let since: Date;
  let period: "daily" | "weekly" | "monthly";
  let title: string;

  if (type === "daily_summary") {
    since = startOfDay(now);
    period = "daily";
    title = "Today's Summary";
  } else if (type === "weekly_summary") {
    since = startOfWeek(now);
    period = "weekly";
    title = "This Week's Summary";
  } else {
    since = startOfMonth(now);
    period = "monthly";
    title = "This Month's Summary";
  }

  const periodEntries = entries.filter(
    (e) => new Date(e.created_at) >= since
  );

  let narrative = "No entries recorded for this period.";

  if (periodEntries.length > 0) {
    const entriesText = periodEntries
      .map((e) => `[${e.created_at}] (${e.category}) ${e.content}`)
      .join("\n");

    const prompt = `You are a reflective journaling assistant. Write a warm, concise ${period} narrative summary (3-5 sentences) of the following diary entries. Focus on themes, emotions, and notable events.

Entries:
${entriesText}

Write only the narrative, no headers or labels.`;

    try {
      narrative = await generateText(prompt);
    } catch {
      narrative = "Unable to generate summary at this time.";
    }
  }

  return {
    id: type.replace("_", "-"),
    type,
    title,
    data: { period, narrative },
    generated_at: nowISO(),
  };
}

async function buildInsightClusterWidgets(
  insights: InsightRow[]
): Promise<Widget[]> {
  // Group insights by branch_id
  const clusters = new Map<string, InsightRow[]>();
  for (const insight of insights) {
    if (!insight.branch_id) continue;
    if (!clusters.has(insight.branch_id)) clusters.set(insight.branch_id, []);
    clusters.get(insight.branch_id)!.push(insight);
  }

  const widgets: Widget[] = [];

  for (const [branchId, clusterInsights] of clusters) {
    const entryIds = [...new Set(clusterInsights.map((i) => i.entry_id))];
    const insightTexts = clusterInsights.map((i) => i.insight_text).join("\n\n");

    const prompt = `You are a reflective journaling assistant. Summarize the following related insights in 2-3 sentences, identifying the core recurring theme.

Insights:
${insightTexts}

Write only the summary.`;

    let summary = insightTexts.slice(0, 200);
    try {
      summary = await generateText(prompt);
    } catch {
      // keep truncated text
    }

    widgets.push({
      id: `insight-cluster-${branchId}`,
      type: "insight_cluster",
      title: "Insight Cluster",
      data: { branch_id: branchId, entry_ids: entryIds, summary },
      generated_at: nowISO(),
    });
  }

  return widgets;
}

// ── Stale widget retirement ───────────────────────────────────────────────────

function retireStaleWidgets(
  widgets: Widget[],
  entries: EntryRow[]
): Widget[] {
  return widgets.filter((w) => {
    if (w.min_entries === undefined) return true;

    // Count qualifying entries for this widget type
    let count = 0;
    if (w.type === "mood_trend") {
      count = entries.filter((e) => e.category === "feelings").length;
    } else if (w.type === "life_theme") {
      const branchId = (w.data as { branch_id?: string }).branch_id;
      if (branchId) {
        count = entries.filter((e) => e.branch_id === branchId).length;
      }
    }

    return count >= w.min_entries;
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build all widget configs for a user and persist them to profiles.settings.dashboard_widgets.
 */
export async function buildAndSaveWidgets(userId: string): Promise<void> {
  const supabase = getServiceClient();

  // Fetch all entries for this user
  const { data: entries, error: entriesError } = await supabase
    .from("entries")
    .select("id, content, category, metadata, branch_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (entriesError) {
    throw new Error(
      `[widgets] Failed to fetch entries for user ${userId}: ${entriesError.message}`
    );
  }

  // Fetch all insights for this user
  const { data: insights, error: insightsError } = await supabase
    .from("insights")
    .select("id, entry_id, insight_text, branch_id")
    .eq("user_id", userId);

  if (insightsError) {
    throw new Error(
      `[widgets] Failed to fetch insights for user ${userId}: ${insightsError.message}`
    );
  }

  const allEntries = (entries ?? []) as EntryRow[];
  const allInsights = (insights ?? []) as InsightRow[];

  // Build all widgets in parallel where possible
  const [
    moodTrendWidget,
    lifeThemeWidgets,
    dailySummary,
    weeklySummary,
    monthlySummary,
    insightClusterWidgets,
  ] = await Promise.all([
    buildMoodTrendWidget(allEntries),
    buildLifeThemeWidgets(allEntries),
    buildSummaryWidget("daily_summary", allEntries),
    buildSummaryWidget("weekly_summary", allEntries),
    buildSummaryWidget("monthly_summary", allEntries),
    buildInsightClusterWidgets(allInsights),
  ]);

  // Assemble widget list
  let widgets: Widget[] = [
    buildCaloriesTodayWidget(allEntries),
    buildExpensesTodayWidget(allEntries),
    ...(moodTrendWidget ? [moodTrendWidget] : []),
    ...lifeThemeWidgets,
    dailySummary,
    weeklySummary,
    monthlySummary,
    ...insightClusterWidgets,
  ];

  // Retire stale widgets
  widgets = retireStaleWidgets(widgets, allEntries);

  // Persist to profiles.settings.dashboard_widgets
  // Read current settings first to merge (preserve other settings keys)
  const { data: profile } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", userId)
    .single();

  const currentSettings = (profile?.settings as Record<string, unknown>) ?? {};
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      settings: { ...currentSettings, dashboard_widgets: widgets },
    })
    .eq("id", userId);

  if (updateError) {
    throw new Error(
      `[widgets] Failed to save widgets for user ${userId}: ${updateError.message}`
    );
  }
}
