import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { env } from "./env";

// ── Schemas ───────────────────────────────────────────────────────────────────

export type Intent = "save_entry" | "question" | "converse" | "smalltalk" | "action";
const IntentSchema = z.enum(["save_entry", "question", "converse", "smalltalk", "action"]);

const ExpenseMetadataSchema = z.object({
  amount: z.number(),
  currency: z.string().min(1),
  category: z.string().min(1),
});

const CalorieMetadataSchema = z.object({
  food_item: z.string().min(1),
  estimated_calories: z.number().nonnegative(),
});

const DashboardMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  unit: z.string(),
  icon: z.string().optional(),
  aggregate: z.enum(["sum", "avg", "last"]).default("sum"),
});
export type DashboardMetric = z.infer<typeof DashboardMetricSchema>;

const GoalMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  target: z.number(),
  unit: z.string(),
  icon: z.string().optional(),
  period: z.string().optional(),
});
export type GoalMetric = z.infer<typeof GoalMetricSchema>;

const EntryPayloadSchema = z.object({
  category: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/),
  category_label: z.string().min(1),
  is_new_category: z.boolean().default(false),
  content: z.string(),
  metadata: z.union([ExpenseMetadataSchema, CalorieMetadataSchema, z.object({}).passthrough()]),
  dashboard_metrics: z.array(DashboardMetricSchema).default([]),
  goal_metrics: z.array(GoalMetricSchema).default([]),
});
export type EntryPayload = z.infer<typeof EntryPayloadSchema>;

const ClassificationResultSchema = z.object({
  intent: IntentSchema,
  entries: z.array(EntryPayloadSchema).default([]),
  action_type: z.enum(["delete_entries", "create_widget", "merge_widgets", "update_schedule", "update_entry", "none"]).default("none"),
  action_params: z.record(z.string(), z.unknown()).default(() => ({})),
  // backward-compat aliases
  category: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/).default("thoughts"),
  category_label: z.string().min(1).default("Думки"),
  is_new_category: z.boolean().default(false),
  content: z.string().default(""),
  metadata: z.union([ExpenseMetadataSchema, CalorieMetadataSchema, z.object({}).passthrough()]).default({}),
  dashboard_metrics: z.array(DashboardMetricSchema).default([]),
  goal_metrics: z.array(GoalMetricSchema).default([]),
});
export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

export class ClassificationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ClassificationError";
  }
}

// ── Built-in categories ───────────────────────────────────────────────────────

export const BUILTIN_CATEGORIES: Record<string, { label_ua: string; color: string; icon: string }> = {
  thoughts:      { label_ua: "Думки",      color: "bg-indigo-100 text-indigo-700",  icon: "brain" },
  ideas:         { label_ua: "Ідеї",       color: "bg-amber-100 text-amber-700",    icon: "lightbulb" },
  feelings:      { label_ua: "Почуття",    color: "bg-pink-100 text-pink-700",      icon: "heart" },
  expenses:      { label_ua: "Витрати",    color: "bg-emerald-100 text-emerald-700",icon: "wallet" },
  calories:      { label_ua: "Калорії",    color: "bg-orange-100 text-orange-700",  icon: "flame" },
  workout:       { label_ua: "Тренування", color: "bg-blue-100 text-blue-700",      icon: "dumbbell" },
  goals:         { label_ua: "Цілі",       color: "bg-sky-100 text-sky-700",        icon: "target" },
  sleep:         { label_ua: "Сон",        color: "bg-fuchsia-100 text-fuchsia-700",icon: "moon" },
  health:        { label_ua: "Здоров'я",   color: "bg-teal-100 text-teal-700",      icon: "heart" },
  dreams:        { label_ua: "Сни",        color: "bg-violet-100 text-violet-700",  icon: "sparkles" },
  books:         { label_ua: "Книги",      color: "bg-yellow-100 text-yellow-700",  icon: "book-open" },
  work:          { label_ua: "Робота",     color: "bg-slate-100 text-slate-700",    icon: "briefcase" },
  relationships: { label_ua: "Стосунки",   color: "bg-rose-100 text-rose-700",      icon: "users" },
  travel:        { label_ua: "Подорожі",   color: "bg-cyan-100 text-cyan-700",      icon: "map-pin" },
  gratitude:     { label_ua: "Вдячність",  color: "bg-lime-100 text-lime-700",      icon: "sparkles" },
  music:         { label_ua: "Музика",     color: "bg-purple-100 text-purple-700",  icon: "music" },
  social:        { label_ua: "Соціальне",  color: "bg-pink-100 text-pink-700",      icon: "users" },
};

const NEW_CATEGORY_COLORS = [
  "bg-violet-100 text-violet-700", "bg-teal-100 text-teal-700",
  "bg-rose-100 text-rose-700",     "bg-cyan-100 text-cyan-700",
  "bg-lime-100 text-lime-700",     "bg-fuchsia-100 text-fuchsia-700",
  "bg-sky-100 text-sky-700",       "bg-yellow-100 text-yellow-700",
];

export function colorForNewCategory(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  return NEW_CATEGORY_COLORS[Math.abs(hash) % NEW_CATEGORY_COLORS.length];
}

// ── Prompt 1: Classification (intent + category + content) ───────────────────
// Lean and fast — no metric extraction here.

const CLASSIFY_PROMPT = `You are a personal diary assistant. Classify the user message and return ONLY valid JSON.

INTENT RULES — read carefully:
- save_entry → user logs/records something about themselves NOW (food eaten, activity done, mood felt, event happened). Also use save_entry when user says "порахуй/calculate X" meaning they want to LOG it.
- question   → user asks about PAST diary data they already logged ("скільки я з'їв", "що я робив вчора", "покажи мої витрати"). Also: "insight about me", "what do you know about me", "my habits", "my patterns", "recent activity", "what have I been doing", "show me my stats", "how much did I eat", "what did I eat most", "tell me about myself", "my recent entries", "що ти знаєш про мене", "що ти знаєш про мене від мене", "що тобі відомо про мене", "що тобі від мене", "розкажи про мене", "що ти про мене знаєш", "що ти можеш сказати про мене", "які мої звички", "мої патерни", "моя активність", "що я робив", "що я їв", "мої записи", "покажи мої дані", "що в моєму щоденнику", "що ти пам'ятаєш про мене", "що ти знаєш"
- converse   → user shares feelings, vents, reflects — save + empathetic reply
- smalltalk  → greetings, thanks, "ok", "👍", bye — do NOT save
- action     → command to the bot: delete records, edit records, configure settings, create widgets

CRITICAL DISTINCTION — save_entry vs question:
- "я пив каву" → save_entry (logging current consumption)
- "я пив каву, порахуй кофеїн" → save_entry (wants to LOG caffeine from coffee)
- "скільки кофеїну я випив?" → question (asking about past data)
- "з'їв 200г курки" → save_entry
- "що я їв сьогодні?" → question
- "що ти знаєш про мене?" → question (asking bot to recall diary data)
- "розкажи про мої звички" → question
- "які мої патерни?" → question
- "що я робив вчора?" → question
- "факти за 15 квітня" → question
- "insight about me" → question
- "what do you know about me?" → question
- "what have I been doing?" → question
- "my recent activity" → question
- "show me my stats" → question
- "how much did I eat this week?" → question
- "what did I eat most?" → question
- "my habits" → question
- "tell me about myself" → question
- "що тобі від мене" → question (unusual phrasing = "what do you know about me")
- "що тобі відомо про мене" → question
- "що ти про мене знаєш" → question
- "що ти можеш сказати про мене" → question
- "розкажи про мене" → question
- "що в моєму щоденнику" → question
- "що ти пам'ятаєш про мене" → question
- "мої звички" → question
- "моя активність" → question
- "мої патерни" → question

CATEGORIES (is_new_category=false for all listed):
thoughts, ideas, feelings, expenses, calories, workout, goals, sleep, health, dreams, books, work, relationships, travel, gratitude, music, social

CATEGORY RULES:
- coffee/кава/caffeine/кофеїн → health (extract caffeine_mg metric)
- water/hydration/вода → health
- meditation/yoga → health
- cold shower → health
- fasting → health
- weight/body metrics → health
- alcohol/smoking → health
- sex → sex_life (is_new_category=true)
- reading → books
- sleep/сон → sleep
- dreams/сни → dreams

For action intent set action_type:
- delete_entries: {"category":"<cat|null>","period":"<today|week|month|all|null>","description":"<what>"}
- update_entry: {"entry_id":null,"category":"<cat>","new_content":"<text>","description":"<what>"}
- create_widget: {"metric_key":"<key>","label":"<label>","unit":"<unit>","description":"<what>"}
- update_schedule: {"daily":<bool>,"weekly":<bool>,"monthly":<bool>,"time":"<HH:MM>"}

MULTI-INTENT: if message has multiple DISTINCT topics (food + workout, sleep + mood), create multiple entries.
Single topic with multiple items (4 eggs + chicken + sandwich + coffee = all food) → ONE entry, category=calories.

Schema:
{"intent":"<intent>","entries":[{"category":"<cat>","category_label":"<label in user lang>","is_new_category":<bool>,"content":"<cleaned text>","metadata":<see below>}],"action_type":"none","action_params":{}}

metadata:
- expenses: {"amount":<n>,"currency":"<ISO>","category":"<sub>"}
- calories: {"food_item":"<str>","estimated_calories":<n>}
- others: {}

For question/smalltalk/action: entries=[]
Respond ONLY with JSON.`;

// ── Prompt 2: Metric extraction ───────────────────────────────────────────────
// Focused entirely on extracting numbers. Called only for save_entry/converse.

const METRICS_PROMPT = `You are a metrics extractor for a personal diary. Given a diary entry, extract ALL measurable quantities.

Return JSON: {"dashboard_metrics":[...],"goal_metrics":[...]}

dashboard_metrics format: {"key":"<snake_case>","label":"<in entry's language>","value":<number>,"unit":"<str>","icon":"<lucide-icon>","aggregate":"<sum|avg|last>"}
goal_metrics format: {"key":"<snake_case>","label":"<in entry's language>","target":<number>,"unit":"<str>","icon":"<lucide-icon>","period":"<day|week|month|total>"}

EXTRACTION RULES:

FOOD/CALORIES (category=calories):
- Always extract: kcal_intake(sum), protein_g(sum), carbs_g(sum), fat_g(sum)
- Per 100g: chicken_breast=165kcal/31p/0c/3.6f, rice_cooked=130/2.7/28/0.3, buckwheat=92/3.4/20/0.6, egg=155/13/1/11, salmon=208/20/0/13, oats=389/17/66/7, beef=250/26/0/17, banana=89/1.1/23/0.3, potato_fried=312/3.4/41/14.5
- Estimate unknown foods. Scale by weight.
- icons: utensils(kcal), beef(protein), wheat(carbs), droplets(fat)

WATER (category=health, mentions water/вода/склянка/bottle):
- water_ml(sum): 1 glass/склянка=250ml, 1 bottle=500ml, 1 cup=200ml
- icon: droplets

WORKOUT/RUNNING:
- Running: distance_km(sum), kcal_burned(sum,80kcal/km), active_min(sum,6min/km), steps_count(sum,1200/km)
- Walking: distance_km(sum), kcal_burned(sum,60kcal/km), active_min(sum,15min/km), steps_count(sum,1300/km)
- Steps: steps_count(sum), activity_kcal(sum,400/10000steps), distance_km(sum,7.5/10000steps), active_min(sum,100/10000steps)
- Gym time: active_min(sum), kcal_burned(sum,350-500kcal/60min)
- icons: map-pin(distance), flame(kcal), timer(min), footprints(steps), dumbbell(exercises)

SLEEP (category=sleep):
- sleep_hours(avg): extract from "N годин/hours" OR calculate from times (e.g. 00:30→08:30=8h)
- sleep_quality(avg): tired=4, okay=6, good=8, great=9 (out of 10)
- icons: moon(hours), smile(quality)

MOOD/FEELINGS:
- mood_score(avg): very_bad=2, bad=4, neutral=5, good=7, great=9
- stress_level(avg): very_stressed=9, stressed=7, moderate=5, calm=3, relaxed=1
- energy_level(avg): exhausted=2, tired=4, normal=6, energetic=8, very_energetic=10
- icons: smile(mood), zap(stress), activity(energy)

HEALTH METRICS:
- weight_kg(last), body_fat_pct(last), water_ml(sum)
- cold_shower_min(sum,50kcal/3min), meditation_min(sum,15kcal/10min)
- fasting_hours(last)
- COFFEE/CAFFEINE: caffeine_mg(sum) — espresso=63mg, americano=63mg, drip_coffee=95mg, instant=60mg, latte=63mg, cappuccino=63mg, tea=47mg. Sugar in coffee: sugar_g(sum), kcal_intake(sum,4kcal/g sugar)
- alcohol_units(sum,1beer=1,1wine=1.5,1shot=1), alcohol_kcal(sum,70kcal/unit)
- cigarettes_count(sum), no_smoking_days(last)
- sex_sessions(sum,100kcal/30min)

STREAKS (aggregate=last): no_smoking_days, no_alcohol_days, workout_streak, etc.

GOALS: extract when user states intention/target
- "хочу пробігти 100км" → goal_metrics:[{key:"distance_km",target:100,unit:"км",period:"month"}]
- "ціль 75кг" → goal_metrics:[{key:"weight_kg",target:75,unit:"кг",period:"total"}]
- "хочу прочитати 20 книг" → goal_metrics:[{key:"books_read",target:20,unit:"книг",period:"total"}]
- "маю ціль прочитати 20 книг до кінця року" → goal_metrics:[{key:"books_read",target:20,unit:"книг",period:"total"}]
- "хочу схуднути на 5кг" → goal_metrics:[{key:"weight_loss_kg",target:5,unit:"кг",period:"total"}]
- "ціль — 10000 кроків щодня" → goal_metrics:[{key:"steps_count",target:10000,unit:"кроків",period:"day"}]

If no measurable data: return {"dashboard_metrics":[],"goal_metrics":[]}
Respond ONLY with JSON.`;

// ── Model ─────────────────────────────────────────────────────────────────────

const MODEL_ID = "gemini-2.5-flash";

function getGenAI() {
  return new GoogleGenerativeAI(env.GEMINI_API_KEY);
}

// ── Two-pass classification ───────────────────────────────────────────────────

async function classifyText(input: string | Array<unknown>): Promise<ClassificationResult> {
  const genAI = getGenAI();

  // Pass 1: classify intent + category + content
  const classifyModel = genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: CLASSIFY_PROMPT,
    generationConfig: {},
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const classifyRaw = (await classifyModel.generateContent(input as any)).response.text();
  const classifyParsed = JSON.parse(classifyRaw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim());

  // Normalise
  if (!IntentSchema.safeParse(classifyParsed.intent).success) classifyParsed.intent = "save_entry";
  if (!Array.isArray(classifyParsed.entries)) classifyParsed.entries = [];
  if (!classifyParsed.action_type) classifyParsed.action_type = "none";
  if (!classifyParsed.action_params) classifyParsed.action_params = {};

  // Backward-compat: flat schema → entries[0]
  if (classifyParsed.entries.length === 0 && classifyParsed.category && classifyParsed.content) {
    classifyParsed.entries = [{
      category: classifyParsed.category,
      category_label: classifyParsed.category_label ?? classifyParsed.category,
      is_new_category: classifyParsed.is_new_category ?? false,
      content: classifyParsed.content,
      metadata: classifyParsed.metadata ?? {},
    }];
  }

  for (const e of classifyParsed.entries) {
    if (e.is_new_category === undefined) e.is_new_category = false;
    if (!e.category_label) e.category_label = e.category;
    if (!e.metadata) e.metadata = {};
    e.dashboard_metrics = [];
    e.goal_metrics = [];
  }

  // Pass 2: extract metrics for each entry (only for save_entry/converse)
  // Always run for entries that might have goals, even in non-metric categories
  const GOAL_KEYWORDS = /ціль|хочу|мета|goal|target|want to|plan to|прочита|пробіг|схудн|набра|зробит/i;
  const NON_METRIC_CATEGORIES = new Set(["thoughts", "ideas", "dreams", "relationships", "travel", "gratitude", "music", "social"]);
  const needsMetrics = ["save_entry", "converse"].includes(classifyParsed.intent)
    && classifyParsed.entries.length > 0
    && classifyParsed.entries.some((e: EntryPayload) =>
      !NON_METRIC_CATEGORIES.has(e.category) || GOAL_KEYWORDS.test(e.content)
    );

  if (needsMetrics) {
    const metricsModel = genAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: METRICS_PROMPT,
      generationConfig: {},
    });

    // Extract metrics for all entries in parallel
    await Promise.all(classifyParsed.entries.map(async (entry: EntryPayload) => {
      // Skip non-metric categories UNLESS the content looks like a goal
      if (NON_METRIC_CATEGORIES.has(entry.category) && !GOAL_KEYWORDS.test(entry.content)) {
        entry.dashboard_metrics = [];
        entry.goal_metrics = [];
        return;
      }
      try {
        const metricsPrompt = `Category: ${entry.category}\nContent: ${entry.content}`;
        const metricsRaw = (await metricsModel.generateContent(metricsPrompt)).response.text();
        const metricsParsed = JSON.parse(metricsRaw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim());
        entry.dashboard_metrics = Array.isArray(metricsParsed.dashboard_metrics) ? metricsParsed.dashboard_metrics : [];
        entry.goal_metrics = Array.isArray(metricsParsed.goal_metrics) ? metricsParsed.goal_metrics : [];
      } catch {
        entry.dashboard_metrics = [];
        entry.goal_metrics = [];
      }
    }));
  }

  // Populate backward-compat aliases
  const first = classifyParsed.entries[0];
  if (first) {
    classifyParsed.category = first.category;
    classifyParsed.category_label = first.category_label;
    classifyParsed.is_new_category = first.is_new_category;
    classifyParsed.content = first.content;
    classifyParsed.metadata = first.metadata;
    classifyParsed.dashboard_metrics = first.dashboard_metrics;
    classifyParsed.goal_metrics = first.goal_metrics;
  } else {
    classifyParsed.category = classifyParsed.category ?? "thoughts";
    classifyParsed.category_label = classifyParsed.category_label ?? "Думки";
    classifyParsed.is_new_category = classifyParsed.is_new_category ?? false;
    classifyParsed.content = classifyParsed.content ?? "";
    classifyParsed.metadata = classifyParsed.metadata ?? {};
    classifyParsed.dashboard_metrics = classifyParsed.dashboard_metrics ?? [];
    classifyParsed.goal_metrics = classifyParsed.goal_metrics ?? [];
  }

  return ClassificationResultSchema.parse(classifyParsed);
}

async function attempt<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

export async function classify(text: string): Promise<ClassificationResult> {
  try {
    return await attempt(() => classifyText(text));
  } catch (err) {
    throw new ClassificationError("Classification failed", err);
  }
}

export async function classifyAudio(audioBytes: Buffer, mimeType: string, threadContext?: string): Promise<ClassificationResult> {
  try {
    const contextNote = threadContext
      ? `\n\nConversation context (use this to understand short replies):\n${threadContext}\n\nNow transcribe and classify the audio:`
      : "\n\nTranscribe and classify this audio diary entry.";

    return await attempt(() => classifyText([
      { inlineData: { data: audioBytes.toString("base64"), mimeType } },
      { text: contextNote },
    ]));
  } catch (err) {
    throw new ClassificationError("Audio classification failed", err);
  }
}
