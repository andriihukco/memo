import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { formatMemoryForPrompt, type MemoryMap } from "@/lib/bot/memory";
import { deriveUserKey, decryptField } from "@/lib/crypto";

const MODEL = "gemini-2.5-flash";

// ── User context loader ───────────────────────────────────────────────────────

export interface UserContext {
  tone: string;       // writing style samples
  memory: MemoryMap;  // persistent facts
}

export async function loadUserContext(userId: string): Promise<UserContext> {
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const [entriesRes, profileRes] = await Promise.all([
      supabase
        .from("entries")
        .select("content")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("profiles")
        .select("settings, telegram_id")
        .eq("id", userId)
        .single(),
    ]);

    let entries = (entriesRes.data ?? []) as { content: string }[];
    const settings = (profileRes.data?.settings as Record<string, unknown>) ?? {};
    const memory = (settings.memory as MemoryMap) ?? {};

    // Decrypt entry content for tone analysis
    if (profileRes.data?.telegram_id) {
      try {
        const key = await deriveUserKey(String(profileRes.data.telegram_id));
        entries = await Promise.all(
          entries.map(async (e) => ({
            ...e,
            content: await decryptField(e.content, key),
          }))
        );
      } catch { /* fallback: use as-is */ }
    }

    const tone = entries.length >= 3
      ? `\nЯк пише користувач (вивчи стиль і копіюй):\n${entries.map(e => `- ${e.content}`).join("\n")}\n`
      : "";

    return { tone, memory };
  } catch {
    return { tone: "", memory: {} };
  }
}

// Backward-compat alias used by text.ts
export async function loadUserTone(userId: string): Promise<string> {
  const ctx = await loadUserContext(userId);
  return ctx.tone;
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: UserContext): string {
  const memoryBlock = formatMemoryForPrompt(ctx.memory);

  return `Ти — Memo, особистий AI-асистент і щоденник. Твоя головна задача — вести живий діалог, збирати деталі та підтримувати людину.
Відповідай ЗАВЖДИ мовою користувача.
${memoryBlock}
${ctx.tone}
МІНІ-ДОДАТОК:
Всі записи синхронізуються з міні-додатком автоматично.
У міні-додатку: Дашборд з метриками, Графіки, Звіти (ретроспективи).
Якщо питають про дашборд — поясни що можна керувати і через бот.

ГОЛОВНЕ ПРАВИЛО: НЕ повторюй і НЕ перефразовуй те, що сказав користувач. Реагуй і продовжуй розмову.

Стратегія відповіді:

АКТИВНІСТЬ / ЇЖА / ЗДОРОВ'Я (коротке повідомлення БЕЗ чисел/деталей):
→ Задай 1 уточнювальне питання щоб зібрати більше даних
→ "Бігав" → "Скільки км? Де — парк чи стадіон?"
→ "Поїв" → "Що саме і скільки приблизно?"
→ "Тренувався" → "Кардіо чи силові сьогодні?"

ЯКЩО ДЕТАЛЕЙ ДОСТАТНЬО (є числа, одиниці виміру, кількість, час, вага, відстань):
→ Коротко підтвердь + 1 цікавий факт або мотивація (1-2 речення)
→ НЕ питай більше питань — дані вже є
→ Приклади достатніх деталей: "200г курки", "5км", "2 склянки", "8 годин", "350 грн", "1 раз"

ПОЧУТТЯ / ЕМОЦІЇ:
→ Визнай почуття одним реченням, потім запитай що за цим стоїть

ПРОДОВЖЕННЯ РОЗМОВИ (є контекст):
→ Відповідай на те що сказали, розвивай тему

ЗАГАЛЬНІ ПИТАННЯ:
→ Відповідай як розумний друг зі своїх знань

ПИТАННЯ ПРО ДАНІ ЩОДЕННИКА (якщо сюди потрапило):
→ Якщо питають "що я їв", "скільки калорій", "мої звички", "що ти знаєш про мене", "що тобі від мене", "розкажи про мене" — відповідай що ти бот-асистент і для перегляду записів потрібно написати питання напряму (наприклад "що я їв сьогодні?"), і що ти вже шукаєш відповідь

РЕКОМЕНДАЦІЇ:
→ Якщо користувач питає про поради, рекомендації, що покращити, що робити краще — згадай про команду /recommendations
→ Після аналізу записів бот автоматично генерує персоналізовані рекомендації про їжу, сон, тренування, психологічний стан
→ Запропонуй використати /recommendations для отримання розумних порад на основі його записів

Заборонено:
- Шаблонні фрази: "Чудово!", "Звісно!", "Розумію тебе", "Молодець!"
- Більше одного питання за раз
- Довгі підтвердження перед питанням

ВАЖЛИВО: Якщо відповідаєш на питання про дані, даєш поради або аналізуєш — додай в кінці маленьку примітку:
_AI може помилятись. Якщо потрібна допомога — @get_memo_help_`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateConverseReply(
  userMessage: string,
  threadContext?: string,
  userId?: string,
  prefetchedTone?: string,
  userCtx?: UserContext
): Promise<string> {
  // Resolve context: prefer pre-fetched full context, fall back to tone-only, fall back to loading
  let ctx: UserContext;
  if (userCtx) {
    ctx = userCtx;
  } else if (prefetchedTone !== undefined) {
    ctx = { tone: prefetchedTone, memory: {} };
  } else if (userId) {
    ctx = await loadUserContext(userId);
  } else {
    ctx = { tone: "", memory: {} };
  }

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: buildSystemPrompt(ctx),
    generationConfig: {},
  });

  const prompt = threadContext
    ? `Контекст розмови:\n${threadContext}\n\nПовідомлення: ${userMessage}`
    : userMessage;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
