import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "../embedding";
import { env } from "../env";
import { deriveUserKey, decryptField } from "../crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

// Open-ended — matches the open-category system from migration 000004
export type Category = string;

export interface QAContext {
  userId: string;
  question: string;
  currentUtcDate: Date;
}

interface TemporalFilter {
  from: Date;
  to: Date;
}

// similarity is present for semantic hits, undefined for structured-fallback hits
interface RetrievedEntry {
  id: string;
  content: string;
  category: string;
  metadata: Record<string, unknown>;
  created_at: string;
  similarity?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const QA_MODEL = "gemini-2.5-flash";
const SIMILARITY_THRESHOLD = 0.45;
const TOP_K = 15;
const RERANK_TOP_K = 5;
const USER_UTC_OFFSET_HOURS = 3;

// ── Supabase service client ───────────────────────────────────────────────────

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ── Decrypt entries helper ────────────────────────────────────────────────────

async function decryptEntries<T extends { content: string }>(
  entries: T[],
  userId: string
): Promise<T[]> {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("profiles")
      .select("telegram_id, encryption_salt")
      .eq("id", userId)
      .single();
    if (!data?.telegram_id) return entries;
    const key = await deriveUserKey(
      String(data.telegram_id),
      data.encryption_salt ?? null
    );
    return Promise.all(
      entries.map(async (e) => ({
        ...e,
        content: await decryptField(e.content, key),
      }))
    );
  } catch {
    return entries; // fallback: return as-is (legacy plaintext)
  }
}

// ── Temporal filter resolver ──────────────────────────────────────────────────

/**
 * All "day" boundaries are computed in the user's local timezone (UTC+3).
 * `now` is a UTC Date; we shift it by USER_UTC_OFFSET_HOURS before computing
 * start-of-day / start-of-week, then shift the result back to UTC for DB queries.
 */
export function resolveTemporalFilter(
  question: string,
  now: Date
): TemporalFilter | null {
  const q = question.toLowerCase();

  const localNow = new Date(now.getTime() + USER_UTC_OFFSET_HOURS * 60 * 60 * 1000);

  const toUtc = (d: Date): Date => new Date(d.getTime() - USER_UTC_OFFSET_HOURS * 60 * 60 * 1000);

  const startOfLocalDay = (d: Date): Date => {
    const r = new Date(d); r.setUTCHours(0, 0, 0, 0); return r;
  };
  const endOfLocalDay = (d: Date): Date => {
    const r = new Date(d); r.setUTCHours(23, 59, 59, 999); return r;
  };
  const startOfLocalWeek = (d: Date): Date => {
    const r = new Date(d);
    const day = r.getUTCDay();
    r.setUTCDate(r.getUTCDate() + (day === 0 ? -6 : 1 - day));
    r.setUTCHours(0, 0, 0, 0); return r;
  };
  const endOfLocalWeek = (d: Date): Date => {
    const r = new Date(startOfLocalWeek(d));
    r.setUTCDate(r.getUTCDate() + 6); r.setUTCHours(23, 59, 59, 999); return r;
  };
  const startOfLocalMonth = (d: Date): Date => {
    const r = new Date(d); r.setUTCDate(1); r.setUTCHours(0, 0, 0, 0); return r;
  };

  // Relative: yesterday / today / this week / last week / this month
  if (q.includes("yesterday") || q.includes("вчора")) {
    const y = new Date(localNow); y.setUTCDate(y.getUTCDate() - 1);
    return { from: toUtc(startOfLocalDay(y)), to: toUtc(endOfLocalDay(y)) };
  }
  if (q.includes("today") || q.includes("сьогодні") || q.includes("сьогодн")) {
    return { from: toUtc(startOfLocalDay(localNow)), to: toUtc(endOfLocalDay(localNow)) };
  }
  if (q.includes("last week") || q.includes("минулого тижня")) {
    const lw = new Date(localNow); lw.setUTCDate(lw.getUTCDate() - 7);
    return { from: toUtc(startOfLocalWeek(lw)), to: toUtc(endOfLocalWeek(lw)) };
  }
  if (q.includes("this week") || q.includes("цього тижня") || q.includes("цей тиждень") || q.includes("на цьому тижні") || q.includes("за цей тиждень")) {
    return { from: toUtc(startOfLocalWeek(localNow)), to: now };
  }
  if (q.includes("last monday") || q.includes("минулого понеділка")) {
    const day = localNow.getUTCDay();
    const daysBack = day === 0 ? 6 : day === 1 ? 7 : day - 1;
    const lm = new Date(localNow); lm.setUTCDate(lm.getUTCDate() - daysBack);
    return { from: toUtc(startOfLocalDay(lm)), to: toUtc(endOfLocalDay(lm)) };
  }
  if (q.includes("this month") || q.includes("цього місяця") || q.includes("цей місяць")) {
    return { from: toUtc(startOfLocalMonth(localNow)), to: now };
  }

  // Absolute date: "15 квітня", "16 april", "april 15", "15.04", "15/04" etc.
  // Ukrainian month names
  const UA_MONTHS: Record<string, number> = {
    "січня":0,"лютого":1,"березня":2,"квітня":3,"травня":4,"червня":5,
    "липня":6,"серпня":7,"вересня":8,"жовтня":9,"листопада":10,"грудня":11,
    "january":0,"february":1,"march":2,"april":3,"may":4,"june":5,
    "july":6,"august":7,"september":8,"october":9,"november":10,"december":11,
  };

  // "15 квітня" or "квітня 15"
  for (const [monthName, monthIdx] of Object.entries(UA_MONTHS)) {
    if (q.includes(monthName)) {
      const dayMatch = q.match(/(\d{1,2})\s+(?:квітня|лютого|березня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня|january|february|march|april|may|june|july|august|september|october|november|december)/i)
        ?? q.match(/(?:квітня|лютого|березня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i);
      if (dayMatch) {
        const day = parseInt(dayMatch[1], 10);
        const year = localNow.getUTCFullYear();
        const localDate = new Date(Date.UTC(year, monthIdx, day));
        // If the date is in the future, use previous year
        if (localDate > localNow) localDate.setUTCFullYear(year - 1);
        return { from: toUtc(startOfLocalDay(localDate)), to: toUtc(endOfLocalDay(localDate)) };
      }
    }
  }

  // "15.04" or "15/04" or "04/15"
  const numDateMatch = q.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
  if (numDateMatch) {
    let day = parseInt(numDateMatch[1], 10);
    let month = parseInt(numDateMatch[2], 10) - 1;
    // Handle MM/DD vs DD/MM — if first number > 12, it's DD/MM
    if (day > 12 && month <= 11) { /* DD/MM — already correct */ }
    else if (month > 11) { [day, month] = [month + 1, day - 1]; }
    const year = numDateMatch[3]
      ? (numDateMatch[3].length === 2 ? 2000 + parseInt(numDateMatch[3]) : parseInt(numDateMatch[3]))
      : localNow.getUTCFullYear();
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      const localDate = new Date(Date.UTC(year, month, day));
      return { from: toUtc(startOfLocalDay(localDate)), to: toUtc(endOfLocalDay(localDate)) };
    }
  }

  return null;
}

// ── Category keyword mapper ───────────────────────────────────────────────────

// Open-ended: returns a string category name or null.
// Covers both built-in and common new categories.
export function resolveCategoryFilter(question: string): Category | null {
  const q = question.toLowerCase();

  const KEYWORD_MAP: Array<{ keywords: string[]; category: string }> = [
    { keywords: ["їжа", "їв", "їла", "калорії", "food", "ate", "calories", "kcal", "їсти", "харчування", "з'їв", "з'їла", "поїв", "поїла", "що я їв", "що їв", "що їла", "скільки з'їв", "скільки калорій", "макроси", "macros", "protein", "білки"], category: "calories" },
    { keywords: ["витрати", "витратив", "купив", "spent", "spending", "expense", "гроші", "витрачав"], category: "expenses" },
    { keywords: ["тренування", "workout", "gym", "вправи", "спорт", "фітнес", "пробіг", "пробігав"], category: "workout" },
    { keywords: ["думки", "думав", "thoughts", "мислення"], category: "thoughts" },
    { keywords: ["ідеї", "idea", "ideas", "ідея"], category: "ideas" },
    { keywords: ["почуття", "відчував", "feelings", "mood", "настрій", "емоції"], category: "feelings" },
    { keywords: ["сон", "спав", "sleep", "прокинувся", "засинав"], category: "sleep" },
    { keywords: ["здоров", "health", "медитац", "вода", "water", "кофеїн", "caffeine", "кава", "coffee", "чай", "tea"], category: "health" },
    { keywords: ["сни", "приснилось", "dream", "приснився"], category: "dreams" },
    { keywords: ["книг", "читав", "book", "reading", "сторінок"], category: "books" },
    { keywords: ["ціль", "goal", "хочу досягти", "планую", "target"], category: "goals" },
  ];

  for (const { keywords, category } of KEYWORD_MAP) {
    if (keywords.some((kw) => q.includes(kw))) return category;
  }
  return null;
}

// ── Re-ranking ────────────────────────────────────────────────────────────────

/**
 * Cross-encoder re-ranking using Gemini as the scoring model.
 * Scores each candidate entry's relevance to the question (0–10),
 * then returns the top-K highest-scoring entries.
 * Falls back to original order on any error.
 */
async function rerankEntries(
  question: string,
  entries: RetrievedEntry[],
  topK = RERANK_TOP_K
): Promise<RetrievedEntry[]> {
  if (entries.length <= topK) return entries;

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: QA_MODEL });

  const candidateList = entries
    .map((e, i) => `[${i}] (${e.category}, ${e.created_at.slice(0, 10)}): ${e.content}`)
    .join("\n");

  const prompt =
    `Question: "${question}"\n\n` +
    `Rate each diary entry's relevance to the question from 0 to 10.\n` +
    `Return ONLY a JSON array: [{"index": <number>, "score": <number>}, ...]\n\n` +
    `Entries:\n${candidateList}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().replace(/```json\n?|\n?```/g, "").trim();
    const scores = JSON.parse(raw) as { index: number; score: number }[];

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => entries[s.index])
      .filter(Boolean);
  } catch (err) {
    console.warn("[qa] rerank failed, using original order:", err);
    return entries.slice(0, topK);
  }
}

// ── Entry retrieval ───────────────────────────────────────────────────────────

export async function retrieveEntries(
  userId: string,
  embedding: number[],
  temporalFilter: TemporalFilter | null,
  categoryFilter: Category | null
): Promise<RetrievedEntry[]> {
  const supabase = getServiceClient();

  // For broad "about me" questions (no temporal, no category filter):
  // skip semantic search entirely — just return the most recent entries.
  if (!temporalFilter && !categoryFilter) {
    const { data } = await supabase
      .from("entries")
      .select("id, content, category, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    const raw = (data ?? []) as RetrievedEntry[];
    return decryptEntries(raw, userId);
  }

  const embeddingLiteral = `[${embedding.join(",")}]`;

  let semanticData: Array<{ id: string; content: string; category: string; created_at: string; similarity: number }> | null = null;
  let semanticError: { message: string } | null = null;

  // Temporal-filtered search
  const result = await supabase.rpc("find_similar_entries", {
    p_user_id: userId,
    p_embedding: embeddingLiteral,
    p_exclude_id: "00000000-0000-0000-0000-000000000000",
    p_top_k: TOP_K,
  });
  semanticData = result.data;
  semanticError = result.error;

  if (semanticError) {
    console.error("[qa] semantic search RPC error:", semanticError.message);
  }

  const semanticEntries = (semanticData ?? []) as Array<{
    id: string; content: string; category: string; created_at: string; similarity: number;
  }>;

  // Filter by threshold + structured filters
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

  // Semantic intersection hit — fetch full metadata + tag with similarity
  if (intersection.length > 0) {
    const full = await fetchFullEntries(supabase, userId, intersection.map((e) => e.id));
    const decrypted = await decryptEntries(full, userId);
    const simMap = new Map(intersection.map((e) => [e.id, e.similarity]));
    return decrypted.map((e) => ({ ...e, similarity: simMap.get(e.id) }));
  }

  // Fallback — structured-filter-only query
  const structured = await fetchStructuredEntries(supabase, userId, temporalFilter, categoryFilter);
  return decryptEntries(structured, userId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchFullEntries(supabase: any, userId: string, ids: string[]): Promise<RetrievedEntry[]> {
  const { data, error } = await supabase
    .from("entries")
    .select("id, content, category, metadata, created_at")
    .eq("user_id", userId)
    .in("id", ids);

  if (error) { console.error("[qa] fetchFullEntries error:", error.message); return []; }
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
  if (categoryFilter) query = query.eq("category", categoryFilter);

  const { data, error } = await query;
  if (error) { console.error("[qa] fetchStructuredEntries error:", error.message); return []; }
  // No similarity score — these came from structured fallback
  return (data ?? []) as RetrievedEntry[];
}

// ── Answer synthesis ──────────────────────────────────────────────────────────

const QA_SYSTEM_PROMPT = `Ти — Memo, особистий AI-асистент з доступом до щоденника користувача.
Відповідай ЗАВЖДИ мовою користувача (якщо питання українською — відповідай українською, англійською — англійською).

━━━ ГОЛОВНЕ ПРАВИЛО ━━━
Відповідай на основі наданих записів. Якщо записів немає або вони не стосуються питання — скажи про це чітко.
НЕ вигадуй. НЕ додавай інформацію якої немає в записах.
Якщо питання про конкретну тему (робота, стосунки, подорожі) і записів на цю тему немає — так і скажи: "Записів про [тему] не знайдено."

━━━ ПИТАННЯ "ПРО МЕНЕ" / ІНСАЙТИ / АКТИВНІСТЬ ━━━
Коли питання типу "що ти знаєш про мене", "розкажи про мої звички", "які мої патерни", "insight about me", "what do you know about me", "recent activity", "what have I been doing", "що я робив", "моя активність", "що тобі від мене", "що тобі відомо про мене", "що ти про мене знаєш", "що ти можеш сказати про мене", "розкажи про мене", "що в моєму щоденнику", "що ти пам'ятаєш про мене":
1. Проаналізуй ВСІ надані записи — це реальні дані щоденника
2. Знайди патерни: що часто повторюється, що змінюється, тренди
3. Зроби конкретні висновки про звички, настрій, активність, харчування, витрати
4. Відповідай конкретно, з датами і цифрами де є
5. Структуруй відповідь по темах: харчування, активність, настрій, витрати тощо
6. ЗАВЖДИ давай відповідь — навіть якщо записи різнорідні, знайди що об'єднує

━━━ ПИТАННЯ ПРО КОНКРЕТНУ ДАТУ ━━━
Якщо питання "що було 15 квітня" або "факти за [дату]":
1. Перелічи ВСІ записи за цю дату
2. Підсумуй метрики (калорії, активність, настрій тощо)
3. Якщо записів за цю дату немає — скажи чітко

━━━ ХАРЧУВАННЯ / МАКРОСИ ━━━
1. Знайди ВСІ записи з категорією "calories" або з dashboard_metrics що містять kcal_intake
2. ПІДСУМУЙ значення (aggregate="sum" → додавай)
3. Якщо є metadata.food_item але немає dashboard_metrics — скажи, що дані про харчування неповні, і НЕ розраховуй калорії сам
4. Покажи підсумок: ккал, білки, жири, вуглеводи + що саме їв
5. Для питань "скільки я з'їв цього тижня" / "what did I eat" — підсумуй всі записи calories за вказаний період

━━━ МЕТРИКИ ━━━
dashboard_metrics в metadata.dashboard_metrics: {key, value, unit, aggregate}
aggregate="sum" → підсумовуй, aggregate="avg" → середнє, aggregate="last" → останнє

━━━ ФОРМАТУВАННЯ (Telegram Markdown) ━━━
*жирний* для цифр і назв, _курсив_ для приміток
Емодзі: 📅 дати, 💸 витрати, 🔥 калорії, 💪 тренування, 💭 думки, 😌 почуття, 🥩 білки, 🍞 вугл, 🧈 жири, 🎯 цілі, 😴 сон, 💧 вода, 📊 статистика`;

export async function synthesiseAnswer(
  question: string,
  entries: RetrievedEntry[]
): Promise<string> {
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: QA_MODEL,
    systemInstruction: QA_SYSTEM_PROMPT,
  });

  let entriesText: string;
  let hasLowConfidence = false;

  // Detect broad "about me" questions — entries were fetched by recency, not semantic search
  const isBroadQuestion = entries.length > 0 && entries.every((e) => e.similarity === undefined);

  if (entries.length === 0) {
    entriesText = "(Записів щоденника не знайдено)";
  } else {
    entriesText = entries
      .map((e) => {
        const metaStr =
          e.metadata && Object.keys(e.metadata).length > 0
            ? `\n  Метадані: ${JSON.stringify(e.metadata)}`
            : "";
        // For broad questions, skip confidence noise — just show the entry
        if (isBroadQuestion) {
          return `[${e.created_at}] (${e.category})\n  ${e.content}${metaStr}`;
        }
        let confNote: string;
        if (e.similarity === undefined) {
          confNote = "[структурний пошук]";
          hasLowConfidence = true;
        } else if (e.similarity < 0.6) {
          confNote = `[схожість: ${(e.similarity * 100).toFixed(0)}%]`;
          hasLowConfidence = true;
        } else {
          confNote = `[схожість: ${(e.similarity * 100).toFixed(0)}%]`;
        }
        return `[${e.created_at}] ${confNote} (${e.category})\n  ${e.content}${metaStr}`;
      })
      .join("\n\n");
  }

  const confidenceInstruction = (!isBroadQuestion && hasLowConfidence)
    ? "\nУВАГА: Деякі записи знайдено лише за структурними фільтрами. Якщо відповідь непевна — додай примітку _(дані можуть бути неповними)_."
    : "";

  const prompt = `Записи користувача:\n\n${entriesText}\n\nПитання: ${question}\n\nВАЖЛИВО: Відповідай ТІЛЬКИ на питання. Якщо записи не стосуються питання — скажи що таких записів немає.${confidenceInstruction}`;

  const result = await model.generateContent(prompt);
  const answer = result.response.text().trim();
  return answer + '\n\n_AI може помилятись. Якщо потрібна допомога — @get\\_memo\\_updates_';
}

// ── QA orchestrator ───────────────────────────────────────────────────────────

export async function answerQuestion(ctx: QAContext): Promise<string> {
  const { userId, question, currentUtcDate } = ctx;

  try {
    const temporalFilter = resolveTemporalFilter(question, currentUtcDate);
    const categoryFilter = resolveCategoryFilter(question);
    const supabase = getServiceClient();

    let entries: RetrievedEntry[] = [];

    // For broad "about me" questions or when embedding might be slow,
    // try semantic search first but fall back to direct DB query on any error.
    try {
      const embedding = await generateEmbedding(question);
      const candidates = await retrieveEntries(userId, embedding, temporalFilter, categoryFilter);
      entries = await rerankEntries(question, candidates);
    } catch (embErr) {
      console.warn("[qa] embedding/search failed, falling back to direct DB query:", embErr instanceof Error ? embErr.message : embErr);
      entries = await fetchStructuredEntries(supabase, userId, temporalFilter, categoryFilter);
      entries = await decryptEntries(entries, userId);
      if (entries.length === 0 && !temporalFilter && !categoryFilter) {
        const { data } = await supabase
          .from("entries")
          .select("id, content, category, metadata, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(15);
        const raw = (data ?? []) as RetrievedEntry[];
        entries = await decryptEntries(raw, userId);
      }
    }

    return await synthesiseAnswer(question, entries);
  } catch (err) {
    console.error("[qa] answerQuestion failed:", err instanceof Error ? err.message : err);
    // Absolute last resort — answer as a conversational response
    try {
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: QA_MODEL,
        systemInstruction: `Ти — Memo, особистий AI-асистент. Відповідай як уважний друг. Відповідай мовою користувача.`,
      });
      const result = await model.generateContent(ctx.question);
      return result.response.text().trim();
    } catch {
      return "Не вдалося знайти відповідь. Спробуй ще раз.";
    }
  }
}
