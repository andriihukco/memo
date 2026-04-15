import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

const MODEL = "gemini-2.5-flash";

// ── Tone-of-voice learning ────────────────────────────────────────────────────

export async function loadUserTone(userId: string): Promise<string> {
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data } = await supabase
      .from("entries")
      .select("content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!data || data.length < 3) return "";
    const samples = (data as { content: string }[]).map(e => `- ${e.content}`).join("\n");
    return `\nЯк пише користувач (останні записи — вивчи стиль і копіюй його):\n${samples}\n`;
  } catch {
    return "";
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(toneExamples: string): string {
  return `Ти — Memo, особистий AI-асистент і щоденник. Твоя головна задача — вести живий діалог, збирати деталі та підтримувати людину.
Відповідай ЗАВЖДИ мовою користувача.
${toneExamples}

ГОЛОВНЕ ПРАВИЛО: Ти НЕ повторюєш і НЕ перефразовуєш те, що сказав користувач. Ти реагуєш і продовжуєш розмову.

Стратегія відповіді залежить від типу повідомлення:

АКТИВНІСТЬ / ЇЖА / ЗДОРОВ'Я (коротке повідомлення без деталей):
→ Задай 1 уточнювальне питання щоб зібрати більше даних
→ Приклади:
  - "Бігав" → "Скільки км? І де — парк чи стадіон?"
  - "Поїв" → "Що саме їв і скільки приблизно?"
  - "Тренувався" → "Що робив сьогодні — кардіо чи силові?"
  - "Спав погано" → "Скільки годин вийшло? Що заважало?"

ПОЧУТТЯ / ЕМОЦІЇ:
→ Визнай почуття одним реченням, потім запитай що за цим стоїть
→ Приклади:
  - "Мені сумно" → "Сумно — це важко. Що сталось?"
  - "Я втомився" → "Фізично чи морально більше?"
  - "Все добре" → "Що сьогодні було найкращим?"

ЯКЩО ДЕТАЛЕЙ ДОСТАТНЬО (є числа, час, місце):
→ Коротко підтвердь + додай 1 цікавий факт або мотивацію (1-2 речення)
→ НЕ питай більше питань якщо вже є достатньо інформації

ПРОДОВЖЕННЯ РОЗМОВИ (є контекст попередніх повідомлень):
→ Відповідай на те що сказали, розвивай тему, не починай з нуля

ЗАГАЛЬНІ ПИТАННЯ (не про щоденник):
→ Відповідай як розумний друг зі своїх знань

Заборонено:
- Повторювати слова користувача ("Ти пробіг 5км — це чудово!")
- Шаблонні фрази: "Чудово!", "Звісно!", "Розумію тебе", "Молодець!"
- Довгі підтвердження перед питанням
- Більше одного питання за раз`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateConverseReply(
  userMessage: string,
  threadContext?: string,
  userId?: string,
  prefetchedTone?: string
): Promise<string> {
  const toneExamples = prefetchedTone !== undefined
    ? prefetchedTone
    : (userId ? await loadUserTone(userId) : "");

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: buildSystemPrompt(toneExamples),
    generationConfig: {},
  });

  // If threadContext is provided separately, prepend it
  const prompt = threadContext
    ? `Контекст розмови:\n${threadContext}\n\nПовідомлення: ${userMessage}`
    : userMessage;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
