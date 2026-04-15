import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CustomRule {
  id: string;           // short uuid
  instruction: string;  // the rule in natural language
  example_input?: string;
  example_output?: string;
  created_at: string;
}

// ── Supabase ──────────────────────────────────────────────────────────────────

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ── Load user rules ───────────────────────────────────────────────────────────

export async function loadUserRules(userId: string): Promise<CustomRule[]> {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single();
    return (data?.settings?.custom_rules as CustomRule[]) ?? [];
  } catch {
    return [];
  }
}

// ── Save a new rule ───────────────────────────────────────────────────────────

export async function saveUserRule(userId: string, rule: Omit<CustomRule, "id" | "created_at">): Promise<CustomRule> {
  const supabase = getServiceClient();
  const newRule: CustomRule = {
    id: crypto.randomUUID().slice(0, 8),
    ...rule,
    created_at: new Date().toISOString(),
  };

  const { data } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", userId)
    .single();

  const existing = (data?.settings?.custom_rules as CustomRule[]) ?? [];
  const updated = [...existing, newRule];

  await supabase
    .from("profiles")
    .update({ settings: { ...(data?.settings ?? {}), custom_rules: updated } })
    .eq("id", userId);

  return newRule;
}

// ── Delete a rule ─────────────────────────────────────────────────────────────

export async function deleteUserRule(userId: string, ruleId: string): Promise<void> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", userId)
    .single();

  const existing = (data?.settings?.custom_rules as CustomRule[]) ?? [];
  const updated = existing.filter(r => r.id !== ruleId);

  await supabase
    .from("profiles")
    .update({ settings: { ...(data?.settings ?? {}), custom_rules: updated } })
    .eq("id", userId);
}

// ── Extract rule from user message ────────────────────────────────────────────

const EXTRACT_MODEL = "gemini-2.5-flash";

export async function extractRuleFromMessage(message: string): Promise<Omit<CustomRule, "id" | "created_at"> | null> {
  try {
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: EXTRACT_MODEL,
      generationConfig: {},
    });

    const prompt = `The user wants to teach the AI assistant a custom rule or instruction.
Extract the rule as a clear, actionable instruction for the AI classifier.

User message: "${message}"

Return JSON: { "instruction": "<clear rule for the AI>", "example_input": "<optional example>", "example_output": "<optional expected behavior>" }
If this is not a teaching/instruction message, return: null

Examples:
"коли я кажу 'зробив зарядку', рахуй це як 15 хвилин тренування і 100 ккал" 
→ {"instruction":"When user says 'зробив зарядку' without specifying duration, assume 15 minutes workout and 100 kcal burned","example_input":"зробив зарядку","example_output":"workout entry with active_min:15, kcal_burned:100"}

"мій стакан = 300мл, не 250"
→ {"instruction":"When user mentions 'стакан' (glass) of water, use 300ml instead of the default 250ml","example_input":"випив стакан води","example_output":"water_ml:300"}

"я веган, не пропонуй мені м'ясо"
→ {"instruction":"User is vegan. Never suggest meat-based foods. When calculating nutrition, assume plant-based alternatives","example_input":"","example_output":""}

Return ONLY the JSON or null.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    if (text === "null" || text === "") return null;
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ── Format rules for injection into classifier prompt ─────────────────────────

export function formatRulesForPrompt(rules: CustomRule[]): string {
  if (rules.length === 0) return "";
  const lines = rules.map((r, i) =>
    `${i + 1}. ${r.instruction}${r.example_input ? ` (e.g. "${r.example_input}" → ${r.example_output})` : ""}`
  );
  return `\n\n━━━ USER CUSTOM RULES (highest priority — always follow these) ━━━\n${lines.join("\n")}\n`;
}
