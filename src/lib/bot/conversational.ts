import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../env";
import type { Entry, SimilarEntry } from "../insight";

// ── Constants ─────────────────────────────────────────────────────────────────

const MODEL_ID = "gemini-2.5-flash";
const SIMILARITY_THRESHOLD = 0.75;

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Ти — дотепний, уважний друг, який веде щоденник разом з користувачем.
Відповідай ВИКЛЮЧНО українською мовою.
Будь людяним, теплим і трохи дотепним — як розумний друг, а не бот.
Відповідь має бути 1–4 речення.
Не повторюй запис дослівно.
Якщо є схожі минулі записи — посилайся на конкретні дані з них: суми, продукти, патерни, дати.
Наприклад: "Добре, що стежиш за харчуванням, але цього тижня забагато може енергетиків! Записав 250 ккал від RedBull."`;

// ── Prompt builder ────────────────────────────────────────────────────────────

export function buildConversationalPrompt(
  newEntry: Entry,
  filteredSimilarEntries: SimilarEntry[]
): string {
  const hasSimilar = filteredSimilarEntries.length > 0;

  if (!hasSimilar) {
    return `Новий запис користувача (категорія: ${newEntry.category}):
"${newEntry.content}"

Немає схожих минулих записів. Дай коротке, емпатійне підтвердження без посилань на минуле.`;
  }

  const pastLines = filteredSimilarEntries
    .map((e) => `[${e.created_at}] (${e.category}, схожість: ${(e.similarity * 100).toFixed(0)}%): ${e.content}`)
    .join("\n");

  return `Новий запис користувача (категорія: ${newEntry.category}):
"${newEntry.content}"

Схожі минулі записи:
${pastLines}

Дай дотепну, людяну відповідь, посилаючись на конкретні дані з минулих записів.`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a witty, pattern-aware conversational reply in Ukrainian.
 * Filters similarEntries to those with similarity > 0.75 before building the prompt.
 * When no entries pass the threshold, generates a brief empathetic acknowledgement.
 * Returns null on any error (logs error with entry_id).
 */
export async function generateConversationalReply(
  newEntry: Entry,
  similarEntries: SimilarEntry[]
): Promise<string | null> {
  try {
    const filtered = similarEntries.filter((e) => e.similarity > SIMILARITY_THRESHOLD);

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {},
    });

    const prompt = buildConversationalPrompt(newEntry, filtered);
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    return text || null;
  } catch (err) {
    console.error("[conversational] generateConversationalReply failed", {
      entry_id: newEntry.id,
      error: err,
    });
    return null;
  }
}
