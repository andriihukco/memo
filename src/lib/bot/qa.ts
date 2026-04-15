import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "../embedding";
import { env } from "../env";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Category =
  | "thoughts"
  | "ideas"
  | "feelings"
  | "expenses"
  | "calories"
  | "workout";

export interface QAContext {
  userId: string;
  question: string;
  currentUtcDate: Date;
}

interface TemporalFilter {
  from: Date;
  to: Date;
}

interface RetrievedEntry {
  id: string;
  content: string;
  category: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const QA_MODEL = "gemini-2.5-flash";
const SIMILARITY_THRESHOLD = 0.75;
const TOP_K = 10;

// ── Supabase service client ───────────────────────────────────────────────────

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ── 3.1 Temporal filter resolver ──────────────────────────────────────────────

/**
 * Parse natural-language temporal references (Ukrainian + English) into a UTC date range.
 * Returns null for unrecognised references.
 */
export function resolveTemporalFilter(
  question: string,
  now: Date
): TemporalFilter | null {
  const q = question.toLowerCase();

  // Helper: start of a UTC day
  const startOfDay = (d: Date): Date => {
    const r = new Date(d);
    r.setUTCHours(0, 0, 0, 0);
    return r;
  };

  // Helper: end of a UTC day (23:59:59.999)
  const endOfDay = (d: Date): Date => {
    const r = new Date(d);
    r.setUTCHours(23, 59, 59, 999);
    return r;
  };

  // Helper: start of the UTC week (Monday)
  const startOfWeek = (d: Date): Date => {
    const r = new Date(d);
    const day = r.getUTCDay(); // 0=Sun, 1=Mon, …
    const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
    r.setUTCDate(r.getUTCDate() + diff);
    r.setUTCHours(0, 0, 0, 0);
    return r;
  };

  // Helper: end of the UTC week (Sunday 23:59:59.999)
  const endOfWeek = (d: Date): Date => {
    const start = startOfWeek(d);
    const r = new Date(start);
    r.setUTCDate(r.getUTCDate() + 6);
    r.setUTCHours(23, 59, 59, 999);
    return r;
  };

  // Helper: start of the UTC month
  const startOfMonth = (d: Date): Date => {
    const r = new Date(d);
    r.setUTCDate(1);
    r.setUTCHours(0, 0, 0, 0);
    return r;
  };

  // "yesterday" / "вчора"
  if (q.includes("yesterday") || q.includes("вчора")) {
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
  }

  // "today" / "сьогодні"
  if (q.includes("today") || q.includes("сьогодні")) {
    return { from: startOfDay(now), to: endOfDay(now) };
  }

  // "last week" / "минулого тижня" — must be checked before "this week"
  if (q.includes("last week") || q.includes("минулого тижня")) {
    const lastWeekDay = new Date(now);
    lastWeekDay.setUTCDate(lastWeekDay.getUTCDate() - 7);
    return { from: startOfWeek(lastWeekDay), to: endOfWeek(lastWeekDay) };
  }

  // "this week" / "цього тижня"
  if (q.includes("this week") || q.includes("цього тижня")) {
    return { from: startOfWeek(now), to: new Date(now) };
  }

  // "last Monday" / "минулого понеділка"
  // Find the most recent Monday that is strictly before today (or today if today is Monday → go back 7 days)
  if (q.includes("last monday") || q.includes("минулого понеділка")) {
    const day = now.getUTCDay(); // 0=Sun, 1=Mon, 2=Tue, …, 6=Sat
    // Days since last Monday: Mon=7, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    const daysBack = day === 0 ? 6 : day === 1 ? 7 : day - 1;
    const lastMonday = new Date(now);
    lastMonday.setUTCDate(lastMonday.getUTCDate() - daysBack);
    return { from: startOfDay(lastMonday), to: endOfDay(lastMonday) };
  }

  // "this month" / "цього місяця"
  if (q.includes("this month") || q.includes("цього місяця")) {
    return { from: startOfMonth(now), to: new Date(now) };
  }

  return null;
}

// ── 3.3 Category keyword mapper ───────────────────────────────────────────────

/**
 * Map Ukrainian and English keywords in the question to a Category.
 * Returns null if no category keyword is found.
 */
export function resolveCategoryFilter(question: string): Category | null {
  const q = question.toLowerCase();

  const KEYWORD_MAP: Array<{ keywords: string[]; category: Category }> = [
    {
      keywords: ["їжа", "їв", "їла", "калорії", "food", "ate", "calories", "kcal", "їсти", "харчування"],
      category: "calories",
    },
    {
      keywords: ["витрати", "витратив", "купив", "spent", "spending", "expense", "гроші", "витрачав"],
      category: "expenses",
    },
    {
      keywords: ["тренування", "workout", "gym", "вправи", "спорт", "фітнес"],
      category: "workout",
    },
    {
      keywords: ["думки", "думав", "thoughts", "мислення"],
      category: "thoughts",
    },
    {
      keywords: ["ідеї", "idea", "ideas", "ідея"],
      category: "ideas",
    },
    {
      keywords: ["почуття", "відчував", "feelings", "mood", "настрій", "емоції"],
      category: "feelings",
    },
  ];

  for (const { keywords, category } of KEYWORD_MAP) {
    if (keywords.some((kw) => q.includes(kw))) {
      return category;
    }
  }

  return null;
}

// ── 3.4 Entry retrieval with intersection + fallback ──────────────────────────

/**
 * Retrieve diary entries for a user using semantic search intersected with
 * structured (temporal + category) filters.
 *
 * Strategy:
 * 1. Fetch top-10 semantically similar entries (pgvector RPC).
 * 2. Apply temporal and category filters to get the intersection.
 * 3. If intersection is empty, fall back to structured-filter-only DB query.
 *
 * All queries include user_id filter.
 */
export async function retrieveEntries(
  userId: string,
  embedding: number[],
  temporalFilter: TemporalFilter | null,
  categoryFilter: Category | null
): Promise<RetrievedEntry[]> {
  const supabase = getServiceClient();
  const embeddingLiteral = `[${embedding.join(",")}]`;

  // Step 1: semantic search (top-10, no exclude_id needed for QA)
  const { data: semanticData, error: semanticError } = await supabase.rpc(
    "find_similar_entries",
    {
      p_user_id: userId,
      p_embedding: embeddingLiteral,
      p_exclude_id: "00000000-0000-0000-0000-000000000000", // dummy — we want all entries
      p_top_k: TOP_K,
    }
  );

  if (semanticError) {
    console.error("[qa] find_similar_entries RPC error:", semanticError.message);
  }

  const semanticEntries: Array<{
    id: string;
    content: string;
    category: string;
    created_at: string;
    similarity: number;
  }> = semanticData ?? [];

  // Step 2: apply structured filters to semantic results (intersection)
  const aboveThreshold = semanticEntries.filter((e) => e.similarity > SIMILARITY_THRESHOLD);

  let intersection = aboveThreshold;

  if (temporalFilter) {
    intersection = intersection.filter((e) => {
      const ts = new Date(e.created_at).getTime();
      return ts >= temporalFilter.from.getTime() && ts <= temporalFilter.to.getTime();
    });
  }

  if (categoryFilter) {
    intersection = intersection.filter((e) => e.category === categoryFilter);
  }

  // If intersection has results, fetch full metadata for those entry ids
  if (intersection.length > 0) {
    return fetchFullEntries(supabase, userId, intersection.map((e) => e.id));
  }

  // Step 3: fallback — structured-filter-only query
  return fetchStructuredEntries(supabase, userId, temporalFilter, categoryFilter);
}

async function fetchFullEntries(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  ids: string[]
): Promise<RetrievedEntry[]> {
  const { data, error } = await supabase
    .from("entries")
    .select("id, content, category, metadata, created_at")
    .eq("user_id", userId)
    .in("id", ids);

  if (error) {
    console.error("[qa] fetchFullEntries error:", error.message);
    return [];
  }

  return (data ?? []) as RetrievedEntry[];
}

async function fetchStructuredEntries(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  temporalFilter: TemporalFilter | null,
  categoryFilter: Category | null
): Promise<RetrievedEntry[]> {
  let query = supabase
    .from("entries")
    .select("id, content, category, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(TOP_K);

  if (temporalFilter) {
    query = query
      .gte("created_at", temporalFilter.from.toISOString())
      .lte("created_at", temporalFilter.to.toISOString());
  }

  if (categoryFilter) {
    query = query.eq("category", categoryFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[qa] fetchStructuredEntries error:", error.message);
    return [];
  }

  return (data ?? []) as RetrievedEntry[];
}

// ── 3.6 Answer synthesis ──────────────────────────────────────────────────────

const QA_SYSTEM_PROMPT = `Ти — Memo, розумний особистий асистент. Ти маєш доступ до записів щоденника користувача І до своїх загальних знань.

Якщо питання стосується записів щоденника — відповідай на основі наданих записів.
Якщо питання загальне (рецепти, факти, поради, розрахунки тощо) — відповідай зі своїх знань КОРОТКО (TLDR формат, 2-4 речення максимум).
Якщо записів немає але питання загальне — дай коротку корисну відповідь.

ВАЖЛИВО — аналіз харчування:
Якщо в записах є продукти з вагою, але немає калорій — РОЗРАХУЙ їх сам.
Якщо є dashboard_metrics з protein_g, carbs_g, fat_g — використовуй їх напряму.
Якщо є goal_metrics — покажи прогрес до цілі.

СТРІКИ — якщо є метрика з aggregate="last" — це поточний стрік.

Правила форматування (Telegram Markdown):
- *жирний* для ключових цифр, дат, назв
- _курсив_ для цитат
- Абзаци, не суцільний текст
- Емодзі: 📅 дати, 💸 витрати, 🔥 калорії, 💪 тренування, 💭 думки, 😌 почуття, 🥩 білки, 🍞 вугл, 🧈 жири, 🎯 цілі
- Для загальних питань: TLDR — коротко і по суті, без зайвих слів`;

/**
 * Synthesise a Ukrainian answer from retrieved diary entries using gemini-2.5-flash.
 */
export async function synthesiseAnswer(
  question: string,
  entries: RetrievedEntry[]
): Promise<string> {
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: QA_MODEL,
    systemInstruction: QA_SYSTEM_PROMPT,
  });

  const entriesText = entries.length > 0
    ? entries
        .map((e) => {
          const metaStr =
            e.metadata && Object.keys(e.metadata).length > 0
              ? `\n  Метадані: ${JSON.stringify(e.metadata)}`
              : "";
          return `[${e.created_at}] (${e.category})\n  ${e.content}${metaStr}`;
        })
        .join("\n\n")
    : "(Записів щоденника не знайдено — відповідай зі своїх загальних знань)";

  const prompt = `Записи користувача:\n\n${entriesText}\n\nПитання: ${question}`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// ── 3.6 QA orchestrator ───────────────────────────────────────────────────────

/**
 * Answer a natural-language question about the user's diary history.
 * Returns a Ukrainian answer string, or a Ukrainian "no data" / error message.
 */
export async function answerQuestion(ctx: QAContext): Promise<string> {
  try {
    const { userId, question, currentUtcDate } = ctx;

    // Step 1: embed the question
    const embedding = await generateEmbedding(question);

    // Step 2: resolve structured filters
    const temporalFilter = resolveTemporalFilter(question, currentUtcDate);
    const categoryFilter = resolveCategoryFilter(question);

    // Step 3: retrieve entries
    const entries = await retrieveEntries(userId, embedding, temporalFilter, categoryFilter);

    // Step 4: synthesise — even with no entries, Gemini can answer from general knowledge
    return await synthesiseAnswer(question, entries);
  } catch (err) {
    console.error("[qa] answerQuestion failed:", err);
    return "Вибач, не вдалося отримати відповідь. Спробуй ще раз. 🙏";
  }
}
