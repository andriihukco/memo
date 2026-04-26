# Design Document — Smart Bot Reply

## Overview

The Smart Bot Reply feature introduces a dedicated `src/lib/bot/smart-reply.ts` module that replaces the ad-hoc `replyPrompt` construction currently scattered across `text.ts` and `voice.ts`. The module produces a single, unified Telegram message after an entry is saved: a warm, human-sounding **Conversational_Wrap** followed by a compact **Log_Summary** that lists every recorded metric. Users no longer need to send a follow-up message to verify their entry was captured.

### Problem Statement

Currently, `text.ts` builds a `replyPrompt` string by appending a `[ЗБЕРЕЖЕНО В ЩОДЕННИК: ...]` block to the user message and passing it to `generateConverseReply()`. This approach has several weaknesses:

- The prompt injection is duplicated between `text.ts` and `voice.ts` (with `voice.ts` not even injecting the saved summary at all).
- The Log_Summary format is inconsistent — metric ordering, units, and the presence/absence of a summary block vary by entry type.
- There is no structured fallback when AI generation fails; the current fallback is the bare string `"Записав! ✓"`.
- Multi-entry messages produce a single summary string that may omit individual entry details.

### Solution

A standalone `generateSmartReply()` function accepts the full array of saved `EntryPayload` objects, the original user message, the pre-fetched `UserContext`, and an optional thread context string. It constructs a structured prompt for `generateConverseReply()` and, if AI generation fails, falls back to a deterministic `buildFallbackReply()` that requires no AI call.

---

## Architecture

### Data Flow

```
User message (text or voice)
        │
        ▼
  classify() / classifyAudio()
        │
        ▼
  EntryPayload[]  ←── ClassificationResult.entries
        │
        ├── [text.ts / voice.ts]
        │   Save entries to DB (existing logic, unchanged)
        │   Derive savedIds[], resolvedThreadId, threadCtx
        │
        ▼
  generateSmartReply(entries, userMessage, userCtx, threadCtx?)
        │
        ├── buildLogSummary(entries)          ← pure, deterministic
        │       │
        │       └── orderMetrics(metrics)     ← pure, deterministic
        │
        ├── buildSmartReplyPrompt(...)         ← pure, deterministic
        │
        ├── generateConverseReply(prompt, ...) ← AI call (converse.ts)
        │       │
        │       └── [on failure] buildFallbackReply(entries) ← pure, no AI
        │
        └── string  ←── final reply text
                │
                ▼
        sanitizeMarkdown(reply)
                │
                ▼
        ctx.reply(...)  ←── single Telegram message
```

### Module Boundaries

| Module | Responsibility | Changes |
|--------|---------------|---------|
| `src/lib/bot/smart-reply.ts` | **NEW** — unified reply generation | Created |
| `src/lib/bot/handlers/text.ts` | Entry save logic, thread resolution | Replace `replyPrompt` block with `generateSmartReply()` call |
| `src/lib/bot/handlers/voice.ts` | Entry save logic, thread resolution | Replace bare `generateConverseReply()` call with `generateSmartReply()` call |
| `src/lib/bot/converse.ts` | AI generation backend | Unchanged |
| `src/lib/classifier.ts` | Classification + metric extraction | Unchanged |

---

## Components and Interfaces

### TypeScript Interfaces

```typescript
// src/lib/bot/smart-reply.ts

import type { EntryPayload, DashboardMetric } from "@/lib/classifier";
import type { UserContext } from "@/lib/bot/converse";

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
```

### Exported Functions

```typescript
/**
 * Primary entry point. Generates a unified bot reply for one or more saved entries.
 * Never throws — falls back to buildFallbackReply() on AI failure.
 */
export async function generateSmartReply(
  options: SmartReplyOptions
): Promise<SmartReplyResult>

/**
 * Builds the structured Log_Summary block for a single EntryPayload.
 * Returns an empty string when dashboard_metrics is empty.
 * Pure function — no side effects, no AI calls.
 */
export function buildLogSummary(entry: EntryPayload): string

/**
 * Orders a metric array by user-relevance: primary metrics first, then secondary.
 * Primary keys: kcal_intake, protein_g, distance_km, sleep_hours, expense_amount,
 *               mood_score, weight_kg, alcohol_units, caffeine_mg, active_min.
 * All other keys are secondary and appear after primary keys in their original order.
 * Pure function.
 */
export function orderMetrics(metrics: DashboardMetric[]): DashboardMetric[]

/**
 * Builds the structured prompt string passed to generateConverseReply().
 * Incorporates thread context, user message, intent, and all Log_Summary blocks.
 * Pure function.
 */
export function buildSmartReplyPrompt(options: SmartReplyOptions): string

/**
 * Deterministic fallback reply when AI generation fails.
 * Requires no AI call. Uses only data from the EntryPayload array.
 * Pure function.
 */
export function buildFallbackReply(entries: EntryPayload[]): string
```

---

## Data Models

### Metric Priority Order

The `orderMetrics()` function uses a static priority map. Metrics whose `key` appears in the primary list are sorted to the front; all others retain their relative order after the primary group.

```typescript
const PRIMARY_METRIC_KEYS = new Set([
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
```

### Log_Summary Format

Each metric line follows the pattern: `<label>: <value> <unit>`

For a single entry with metrics:
```
Калорії: 525 ккал
Білок: 68 г
Вуглеводи: 42 г
Жири: 12 г
```

For a multi-entry message, each entry's block is separated by a blank line:
```
Калорії: 525 ккал
Білок: 68 г

Дистанція: 5 км
Спалено: 400 ккал
Час: 30 хв
```

When a value is estimated (the `content` field contains words like "десь", "приблизно", "~", "≈"), the metric line appends `(~)`:
```
Калорії: 150 ккал (~)
```

### Prompt Structure

The prompt passed to `generateConverseReply()` follows this template:

```
[Thread context if present]
Контекст розмови:
<threadCtx>

Повідомлення користувача: <userMessage>

[ЗБЕРЕЖЕНО В ЩОДЕННИК]
<For each entry:>
Категорія: <category_label>
<Log_Summary block>

ІНСТРУКЦІЇ ДЛЯ ВІДПОВІДІ:
- Відповідай мовою користувача
- [If intent === "converse"] Спочатку визнай емоційний стан, потім підтверди що записав
- [If intent === "save_entry"] Підтверди що записав, назви конкретні цифри
- [If multi-entry] Один абзац що охоплює всі записи (до 300 символів прози)
- НЕ починай з "Записано", "Збережено", "Entry saved" або аналогів
- НЕ більше одного питання
- [If has metrics] Обов'язково згадай хоча б одну конкретну цифру
- Після прози додай Log_Summary блок(и) нижче
```

### Fallback Reply Format

When AI generation fails:

- **With metrics**: `<category_label>: <primary_metric_label> <value> <unit>` (first primary metric only)
- **Without metrics**: `<category_label>: <content truncated to 60 chars>`

Examples:
```
Калорії: Калорії 525 ккал ✓
Тренування: Дистанція 5 км ✓
Думки: Сьогодні був важкий день, але все ж пробіг... ✓
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

Before listing properties, redundancy analysis:

- Properties 1.2 and 3.1 both test that all metrics appear in the Log_Summary with correct format. They can be combined: "for any metric array, buildLogSummary() renders every metric as label: value unit".
- Properties 3.3 and 5.1 both test ordering (Conversational_Wrap before Log_Summary). They are the same structural property and can be unified.
- Properties 4.1 and 4.6 both test that the output is a single string. 4.6 (single string return type) subsumes 4.1 (single reply covering all entries) — combined into one.
- Property 6.1 (fallback contains category + metric) and 6.2 (fallback truncates content to 60 chars) are complementary, not redundant — both kept.

After reflection, the final property set:

---

### Property 1: Log_Summary renders all metrics with correct format

*For any* non-empty array of `DashboardMetric` objects passed to `buildLogSummary()`, the returned string SHALL contain every metric's `label`, `value`, and `unit`, each formatted as `<label>: <value> <unit>` on its own line.

**Validates: Requirements 1.2, 3.1**

---

### Property 2: Primary metrics appear before secondary metrics

*For any* array of `DashboardMetric` objects containing at least one primary key (from `PRIMARY_METRIC_KEYS`) and at least one non-primary key, `orderMetrics()` SHALL return an array where every primary-key metric appears at a lower index than every non-primary-key metric.

**Validates: Requirements 3.2**

---

### Property 3: Log_Summary contains no emoji

*For any* array of `DashboardMetric` objects, the string returned by `buildLogSummary()` SHALL contain no emoji characters (Unicode ranges U+1F300–U+1FAFF and U+2600–U+27BF).

**Validates: Requirements 8.4**

---

### Property 4: Log_Summary is sanitizeMarkdown-idempotent

*For any* array of `DashboardMetric` objects, applying `sanitizeMarkdown()` to the output of `buildLogSummary()` SHALL return the same string as `buildLogSummary()` alone — i.e., the Log_Summary never contains Markdown that `sanitizeMarkdown()` would alter.

**Validates: Requirements 8.2**

---

### Property 5: Conversational_Wrap precedes Log_Summary in output

*For any* `SmartReplyOptions` where at least one entry has non-empty `dashboard_metrics`, the reply produced by `generateSmartReply()` SHALL contain the first metric line at a character position strictly greater than the position of the last character of the first prose sentence.

**Validates: Requirements 3.3, 5.1**

---

### Property 6: generateSmartReply returns a single string for any number of entries

*For any* non-empty array of `EntryPayload` objects (length 1 to N), `generateSmartReply()` SHALL return a `SmartReplyResult` whose `text` field is a single non-empty string — never an array, never empty.

**Validates: Requirements 4.1, 4.6**

---

### Property 7: Multi-entry reply contains one Log_Summary block per entry with metrics

*For any* array of N `EntryPayload` objects each having non-empty `dashboard_metrics`, the reply produced by `generateSmartReply()` SHALL contain exactly N metric blocks, where each block is separated from the next by at least one blank line.

**Validates: Requirements 4.2**

---

### Property 8: Fallback reply contains category_label and metric value for entries with metrics

*For any* `EntryPayload` with at least one `DashboardMetric`, `buildFallbackReply()` SHALL return a string that contains the entry's `category_label` and the numeric `value` of at least one metric.

**Validates: Requirements 6.1**

---

### Property 9: Fallback reply truncates content to 60 characters for entries without metrics

*For any* `EntryPayload` with empty `dashboard_metrics` and a `content` string of arbitrary length, `buildFallbackReply()` SHALL return a string whose content-derived portion is at most 60 characters long.

**Validates: Requirements 6.2**

---

### Property 10: Thread context is included in the generation prompt

*For any* non-empty thread context string passed to `generateSmartReply()`, the prompt string produced by `buildSmartReplyPrompt()` SHALL contain the thread context string as a substring.

**Validates: Requirements 7.5**

---

### Property 11: Reply never starts with a forbidden confirmation phrase

*For any* `SmartReplyOptions`, the `text` field of the result returned by `generateSmartReply()` SHALL NOT begin with any of the following patterns (case-insensitive, any supported language): `"записано"`, `"збережено"`, `"entry saved"`, `"saved"`, `"✅"`.

**Validates: Requirements 1.5**

---

### Property 12: Reply contains at most one question

*For any* `SmartReplyOptions`, the `text` field of the result returned by `generateSmartReply()` SHALL contain at most one sentence that ends with a `?` character.

**Validates: Requirements 2.5**

---

## Error Handling

### AI Generation Failure

`generateSmartReply()` wraps the `generateConverseReply()` call in a try/catch. On any error:

1. Log the failure: `console.error("[smart-reply] AI generation failed", { userId, category: entries[0]?.category, error: err.message })` — note that `entry.content` is deliberately excluded from the log to avoid logging PII.
2. Call `buildFallbackReply(entries)` to produce a deterministic reply.
3. Return `{ text: fallbackText, usedFallback: true }`.

The calling handler (`text.ts` / `voice.ts`) does not need to handle this error — `generateSmartReply()` never throws.

### Empty Entries Array

If `entries` is empty (should not happen in normal flow but defensive):
- `buildLogSummary()` returns `""`.
- `buildFallbackReply()` returns `"✓"`.
- `generateSmartReply()` proceeds with a minimal prompt and returns whatever the AI produces, or `"✓"` on failure.

### Metric Rendering Edge Cases

| Situation | Handling |
|-----------|----------|
| `value` is `NaN` or `Infinity` | Skip the metric line in Log_Summary |
| `unit` is empty string | Render as `<label>: <value>` without trailing space |
| `label` is empty string | Use `key` as fallback label |
| `value` is a float | Round to 1 decimal place for display (e.g., `5.2 км`) |

---

## Testing Strategy

### Dual Testing Approach

Unit tests cover the pure functions (`buildLogSummary`, `orderMetrics`, `buildSmartReplyPrompt`, `buildFallbackReply`) with specific examples and edge cases. Property-based tests verify universal invariants across randomly generated inputs.

### Property-Based Testing Library

**[fast-check](https://github.com/dubzzz/fast-check)** — TypeScript-native, well-maintained, integrates with Jest/Vitest.

Each property test runs a minimum of **100 iterations**.

Tag format: `// Feature: smart-bot-reply, Property <N>: <property_text>`

### Property Test Implementations

**Property 1 — Log_Summary renders all metrics:**
```typescript
// Feature: smart-bot-reply, Property 1: buildLogSummary renders every metric as label: value unit
fc.assert(fc.property(
  fc.array(arbitraryDashboardMetric(), { minLength: 1, maxLength: 10 }),
  (metrics) => {
    const entry = makeEntry({ dashboard_metrics: metrics });
    const summary = buildLogSummary(entry);
    return metrics.every(m =>
      summary.includes(m.label) &&
      summary.includes(String(m.value)) &&
      (m.unit === "" || summary.includes(m.unit))
    );
  }
), { numRuns: 100 });
```

**Property 2 — Primary metrics first:**
```typescript
// Feature: smart-bot-reply, Property 2: orderMetrics places primary keys before secondary keys
fc.assert(fc.property(
  fc.array(arbitraryDashboardMetric(), { minLength: 2, maxLength: 10 })
    .filter(ms => ms.some(m => PRIMARY_METRIC_KEYS.has(m.key)) &&
                  ms.some(m => !PRIMARY_METRIC_KEYS.has(m.key))),
  (metrics) => {
    const ordered = orderMetrics(metrics);
    const lastPrimaryIdx = ordered.map(m => PRIMARY_METRIC_KEYS.has(m.key)).lastIndexOf(true);
    const firstSecondaryIdx = ordered.findIndex(m => !PRIMARY_METRIC_KEYS.has(m.key));
    return lastPrimaryIdx < firstSecondaryIdx;
  }
), { numRuns: 100 });
```

**Property 3 — No emoji in Log_Summary:**
```typescript
// Feature: smart-bot-reply, Property 3: buildLogSummary contains no emoji characters
const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
fc.assert(fc.property(
  fc.array(arbitraryDashboardMetric(), { minLength: 1, maxLength: 10 }),
  (metrics) => {
    const entry = makeEntry({ dashboard_metrics: metrics });
    return !EMOJI_REGEX.test(buildLogSummary(entry));
  }
), { numRuns: 100 });
```

**Property 4 — sanitizeMarkdown idempotence:**
```typescript
// Feature: smart-bot-reply, Property 4: buildLogSummary output is unchanged by sanitizeMarkdown
fc.assert(fc.property(
  fc.array(arbitraryDashboardMetric(), { minLength: 1, maxLength: 10 }),
  (metrics) => {
    const entry = makeEntry({ dashboard_metrics: metrics });
    const summary = buildLogSummary(entry);
    return sanitizeMarkdown(summary) === summary;
  }
), { numRuns: 100 });
```

**Property 8 — Fallback contains category_label and metric value:**
```typescript
// Feature: smart-bot-reply, Property 8: buildFallbackReply contains category_label and a metric value
fc.assert(fc.property(
  arbitraryEntryPayloadWithMetrics(),
  (entry) => {
    const fallback = buildFallbackReply([entry]);
    const hasLabel = fallback.includes(entry.category_label);
    const hasValue = entry.dashboard_metrics.some(m => fallback.includes(String(m.value)));
    return hasLabel && hasValue;
  }
), { numRuns: 100 });
```

**Property 9 — Fallback truncates content to 60 chars:**
```typescript
// Feature: smart-bot-reply, Property 9: buildFallbackReply content portion is at most 60 chars
fc.assert(fc.property(
  fc.string({ minLength: 0, maxLength: 500 }),
  (content) => {
    const entry = makeEntry({ content, dashboard_metrics: [] });
    const fallback = buildFallbackReply([entry]);
    // Extract the content portion (after the category label and ": ")
    const contentPortion = fallback.replace(entry.category_label + ": ", "").replace(" ✓", "");
    return contentPortion.length <= 60;
  }
), { numRuns: 100 });
```

**Property 10 — Thread context in prompt:**
```typescript
// Feature: smart-bot-reply, Property 10: buildSmartReplyPrompt includes thread context as substring
fc.assert(fc.property(
  fc.string({ minLength: 1, maxLength: 200 }),
  (threadCtx) => {
    const options = makeSmartReplyOptions({ threadCtx });
    const prompt = buildSmartReplyPrompt(options);
    return prompt.includes(threadCtx);
  }
), { numRuns: 100 });
```

### Unit Tests (Example-Based)

| Test | What it verifies |
|------|-----------------|
| `buildLogSummary` with empty metrics | Returns empty string (Req 1.3) |
| `buildLogSummary` with expenses entry | Includes amount and currency (Req 3.4) |
| `buildLogSummary` with sleep entry | Includes sleep_hours (Req 3.5) |
| `buildLogSummary` with mood entry | Includes mood_score with label (Req 3.6) |
| `buildFallbackReply` with no metrics | Truncates content at 60 chars (Req 6.2) |
| `generateSmartReply` with converse intent + no metrics | Returns only Conversational_Wrap, no metric block (Req 5.3) |
| `generateSmartReply` with AI failure | Returns `usedFallback: true` and non-empty text (Req 6.1) |
| `buildSmartReplyPrompt` with UserContext tone | Prompt includes tone samples (Req 2.6) |
| Module exports | `generateSmartReply` accepts correct parameter shape (Req 7.1) |

### Integration Tests

- Full pipeline: complex multi-category message → classifier → smart-reply → verify all entries acknowledged (Req 4.3, 9.1)
- Language detection: Ukrainian, Russian, English inputs produce replies in matching language (Req 1.4)
- Converse intent with emotional context: empathetic wrap precedes metrics (Req 5.1, 9.6)
- Vague input ("поїв"): classifier returns clarifying question intent, smart-reply asks one question (Req 9.4)
