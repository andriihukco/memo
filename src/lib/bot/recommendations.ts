import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

const MODEL = "gemini-2.5-flash";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Recommendation {
  type: "nutrition" | "alcohol" | "sleep" | "workout" | "mental_health" | "productivity" | "general";
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  action: string;
  positive?: boolean;
}

export interface RecommendationContext {
  entries: Array<{
    content: string;
    category: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  periodLabel: string;
}

// ── Supabase ──────────────────────────────────────────────────────────────────

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ── Load recent entries ───────────────────────────────────────────────────────

async function loadRecentEntries(userId: string, days: number = 7) {
  const supabase = getServiceClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data } = await supabase
    .from("entries")
    .select("content, category, metadata, created_at")
    .eq("user_id", userId)
    .gte("created_at", cutoff.toISOString())
    .order("created_at", { ascending: false });

  return (data ?? []) as Array<{
    content: string;
    category: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
}

// ── Generate recommendations ──────────────────────────────────────────────────

const RECOMMENDATION_SYSTEM_PROMPT = `Ти — експерт з персонального здоров'я, дієтолог і коуч з глибокими знаннями про нутрієнти.
Твоє завдання — проаналізувати записи щоденника користувача і згенерувати конкретні, практичні, персоналізовані рекомендації.

ДЕТАЛЬНИЙ АНАЛІЗ:

1. ХАРЧУВАННЯ & КАЛОРІЇ:
   - Аналізуй калорійність, білки, жири, вуглеводи
   - Шукай дефіцити: недостатньо білка, овочів, клітковини, води
   - Шукай надлишки: занадто цукру, смаженого, обробленої їжі
   - Визнач дефіцити мікронутрієнтів: залізо, вітамін B, кальцій, магній, цинк
   - Рекомендуй конкретні продукти для補充 дефіцитів
   - Якщо користувач їсть добре — підтверди це (positive: true)

2. АЛКОГОЛЬ:
   - Підраховуй частоту і кількість
   - Шукай кореляцію з настроєм, сном, енергією
   - Якщо часто — рекомендуй перерви або зменшення
   - Якщо рідко — підтверди це як позитив

3. СОН:
   - Аналізуй тривалість (норма 7-9 годин)
   - Оцінюй якість (якщо згадується)
   - Рекомендуй гігієну сну, режим, час

4. ТРЕНУВАННЯ:
   - Оцінюй регулярність, інтенсивність, різноманітність
   - Рекомендуй баланс кардіо і силових
   - Якщо активний — підтверди це

5. ПСИХОЛОГІЧНИЙ СТАН:
   - Шукай ознаки стресу, тривожності, депресії
   - Рекомендуй техніки релаксації, медитацію, прогулянки
   - Якщо позитивний настрій — підтверди це

6. ПРОДУКТИВНІСТЬ:
   - Оцінюй баланс роботи і відпочинку
   - Рекомендуй перерви, делегування, пріоритизацію

ТИПИ РЕКОМЕНДАЦІЙ:
- nutrition: поради щодо їжі, нутрієнтів, гідратації
- alcohol: поради щодо алкоголю
- sleep: поради щодо сну
- workout: поради щодо активності
- mental_health: поради щодо психічного здоров'я
- productivity: поради щодо роботи/навчання
- general: загальні поради

ФОРМАТ ВИХОДУ — JSON масив:
[
  {
    "type": "nutrition|alcohol|sleep|workout|mental_health|productivity|general",
    "severity": "low|medium|high",
    "title": "коротка назва проблеми або позитиву",
    "description": "детальний аналіз на основі конкретних даних з записів (цифри, факти)",
    "action": "конкретна, виконувана дія (не загальна порада)",
    "positive": true/false
  }
]

ПРАВИЛА:
- МАКСИМУМ 5 рекомендацій
- Якщо немає даних — порожній масив []
- ОБОВ'ЯЗКОВО посилайся на конкретні дані з записів (цифри, продукти, дати)
- Якщо щось робиться добре — підтверди це (positive: true, severity: "low")
- Якщо є проблема — вкажи severity (high для критичних, medium для середніх, low для мелких)
- Рекомендації мають бути КОНКРЕТНИМИ, не загальними
- Приклади конкретних дій:
  * Замість "пий більше води" → "Додай 2 склянки води після кожного прийому їжі"
  * Замість "їж більше білка" → "Додай яйця на сніданок (30г білка) або курку на обід"
  * Замість "менше алкоголю" → "Замість щоденного пива, залишай алкоголь на вихідні"
  * Замість "спи більше" → "Ляжи на 30 хв раніше (з 23:30 на 23:00)"
- Використовуй мову записів користувача (українська)
- Якщо користувач веган/вегетаріанець — рекомендуй відповідні продукти`;

export async function generateRecommendations(userId: string, days: number = 7): Promise<Recommendation[]> {
  const entries = await loadRecentEntries(userId, days);

  if (entries.length === 0) return [];

  const context: RecommendationContext = {
    entries: entries.slice(0, 50), // Limit to last 50 entries
    periodLabel: `останні ${days} днів`,
  };

  const entriesText = context.entries.map((e) => {
    const date = new Date(e.created_at).toLocaleDateString("uk-UA", { day: "numeric", month: "short", weekday: "short" });
    const metrics = e.metadata?.dashboard_metrics as Array<{ label: string; value: number; unit: string }> | undefined;
    const metricsStr = Array.isArray(metrics) && metrics.length > 0
      ? ` [${metrics.map((m) => `${m.label}: ${m.value}${m.unit}`).join(", ")}]`
      : "";
    return `[${date}] (${e.category}) ${e.content}${metricsStr}`;
  }).join("\n");

  const prompt = `Проаналізуй записи щоденника за ${context.periodLabel} і згенеруй 3-5 конкретних, персоналізованих рекомендацій на основі ФАКТИЧНИХ ДАНИХ:

${entriesText}

ВАЖЛИВО:
- Посилайся на конкретні цифри і дати з записів
- Якщо користувач їсть мало білка — рекомендуй конкретні продукти
- Якщо мало води — рекомендуй конкретну кількість
- Якщо мало сну — рекомендуй конкретний час
- Якщо часто алкоголь — рекомендуй конкретні дні для перерви
- Якщо добре — підтверди це з позитивом

Відповідь — ТІЛЬКИ JSON масив, без додаткового тексту.`;

  try {
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: RECOMMENDATION_SYSTEM_PROMPT,
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim()
      .replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // If parsing fails, try to extract JSON from text
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        console.error("[recommendations] Failed to parse JSON:", text.slice(0, 200));
        return [];
      }
    }

    if (!Array.isArray(parsed)) return [];

    // Validate and filter recommendations
    return parsed.filter((rec): rec is Recommendation => {
      return (
        typeof rec === "object" &&
        rec !== null &&
        typeof rec.type === "string" &&
        typeof rec.severity === "string" &&
        typeof rec.title === "string" &&
        typeof rec.description === "string" &&
        typeof rec.action === "string"
      );
    });
  } catch (err) {
    console.error("[recommendations] generation failed:", err);
    return [];
  }
}

// ── Format recommendations for display ────────────���───────────────────────────

export function formatRecommendationsForTelegram(recommendations: Recommendation[]): string {
  if (recommendations.length === 0) {
    return "За останній період немає конкретних рекомендацій. Продовжуй вести щоденник — я з'ясую, як можу допомогти!";
  }

  let result = "💡 *РЕКОМЕНДАЦІЇ НА БАЗІ ТВОЇХ ЗАПИСІВ*\n\n";

  for (const rec of recommendations) {
    const severityIcon = rec.severity === "high" ? "⚠️" : rec.severity === "medium" ? "🟡" : "🟢";
    const positiveIcon = rec.positive ? "✨" : "";
    const typeEmoji = {
      nutrition: "🥗",
      alcohol: "🍷",
      sleep: "🌙",
      workout: "💪",
      mental_health: "🧠",
      productivity: "🚀",
      general: "💡",
    }[rec.type] || "💡";

    result += `${positiveIcon}${severityIcon} ${typeEmoji} *${rec.title}*\n`;
    result += `${rec.description}\n`;
    result += `→ ${rec.action}\n\n`;
  }

  return result;
}

// ── Get recommendations for user ──────────────────────────────────────────────

export async function getRecommendationsForUser(userId: string): Promise<string> {
  const recommendations = await generateRecommendations(userId, 7);
  return formatRecommendationsForTelegram(recommendations);
}
