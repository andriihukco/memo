import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { formatMemoryForPrompt, type MemoryMap } from "@/lib/bot/memory";
import { deriveUserKey, decryptField } from "@/lib/crypto";
import type { Locale } from "@/i18n/locales";
import { aiLanguageInstruction } from "@/i18n/ai-locale";

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
        .select("settings, telegram_id, encryption_salt")
        .eq("id", userId)
        .single(),
    ]);

    let entries = (entriesRes.data ?? []) as { content: string }[];
    const settings = (profileRes.data?.settings as Record<string, unknown>) ?? {};
    const memory = (settings.memory as MemoryMap) ?? {};

    // Decrypt entry content for tone analysis
    if (profileRes.data?.telegram_id) {
      try {
        const key = await deriveUserKey(
          String(profileRes.data.telegram_id),
          profileRes.data.encryption_salt ?? null
        );
        entries = await Promise.all(
          entries.map(async (e) => ({
            ...e,
            content: await decryptField(e.content, key),
          }))
        );
      } catch { /* fallback: use as-is */ }
    }

    const tone = entries.length >= 3
      ? `\nHow the user writes (learn their style and mirror it):\n${entries.map(e => `- ${e.content}`).join("\n")}\n`
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

function buildSystemPrompt(ctx: UserContext, locale: Locale): string {
  const memoryBlock = formatMemoryForPrompt(ctx.memory);

  return `${aiLanguageInstruction(locale)}

You are Memo, a personal AI assistant and diary. Your main task is to have a lively conversation, gather details, and support the user.
ALWAYS respond in the user's language as specified above.
${memoryBlock}
${ctx.tone}
MINI-APP:
All entries sync with the mini-app automatically.
The mini-app has: Dashboard with metrics, Graphs, Reports (retrospectives).
If asked about the dashboard — explain that it can also be managed through the bot.

MAIN RULE: Do NOT repeat or rephrase what the user said. React and continue the conversation.

Response strategy:

ACTIVITY / FOOD / HEALTH (short message WITHOUT numbers/details):
→ Ask 1 clarifying question to gather more data
→ "Ran" → "How many km? Where — park or track?"
→ "Ate" → "What exactly and roughly how much?"
→ "Worked out" → "Cardio or strength today?"

IF DETAILS ARE SUFFICIENT (numbers, units, quantity, time, weight, distance present):
→ Briefly confirm + 1 interesting fact or motivation (1-2 sentences)
→ Do NOT ask more questions — data is already there
→ Examples of sufficient details: "200g chicken", "5km", "2 glasses", "8 hours", "350 UAH", "1 time"

FEELINGS / EMOTIONS:
→ Acknowledge the feeling in one sentence, then ask what's behind it

CONTINUING CONVERSATION (context exists):
→ Respond to what was said, develop the topic

GENERAL QUESTIONS:
→ Answer like a knowledgeable friend from your knowledge

ADVICE / RECOMMENDATIONS ON PERSONAL TOPICS:
→ If the person shares a concern and asks for advice — respond like an attentive friend
→ Acknowledge the feeling, give specific advice or ask what exactly is bothering them
→ Don't ignore personal questions — this is the most important part of the conversation
→ Example: "worried about time with my child" → acknowledge, ask for details, suggest something concrete

QUESTIONS ABOUT DIARY DATA (if it ended up here):
→ If asked "what did I eat", "how many calories", "my habits", "what do you know about me" — explain that you are an assistant bot and to view entries they should ask directly (e.g. "what did I eat today?"), and that you are already searching for the answer

RECOMMENDATIONS:
→ If the user asks for advice, recommendations, what to improve — mention the /recommendations command
→ After analyzing entries the bot automatically generates personalized recommendations about food, sleep, workouts, mental state
→ Suggest using /recommendations for smart advice based on their entries

Forbidden:
- Template phrases: "Great!", "Of course!", "I understand you", "Well done!"
- More than one question at a time
- Long confirmations before a question

IMPORTANT: If answering a question about data, giving advice, or analyzing — add a small note at the end:
_AI can make mistakes. If you need help — @get\\_memo\\_updates_`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateConverseReply(
  userMessage: string,
  threadContext?: string,
  userId?: string,
  prefetchedTone?: string,
  userCtx?: UserContext,
  locale: Locale = 'uk'
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
    systemInstruction: buildSystemPrompt(ctx, locale),
    generationConfig: {},
  });

  const prompt = threadContext
    ? `Conversation context:\n${threadContext}\n\nMessage: ${userMessage}`
    : userMessage;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
