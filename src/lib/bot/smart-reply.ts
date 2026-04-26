import type { EntryPayload, DashboardMetric } from "@/lib/classifier";
import { generateConverseReply, type UserContext } from "@/lib/bot/converse";

// ── Primary metric keys ───────────────────────────────────────────────────────

export const PRIMARY_METRIC_KEYS = new Set([
  "kcal_intake",
  "protein_g",
  "distance_km",
  "sleep_hours",
  "expense_amount",
  "mood_score",
  "weight_kg",
  "alcohol_units",
  "caffeine_mg",
  "active_min",
]);

// ── Interfaces ────────────────────────────────────────────────────────────────

/** Options passed to the main entry point */
export interface SmartReplyOptions {
  /** All EntryPayloads that were successfully persisted in this batch */
  entries: EntryPayload[];
  /** The original user message text (used for language detection and tone matching) */
  userMessage: string;
  /** Pre-fetched user context — no additional DB calls will be made */
  userCtx: UserContext;
  /** Optional thread context string already loaded by the calling handler */
  threadCtx?: string;
  /** Classification intent — affects Conversational_Wrap placement for "converse" */
  intent: "save_entry" | "converse";
}

/** Result returned by generateSmartReply */
export interface SmartReplyResult {
  /** The complete reply text, ready to pass to sanitizeMarkdown() then ctx.reply() */
  text: string;
  /** True if the reply was produced by the AI; false if it used the deterministic fallback */
  usedFallback: boolean;
}

// ── Approximate marker detection ─────────────────────────────────────────────

const APPROXIMATE_MARKERS = /десь|приблизно|~|≈/i;

function isApproximate(content: string): boolean {
  return APPROXIMATE_MARKERS.test(content);
}

// ── orderMetrics ──────────────────────────────────────────────────────────────

/**
 * Orders a metric array by user-relevance: primary metrics first, then secondary.
 * Primary keys: kcal_intake, protein_g, distance_km, sleep_hours, expense_amount,
 *               mood_score, weight_kg, alcohol_units, caffeine_mg, active_min.
 * All other keys are secondary and appear after primary keys in their original order.
 * Pure function — does not mutate the input array.
 */
export function orderMetrics(metrics: DashboardMetric[]): DashboardMetric[] {
  const primary: DashboardMetric[] = [];
  const secondary: DashboardMetric[] = [];

  for (const metric of metrics) {
    if (PRIMARY_METRIC_KEYS.has(metric.key)) {
      primary.push(metric);
    } else {
      secondary.push(metric);
    }
  }

  return [...primary, ...secondary];
}

// ── buildFallbackReply ────────────────────────────────────────────────────────

/**
 * Deterministic fallback reply when AI generation fails.
 * Requires no AI call. Uses only data from the EntryPayload array.
 * Pure function — no side effects.
 *
 * - Empty entries → "✓"
 * - Entry with metrics → "<category_label>: <primary_metric_label> <value> <unit> ✓"
 *   (uses the first primary metric from orderMetrics())
 * - Entry without metrics → "<category_label>: <content truncated to 60 chars> ✓"
 * - Multiple entries → joined with "\n"
 */
export function buildFallbackReply(entries: EntryPayload[]): string {
  if (entries.length === 0) return "✓";

  const lines = entries.map((entry) => {
    const metrics = entry.dashboard_metrics;

    if (metrics && metrics.length > 0) {
      const ordered = orderMetrics(metrics);
      const primary = ordered[0];
      const label = primary.label || primary.key;
      const displayValue = String(parseFloat(primary.value.toFixed(1)));
      const metricPart = primary.unit
        ? `${label} ${displayValue} ${primary.unit}`
        : `${label} ${displayValue}`;
      return `${entry.category_label}: ${metricPart} ✓`;
    }

    const truncated = entry.content.length > 60
      ? entry.content.slice(0, 60)
      : entry.content;
    return `${entry.category_label}: ${truncated} ✓`;
  });

  return lines.join("\n");
}

// ── buildSmartReplyPrompt ─────────────────────────────────────────────────────

/**
 * Builds the structured prompt string passed to generateConverseReply().
 * Incorporates thread context, user message, intent, and all Log_Summary blocks.
 * Pure function — no side effects.
 *
 * Prompt structure (in order):
 * 1. If threadCtx present: "Контекст розмови:\n<threadCtx>\n\n"
 * 2. "Повідомлення користувача: <userMessage>\n\n"
 * 3. "[ЗБЕРЕЖЕНО В ЩОДЕННИК]\n" + one block per entry
 * 4. "ІНСТРУКЦІЇ ДЛЯ ВІДПОВІДІ:\n" + instruction bullets
 */
export function buildSmartReplyPrompt(options: SmartReplyOptions): string {
  const { entries, userMessage, intent, threadCtx } = options;

  let prompt = "";

  // 1. Thread context (optional)
  if (threadCtx) {
    prompt += `Контекст розмови:\n${threadCtx}\n\n`;
  }

  // 2. User message
  prompt += `Повідомлення користувача: ${userMessage}\n\n`;

  // 3. Saved entries block
  prompt += `[ЗБЕРЕЖЕНО В ЩОДЕННИК]\n`;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const summary = buildLogSummary(entry);
    if (summary) {
      prompt += `Категорія: ${entry.category_label}\n${summary}\n`;
    } else {
      prompt += `Категорія: ${entry.category_label}\n`;
    }
    // Separate entry blocks with a blank line (except after the last one)
    if (i < entries.length - 1) {
      prompt += "\n";
    }
  }

  // 4. Instructions
  prompt += `\nІНСТРУКЦІЇ ДЛЯ ВІДПОВІДІ:\n`;
  prompt += `- Відповідай мовою користувача\n`;

  if (intent === "converse") {
    prompt += `- Спочатку визнай емоційний стан, потім підтверди що записав\n`;
  } else if (intent === "save_entry") {
    prompt += `- Підтверди що записав, назви конкретні цифри\n`;
  }

  if (entries.length > 1) {
    prompt += `- Один абзац що охоплює всі записи (до 300 символів прози)\n`;
  }

  prompt += `- НЕ починай з "Записано", "Збережено", "Entry saved" або аналогів\n`;
  prompt += `- НЕ більше одного питання\n`;

  const hasMetrics = entries.some(
    (e) => e.dashboard_metrics && e.dashboard_metrics.length > 0
  );
  if (hasMetrics) {
    prompt += `- Обов'язково згадай хоча б одну конкретну цифру\n`;
  }

  prompt += `- Після прози додай Log_Summary блок(и) нижче\n`;

  return prompt;
}

// ── buildLogSummary ───────────────────────────────────────────────────────────

/**
 * Builds the Log_Summary block for a single EntryPayload.
 * Returns an empty string when dashboard_metrics is empty.
 * Pure function — no side effects, no AI calls.
 *
 * Format: `<label>: <value> <unit>` per line (no trailing space when unit is empty).
 * Skips metrics where value is NaN or Infinity.
 * Falls back to `key` when `label` is empty.
 * Rounds float values to 1 decimal place.
 * Appends ` (~)` to every line when entry.content contains approximate markers.
 */
export function buildLogSummary(entry: EntryPayload): string {
  const metrics = entry.dashboard_metrics;
  if (!metrics || metrics.length === 0) return "";

  const approx = isApproximate(entry.content);
  const ordered = orderMetrics(metrics);
  const lines: string[] = [];

  for (const metric of ordered) {
    const { value, unit } = metric;

    // Skip invalid values
    if (!isFinite(value) || isNaN(value)) continue;

    const label = metric.label || metric.key;

    // Round floats to 1 decimal place, avoiding trailing zeros (e.g. 5.0 → "5")
    const displayValue = String(parseFloat(value.toFixed(1)));

    const line = unit ? `${label}: ${displayValue} ${unit}` : `${label}: ${displayValue}`;
    lines.push(approx ? `${line} (~)` : line);
  }

  return lines.join("\n");
}

// ── generateSmartReply ────────────────────────────────────────────────────────

/**
 * Primary entry point. Generates a unified bot reply for one or more saved entries.
 * Never throws — falls back to buildFallbackReply() on AI failure.
 */
export async function generateSmartReply(
  options: SmartReplyOptions
): Promise<SmartReplyResult> {
  const prompt = buildSmartReplyPrompt(options);

  try {
    const aiText = await generateConverseReply(
      prompt,
      undefined,
      undefined,
      undefined,
      options.userCtx
    );
    return { text: aiText, usedFallback: false };
  } catch (err) {
    console.error("[smart-reply] AI generation failed", {
      category: options.entries[0]?.category,
      error: (err as Error).message,
    });
    const fallbackText = buildFallbackReply(options.entries);
    return { text: fallbackText, usedFallback: true };
  }
}
