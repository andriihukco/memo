import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { env } from "./env";

// ── Schemas ──────────────────────────────────────────────────────────────────

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

// Dashboard metric — AI extracts these from any entry type
const DashboardMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  unit: z.string(),
  icon: z.string().optional(),
  aggregate: z.enum(["sum", "avg", "last"]).default("sum"),
});

export type DashboardMetric = z.infer<typeof DashboardMetricSchema>;

// Goal metric — AI extracts targets/intentions from goal statements
const GoalMetricSchema = z.object({
  key: z.string(),           // same key namespace as dashboard_metrics for matching
  label: z.string(),
  target: z.number(),        // the goal value
  unit: z.string(),
  icon: z.string().optional(),
  period: z.string().optional(), // "month", "week", "day", "total"
});

export type GoalMetric = z.infer<typeof GoalMetricSchema>;

// Category is now open-ended — any snake_case string is valid
const ClassificationResultSchema = z.object({
  intent: IntentSchema,
  category: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/),
  category_label: z.string().min(1),
  is_new_category: z.boolean().default(false),
  content: z.string(),
  metadata: z.union([
    ExpenseMetadataSchema,
    CalorieMetadataSchema,
    z.object({}).passthrough(),
  ]),
  dashboard_metrics: z.array(DashboardMetricSchema).default([]),
  goal_metrics: z.array(GoalMetricSchema).default([]),
  action_type: z.enum(["delete_entries", "create_widget", "merge_widgets", "update_schedule", "none"]).default("none"),
  action_params: z.record(z.string(), z.unknown()).default(() => ({})),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

// ── Error ─────────────────────────────────────────────────────────────────────

export class ClassificationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ClassificationError";
  }
}

// ── Built-in categories (used as examples / seeds) ────────────────────────────

export const BUILTIN_CATEGORIES: Record<string, { label_ua: string; color: string; icon: string }> = {
  thoughts:      { label_ua: "Думки",      color: "bg-indigo-100 text-indigo-700",  icon: "brain" },
  ideas:         { label_ua: "Ідеї",       color: "bg-amber-100 text-amber-700",    icon: "lightbulb" },
  feelings:      { label_ua: "Почуття",    color: "bg-pink-100 text-pink-700",      icon: "heart" },
  expenses:      { label_ua: "Витрати",    color: "bg-emerald-100 text-emerald-700",icon: "wallet" },
  calories:      { label_ua: "Калорії",    color: "bg-orange-100 text-orange-700",  icon: "flame" },
  workout:       { label_ua: "Тренування", color: "bg-blue-100 text-blue-700",      icon: "dumbbell" },
};

// Palette for auto-assigned new categories
const NEW_CATEGORY_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-lime-100 text-lime-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-sky-100 text-sky-700",
  "bg-yellow-100 text-yellow-700",
];

export function colorForNewCategory(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  return NEW_CATEGORY_COLORS[Math.abs(hash) % NEW_CATEGORY_COLORS.length];
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a personal diary assistant. Given user input (text or audio transcript), return ONLY a valid JSON object.

Schema:
{
  "intent": "<save_entry | question | converse | smalltalk | action>",
  "category": "<snake_case category name>",
  "category_label": "<human-readable label in the user's language>",
  "is_new_category": <true if you invented a new category not in the built-in list>,
  "content": "<cleaned text — preserve user's original language>",
  "metadata": <see rules>,
  "dashboard_metrics": <array of ACTUAL logged metric objects>,
  "goal_metrics": <array of GOAL/TARGET metric objects>
}

Intent rules:
- save_entry  → personal diary entry: a fact, observation, activity, food log, mood note, or goal the user is recording about THEMSELVES. Must be something the user experienced, did, felt, or wants to track.
- question    → asking about past diary data or asking the bot to look something up — do NOT save
- converse    → sharing feelings, venting, reflecting on life — save + empathetic reply
- smalltalk   → greetings, thanks, "ok", "👍", bye, one-word reactions — do NOT save
- action      → a COMMAND or INSTRUCTION directed AT the bot: delete records, configure settings, change schedule, create widgets — do NOT save as entry

CRITICAL — "thoughts" category is ONLY for genuine personal reflections, opinions, or mental notes the user wants to record (e.g. "Думаю що треба змінити роботу", "Зрозумів що важливо проводити більше часу з родиною", "Називай мене Андрій"). 

NEVER use category "thoughts" for:
- Commands to the bot ("налаштуй", "вимкни", "покажи", "видали", "зміни") → these are intent=action
- Questions ("скільки", "що я їв", "покажи") → these are intent=question  
- Greetings/thanks → these are intent=smalltalk

The test: would this message make sense as a diary entry if you read it back in 6 months? If no (it's a command/question/greeting), don't save it.

IMPORTANT: If the user asks a question AND asks to record/save the answer (e.g. "скільки кофеїну в Monster і запиши мені"), use intent="save_entry" and extract the metrics from your knowledge. The content should be the factual statement (e.g. "Випив Monster Energy 500мл — 160мг кофеїну"). Always extract dashboard_metrics for such entries.

For action intent, also set action_type:
- "delete_entries" → user wants to delete records. Set action_params: { "category": "<category or null>", "period": "<today|week|month|all|null>", "description": "<what to delete>" }
- "create_widget"  → user wants a new dashboard widget. Set action_params: { "metric_key": "<snake_case>", "label": "<label>", "unit": "<unit>", "description": "<what it tracks>" }
- "merge_widgets"  → user wants to combine widgets. Set action_params: { "keys": ["key1","key2"], "new_label": "<merged label>" }
- "update_schedule" → user wants to change auto-report settings. Set action_params: { "daily": <true|false|null>, "weekly": <true|false|null>, "monthly": <true|false|null>, "time": "<HH:MM or null>" } — only include fields the user mentioned
- "none"           → default

Category rules:
Built-in categories (prefer these when they fit):
  thoughts, ideas, feelings, expenses, calories, workout, goals

If the content clearly belongs to a NEW topic not covered by built-ins, create a new snake_case category.
Examples of new categories: dreams, relationships, health, travel, books, music, gratitude, sleep, sex_life, social
Set is_new_category = true and provide a short category_label in the user's language.
For built-in categories, set is_new_category = false.

Metadata rules:
- expenses  → { "amount": <number>, "currency": "<ISO 4217>", "category": "<sub-category>" }
- calories  → { "food_item": "<string>", "estimated_calories": <number> }
- others    → {}

━━━ DASHBOARD METRICS (actual logged values) ━━━
Extract ALL measurable quantities from ACTUAL logs/facts into dashboard_metrics.
Each metric: { "key": "<snake_case>", "label": "<in user's language>", "value": <number>, "unit": "<string>", "icon": "<lucide icon name>", "aggregate": "<sum|avg|last>" }

DECOMPOSITION INTELLIGENCE — always derive ALL secondary metrics from primary inputs:

STEPS → decompose into:
- steps_count (sum), activity_kcal (sum), distance_km (sum), active_min (sum)
- Formula: 10000 steps ≈ 400 kcal burned, ≈ 7.5 km, ≈ 100 active minutes
- Scale linearly: 5000 steps = 200 kcal, 3.75 km, 50 min

WALKING/RUNNING distance → decompose into:
- distance_km (sum), kcal_burned (sum), active_min (sum), steps_count (sum)
- Walking: 1 km ≈ 60 kcal, ≈ 15 min, ≈ 1300 steps
- Running: 1 km ≈ 80 kcal, ≈ 6 min, ≈ 1200 steps

CYCLING → decompose into:
- distance_km (sum), kcal_burned (sum), active_min (sum)
- Moderate cycling: 1 km ≈ 30 kcal, ≈ 4 min

SWIMMING → decompose into:
- distance_m (sum), kcal_burned (sum), active_min (sum)
- 100m swimming ≈ 60 kcal, ≈ 2.5 min

GYM/WORKOUT (time-based) → decompose into:
- active_min (sum), kcal_burned (sum)
- Moderate gym: 60 min ≈ 350 kcal; intense: 60 min ≈ 500 kcal

MEDITATION/YOGA/STRETCHING → decompose into:
- meditation_min (sum), mindfulness_min (sum), kcal_burned (sum)
- Meditation: 10 min ≈ 15 kcal; yoga: 10 min ≈ 30 kcal

SLEEP → decompose into:
- sleep_hours (avg), sleep_quality (avg if mentioned), deep_sleep_hours (avg if mentioned)
- If "woke up tired" → sleep_quality: 4/10; "slept well" → sleep_quality: 8/10

WATER/HYDRATION → decompose into:
- water_ml (sum)
- 1 glass ≈ 250ml, 1 bottle ≈ 500ml, 1 cup ≈ 200ml

READING → decompose into:
- pages_read (sum), reading_min (sum)
- Average: 1 page ≈ 2 min

SCREEN TIME → decompose into:
- screen_time_min (sum)

MOOD/STRESS/ENERGY (subjective) → decompose into:
- mood_score (avg): very bad=2, bad=4, neutral=5, good=7, great=9
- stress_level (avg): very stressed=9, stressed=7, moderate=5, calm=3, relaxed=1
- energy_level (avg): exhausted=2, tired=4, normal=6, energetic=8, very energetic=10

COLD SHOWER/CONTRAST SHOWER → decompose into:
- cold_shower_min (sum), kcal_burned (sum)
- 3 min cold shower ≈ 50 kcal

FASTING → decompose into:
- fasting_hours (last)

ALCOHOL → decompose into:
- alcohol_units (sum): 1 beer=1 unit, 1 glass wine=1.5 units, 1 shot=1 unit
- alcohol_kcal (sum): 1 unit ≈ 70 kcal

SMOKING/VAPING → decompose into:
- cigarettes_count (sum) or vaping_sessions (sum)

SEX → decompose into:
- sex_sessions (sum), kcal_burned (sum), active_min (sum)
- 30 min sex ≈ 100 kcal

NUTRITION INTELLIGENCE — when user mentions food with quantities:
Calculate kcal/protein/carbs/fat automatically. Standard per 100g:
- Chicken breast: 165kcal, 31g prot, 0g carbs, 3.6g fat
- Rice (cooked): 130kcal, 2.7g prot, 28g carbs, 0.3g fat
- Buckwheat (cooked): 92kcal, 3.4g prot, 20g carbs, 0.6g fat
- Egg: 155kcal, 13g prot, 1g carbs, 11g fat
- Salmon: 208kcal, 20g prot, 0g carbs, 13g fat
- Oats: 389kcal, 17g prot, 66g carbs, 7g fat
- Beef: 250kcal, 26g prot, 0g carbs, 17g fat
- Banana: 89kcal, 1.1g prot, 23g carbs, 0.3g fat
For unknown foods, estimate based on similar foods.
Always extract: kcal_intake (sum), protein_g (sum), carbs_g (sum), fat_g (sum)

Aggregate rules:
- sum  → totals (kcal, water, steps, km, pages, reps, sessions)
- avg  → averages (mood, sleep quality, stress, energy)
- last → latest snapshot (weight, streak days, body fat, fasting hours)

ALWAYS extract as many derived metrics as possible — the more data, the better the dashboard.

━━━ GOAL METRICS (targets/intentions) ━━━
When user states a GOAL, INTENTION, or TARGET — extract into goal_metrics (NOT dashboard_metrics).
Each goal: { "key": "<snake_case>", "label": "<in user's language>", "target": <number>, "unit": "<string>", "icon": "<lucide icon name>", "period": "<month|week|day|total>" }

CRITICAL — always extract goals from statements like:
- "хочу займатись сексом з 20 жінками цього місяця" → goal_metrics: [{"key":"sex_partners","label":"Партнерки","target":20,"unit":"осіб","icon":"heart","period":"month"}]
- "хочу пробігти 100км цього місяця" → goal_metrics: [{"key":"distance_km","label":"Дистанція","target":100,"unit":"км","icon":"map-pin","period":"month"}]
- "ціль — схуднути до 75кг" → goal_metrics: [{"key":"weight_kg","label":"Вага (ціль)","target":75,"unit":"кг","icon":"scale","period":"total"}]
- "хочу читати 30 сторінок щодня" → goal_metrics: [{"key":"pages_read","label":"Сторінки","target":30,"unit":"стор.","icon":"book-open","period":"day"}]
- "планую медитувати 20 хвилин щодня" → goal_metrics: [{"key":"meditation_min","label":"Медитація","target":20,"unit":"хв","icon":"wind","period":"day"}]
- "want to drink 2L water daily" → goal_metrics: [{"key":"water_ml","label":"Water","target":2000,"unit":"ml","icon":"droplets","period":"day"}]
- "goal: save 10000 UAH this month" → goal_metrics: [{"key":"savings_uah","label":"Savings","target":10000,"unit":"UAH","icon":"wallet","period":"month"}]

Use category "goals" for pure goal statements. Use the relevant category (workout, health, etc.) if the goal is mixed with a log.

━━━ EXAMPLES ━━━

Input: "Хочу займатись сексом з 20 жінками цього місяця"
Output: {"intent":"save_entry","category":"goals","category_label":"Цілі","is_new_category":false,"content":"Хочу займатись сексом з 20 жінками цього місяця","metadata":{},"dashboard_metrics":[],"goal_metrics":[{"key":"sex_partners","label":"Партнерки","target":20,"unit":"осіб","icon":"heart","period":"month"}],"action_type":"none","action_params":{}}

Input: "Хочу пробігти 100км цього місяця"
Output: {"intent":"save_entry","category":"goals","category_label":"Цілі","is_new_category":false,"content":"Хочу пробігти 100км цього місяця","metadata":{},"dashboard_metrics":[],"goal_metrics":[{"key":"distance_km","label":"Дистанція","target":100,"unit":"км","icon":"map-pin","period":"month"}],"action_type":"none","action_params":{}}

Input: "Пробіг 5км сьогодні"
Output: {"intent":"save_entry","category":"workout","category_label":"Тренування","is_new_category":false,"content":"Пробіг 5км сьогодні","metadata":{},"dashboard_metrics":[{"key":"distance_km","label":"Дистанція","value":5,"unit":"км","icon":"map-pin","aggregate":"sum"},{"key":"kcal_burned","label":"Спалено ккал","value":400,"unit":"ккал","icon":"flame","aggregate":"sum"},{"key":"active_min","label":"Активний час","value":30,"unit":"хв","icon":"timer","aggregate":"sum"},{"key":"steps_count","label":"Кроки","value":6000,"unit":"кр","icon":"footprints","aggregate":"sum"}],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "Пройшов 10000 кроків"
Output: {"intent":"save_entry","category":"workout","category_label":"Тренування","is_new_category":false,"content":"Пройшов 10000 кроків","metadata":{},"dashboard_metrics":[{"key":"steps_count","label":"Кроки","value":10000,"unit":"кр","icon":"footprints","aggregate":"sum"},{"key":"activity_kcal","label":"Активні ккал","value":400,"unit":"ккал","icon":"flame","aggregate":"sum"},{"key":"distance_km","label":"Дистанція","value":7.5,"unit":"км","icon":"map-pin","aggregate":"sum"},{"key":"active_min","label":"Активний час","value":100,"unit":"хв","icon":"timer","aggregate":"sum"}],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "Медитував 10 хвилин"
Output: {"intent":"save_entry","category":"health","category_label":"Здоров'я","is_new_category":false,"content":"Медитував 10 хвилин","metadata":{},"dashboard_metrics":[{"key":"meditation_min","label":"Медитація","value":10,"unit":"хв","icon":"wind","aggregate":"sum"},{"key":"mindfulness_min","label":"Усвідомленість","value":10,"unit":"хв","icon":"brain","aggregate":"sum"},{"key":"kcal_burned","label":"Спалено ккал","value":15,"unit":"ккал","icon":"flame","aggregate":"sum"}],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "Спав 7 годин, прокинувся бадьорим"
Output: {"intent":"save_entry","category":"sleep","category_label":"Сон","is_new_category":true,"content":"Спав 7 годин, прокинувся бадьорим","metadata":{},"dashboard_metrics":[{"key":"sleep_hours","label":"Сон","value":7,"unit":"год","icon":"moon","aggregate":"avg"},{"key":"sleep_quality","label":"Якість сну","value":8,"unit":"/10","icon":"smile","aggregate":"avg"}],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "Випив 3 склянки води"
Output: {"intent":"save_entry","category":"health","category_label":"Здоров'я","is_new_category":false,"content":"Випив 3 склянки води","metadata":{},"dashboard_metrics":[{"key":"water_ml","label":"Вода","value":750,"unit":"мл","icon":"droplets","aggregate":"sum"}],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "Зробив 40 присідань і 20 віджимань"
Output: {"intent":"save_entry","category":"workout","category_label":"Тренування","is_new_category":false,"content":"Зробив 40 присідань і 20 віджимань","metadata":{},"dashboard_metrics":[{"key":"squats_count","label":"Присідання","value":40,"unit":"раз","icon":"dumbbell","aggregate":"sum"},{"key":"pushups_count","label":"Віджимання","value":20,"unit":"раз","icon":"dumbbell","aggregate":"sum"},{"key":"kcal_burned","label":"Спалено ккал","value":80,"unit":"ккал","icon":"flame","aggregate":"sum"},{"key":"active_min","label":"Активний час","value":15,"unit":"хв","icon":"timer","aggregate":"sum"}],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "Погано себе почуваю, стрес на роботі"
Output: {"intent":"converse","category":"feelings","category_label":"Почуття","is_new_category":false,"content":"Погано себе почуваю, стрес на роботі","metadata":{},"dashboard_metrics":[{"key":"mood_score","label":"Настрій","value":3,"unit":"/10","icon":"smile","aggregate":"avg"},{"key":"stress_level","label":"Стрес","value":8,"unit":"/10","icon":"zap","aggregate":"avg"}],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "Читав 30 хвилин перед сном"
Output: {"intent":"save_entry","category":"books","category_label":"Книги","is_new_category":true,"content":"Читав 30 хвилин перед сном","metadata":{},"dashboard_metrics":[{"key":"reading_min","label":"Читання","value":30,"unit":"хв","icon":"book-open","aggregate":"sum"},{"key":"pages_read","label":"Сторінки","value":15,"unit":"стор.","icon":"book-open","aggregate":"sum"}],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "Мені приснився дивний сон про море."
Output: {"intent":"save_entry","category":"dreams","category_label":"Сни","is_new_category":true,"content":"Мені приснився дивний сон про море.","metadata":{},"dashboard_metrics":[],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "Витратив 350 гривень на продукти."
Output: {"intent":"save_entry","category":"expenses","category_label":"Витрати","is_new_category":false,"content":"Витратив 350 гривень на продукти.","metadata":{"amount":350,"currency":"UAH","category":"groceries"},"dashboard_metrics":[],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "Сьогодні з'їв 200г курки та 50г гречки"
Output: {"intent":"save_entry","category":"calories","category_label":"Калорії","is_new_category":false,"content":"Сьогодні з'їв 200г курки та 50г гречки","metadata":{"food_item":"курка + гречка","estimated_calories":376},"dashboard_metrics":[{"key":"kcal_intake","label":"Калорії (їжа)","value":376,"unit":"ккал","icon":"utensils","aggregate":"sum"},{"key":"protein_g","label":"Білки","value":64,"unit":"г","icon":"beef","aggregate":"sum"},{"key":"carbs_g","label":"Вуглеводи","value":10,"unit":"г","icon":"wheat","aggregate":"sum"},{"key":"fat_g","label":"Жири","value":8,"unit":"г","icon":"droplets","aggregate":"sum"}],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "Had a great workout, ran 5km, burned about 450 kcal."
Output: {"intent":"save_entry","category":"workout","category_label":"Workout","is_new_category":false,"content":"Had a great workout, ran 5km, burned about 450 kcal.","metadata":{},"dashboard_metrics":[{"key":"kcal_burned","label":"Kcal Burned","value":450,"unit":"kcal","icon":"flame","aggregate":"sum"},{"key":"distance_km","label":"Distance","value":5,"unit":"km","icon":"map-pin","aggregate":"sum"}],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "Не курю вже 5 днів"
Output: {"intent":"save_entry","category":"health","category_label":"Здоров'я","is_new_category":true,"content":"Не курю вже 5 днів","metadata":{},"dashboard_metrics":[{"key":"no_smoking_days","label":"Без куріння","value":5,"unit":"дн","icon":"wind","aggregate":"last"}],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "дякую"
Output: {"intent":"smalltalk","category":"thoughts","category_label":"Думки","is_new_category":false,"content":"дякую","metadata":{},"dashboard_metrics":[],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "Скільки я витратив цього тижня?"
Output: {"intent":"question","category":"expenses","category_label":"Витрати","is_new_category":false,"content":"Скільки я витратив цього тижня?","metadata":{},"dashboard_metrics":[],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "Скільки кофеїну в Monster 500мл і запиши мені"
Output: {"intent":"save_entry","category":"health","category_label":"Здоров'я","is_new_category":false,"content":"Випив Monster Energy 500мл — 160мг кофеїну","metadata":{},"dashboard_metrics":[{"key":"caffeine_mg","label":"Кофеїн","value":160,"unit":"мг","icon":"zap","aggregate":"sum"}],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "Додай мені в таблицю Кофеїн"
Output: {"intent":"action","category":"health","category_label":"Здоров'я","is_new_category":false,"content":"Додай мені в таблицю Кофеїн","metadata":{},"dashboard_metrics":[],"goal_metrics":[],"action_type":"create_widget","action_params":{"metric_key":"caffeine_mg","label":"Кофеїн","unit":"мг","description":"споживання кофеїну"}}
Output: {"intent":"action","category":"sleep","category_label":"Сон","is_new_category":false,"content":"Видали всі мої записи про сон","metadata":{},"dashboard_metrics":[],"goal_metrics":[],"action_type":"delete_entries","action_params":{"category":"sleep","period":"all","description":"всі записи про сон"}}

Input: "Вмикай тижневий звіт щонеділі о 10:00"
Output: {"intent":"action","category":"thoughts","category_label":"Думки","is_new_category":false,"content":"Вмикай тижневий звіт щонеділі о 10:00","metadata":{},"dashboard_metrics":[],"goal_metrics":[],"action_type":"update_schedule","action_params":{"weekly":true,"time":"10:00"}}

Input: "Вимкни щоденний звіт"
Output: {"intent":"action","category":"thoughts","category_label":"Думки","is_new_category":false,"content":"Вимкни щоденний звіт","metadata":{},"dashboard_metrics":[],"goal_metrics":[],"action_type":"update_schedule","action_params":{"daily":false}}

Input: "Хочу місячний звіт 1-го числа о 9:00"
Output: {"intent":"action","category":"thoughts","category_label":"Думки","is_new_category":false,"content":"Хочу місячний звіт 1-го числа о 9:00","metadata":{},"dashboard_metrics":[],"goal_metrics":[],"action_type":"update_schedule","action_params":{"monthly":true,"time":"09:00"}}

Input: "Налаштуй звіт щодня, вимкни щотижневі і щомісячні і постав на 7 годину"
Output: {"intent":"action","category":"thoughts","category_label":"Думки","is_new_category":false,"content":"Налаштуй звіт щодня, вимкни щотижневі і щомісячні і постав на 7 годину","metadata":{},"dashboard_metrics":[],"goal_metrics":[],"action_type":"update_schedule","action_params":{"daily":true,"weekly":false,"monthly":false,"time":"07:00"}}

Input: "Називай мене Андрій"
Output: {"intent":"save_entry","category":"thoughts","category_label":"Думки","is_new_category":false,"content":"Називай мене Андрій","metadata":{},"dashboard_metrics":[],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "Налаштуй звіт щодня, вимкни щотижневі і щомісячні і постав на 7 годину"
Output: {"intent":"action","category":"thoughts","category_label":"Думки","is_new_category":false,"content":"Налаштуй звіт щодня, вимкни щотижневі і щомісячні і постав на 7 годину","metadata":{},"dashboard_metrics":[],"goal_metrics":[],"action_type":"update_schedule","action_params":{"daily":true,"weekly":false,"monthly":false,"time":"07:00"}}

Input: "Давай перевіримо, покажи налаштування автозвітів"
Output: {"intent":"question","category":"thoughts","category_label":"Думки","is_new_category":false,"content":"Давай перевіримо, покажи налаштування автозвітів","metadata":{},"dashboard_metrics":[],"goal_metrics":[],"action_type":"none","action_params":{}}

Input: "Дякую, зміни годину на 7 ранку"
Output: {"intent":"action","category":"thoughts","category_label":"Думки","is_new_category":false,"content":"Дякую, зміни годину на 7 ранку","metadata":{},"dashboard_metrics":[],"goal_metrics":[],"action_type":"update_schedule","action_params":{"time":"07:00"}}

Respond with ONLY the JSON object.`;

// ── Helpers ───────────────────────────────────────────────────────────────────

const MODEL_ID = "gemini-2.5-flash";

function getModel() {
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {},
  });
}

function parseResponse(text: string): ClassificationResult {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const parsed = JSON.parse(cleaned);

  if (!IntentSchema.safeParse(parsed.intent).success) parsed.intent = "save_entry";
  if (parsed.is_new_category === undefined) parsed.is_new_category = false;
  if (!parsed.category_label) parsed.category_label = parsed.category;
  if (!Array.isArray(parsed.dashboard_metrics)) parsed.dashboard_metrics = [];
  if (!Array.isArray(parsed.goal_metrics)) parsed.goal_metrics = [];
  if (!parsed.action_type) parsed.action_type = "none";
  if (!parsed.action_params) parsed.action_params = {};

  return ClassificationResultSchema.parse(parsed);
}

async function attemptClassify(generateFn: () => Promise<string>): Promise<ClassificationResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return parseResponse(await generateFn());
    } catch (err) {
      lastError = err;
    }
  }
  throw new ClassificationError("Classification failed after 2 attempts", lastError);
}

export async function classify(text: string): Promise<ClassificationResult> {
  return attemptClassify(async () => (await getModel().generateContent(text)).response.text());
}

export async function classifyAudio(audioBytes: Buffer, mimeType: string): Promise<ClassificationResult> {
  return attemptClassify(async () =>
    (await getModel().generateContent([
      { inlineData: { data: audioBytes.toString("base64"), mimeType } },
      "Transcribe and classify this audio diary entry.",
    ])).response.text()
  );
}
