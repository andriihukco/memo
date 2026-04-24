/**
 * User memory system — stores and retrieves persistent facts about the user.
 *
 * Facts are stored in profiles.settings.memory as a flat key→value map.
 * The bot extracts facts from messages (name, preferences, rules, units)
 * and injects them into every reply as a compact context block.
 *
 * Examples of stored facts:
 *   name: "Андрій"
 *   glass_ml: "300"
 *   workout_default: "20 хв і 150 ккал"
 *   diet: "веган"
 *   wake_time: "07:00"
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/lib/env";

const MODEL = "gemini-2.5-flash";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MemoryMap = Record<string, string>;

// ── Supabase ──────────────────────────────────────────────────────────────────

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ── Load memory ───────────────────────────────────────────────────────────────

export async function loadMemory(userId: string): Promise<MemoryMap> {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single();
    return ((data?.settings as Record<string, unknown>)?.memory as MemoryMap) ?? {};
  } catch {
    return {};
  }
}

// ── Save memory ───────────────────────────────────────────────────────────────

export async function saveMemory(userId: string, updates: MemoryMap): Promise<void> {
  try {
    const supabase = getServiceClient();
    // Use RPC for atomic jsonb_set to avoid read-modify-write race condition (bug 1.13)
    // Falls back to merge if RPC not available
    const { error } = await supabase.rpc("merge_memory", {
      p_user_id: userId,
      p_updates: updates,
    });
    if (error) {
      // Fallback: read-modify-write (non-atomic but better than nothing)
      console.warn("[memory] merge_memory RPC failed, using fallback:", error.message);
      const { data } = await supabase
        .from("profiles")
        .select("settings")
        .eq("id", userId)
        .single();
      const current = (data?.settings as Record<string, unknown>) ?? {};
      const currentMemory = (current.memory as MemoryMap) ?? {};
      await supabase.from("profiles").update({
        settings: { ...current, memory: { ...currentMemory, ...updates } },
      }).eq("id", userId);
    }
  } catch (err) {
    console.error("[memory] saveMemory failed:", err);
  }
}

// ── Extract facts from a message ──────────────────────────────────────────────

/**
 * Scan a user message for persistent facts worth remembering.
 * Returns a partial MemoryMap with only the newly found facts.
 * Returns {} if nothing extractable.
 *
 * Runs asynchronously after the main reply — never blocks UX.
 */
export async function extractFacts(text: string): Promise<MemoryMap> {
  const prompt = `You are a memory extractor for a personal diary bot.
Scan the user message for persistent personal facts worth remembering long-term.

Extract ONLY facts that are:
- Personal identity: name, nickname, age, city
- Persistent preferences: diet (vegan, keto, etc.), language preference
- Custom units/rules: "my glass = 300ml", "when I say workout = 30min 200kcal"
- Goals/targets: weight goal, daily step target
- Lifestyle facts: wake time, sleep schedule, job type

Return ONLY a JSON object with snake_case keys and string values.
Return {} if nothing worth remembering.

Examples:
"Називай мене Андрій" → {"name": "Андрій"}
"Мій стакан = 300мл" → {"glass_ml": "300"}
"Я веган" → {"diet": "веган"}
"Коли кажу зарядка — це 20 хв і 150 ккал" → {"workout_default": "20 хв, 150 ккал"}
"Прокидаюсь о 6:30" → {"wake_time": "06:30"}
"Хочу важити 75кг" → {"weight_goal_kg": "75"}
"Живу в Києві" → {"city": "Київ"}

Message: "${text.replace(/"/g, "'")}"`;

  try {
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    const raw = result.response.text().replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || Array.isArray(parsed)) return {};
    // Only keep string values
    const facts: MemoryMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.trim()) facts[k] = v.trim();
    }
    return facts;
  } catch {
    return {};
  }
}

// ── Format memory for prompt injection ───────────────────────────────────────

/**
 * Render the memory map as a compact context block for system prompts.
 * Returns empty string if memory is empty.
 */
export function formatMemoryForPrompt(memory: MemoryMap): string {
  const entries = Object.entries(memory);
  if (entries.length === 0) return "";

  const lines = entries.map(([k, v]) => {
    const label = k.replace(/_/g, " ");
    return `• ${label}: ${v}`;
  }).join("\n");

  return `\nЩО Я ПАМ'ЯТАЮ ПРО ТЕБЕ:\n${lines}\n`;
}
