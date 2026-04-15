import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

const MODEL = "gemini-2.5-flash";

// ── Tone-of-voice learning ────────────────────────────────────────────────────

async function loadUserTone(userId: string): Promise<string> {
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
  return `Ти — Memo, особистий AI-асистент без обмежень. Ти вмієш все: вести щоденник, рахувати калорії/макроси, трекати витрати, тренування, сон, стріки, створювати нагадування та завдання, відповідати на будь-які питання зі своїх знань.
Відповідай ЗАВЖДИ мовою користувача.
${toneExamples}
Правила відповіді:
- Лаконічно, але без штучних обмежень по довжині — якщо питання потребує розгорнутої відповіді, дай її
- Копіюй tone of voice користувача — якщо він пише коротко і неформально, ти теж
- Для записів про активність/їжу/здоров'я: підтверди + додай 1 корисний контекст або мотивацію
- Для почуттів/переживань: визнай, не давай порад без запиту
- Для загальних питань (не про щоденник): відповідай як розумний асистент зі своїх знань
- Ніяких шаблонних фраз типу "Чудово!", "Звісно!", "Розумію тебе"
- НІКОЛИ не кажи що не вмієш щось зробити — завжди намагайся допомогти`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateConverseReply(
  userMessage: string,
  threadContext?: string,
  userId?: string
): Promise<string> {
  const toneExamples = userId ? await loadUserTone(userId) : "";

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: buildSystemPrompt(toneExamples),
    generationConfig: {},
  });

  const prompt = threadContext
    ? `Контекст розмови:\n${threadContext}\n\nПовідомлення: ${userMessage}`
    : userMessage;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
