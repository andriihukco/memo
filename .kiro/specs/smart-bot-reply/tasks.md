# Implementation Plan: Smart Bot Reply

## Overview

Implement `src/lib/bot/smart-reply.ts` — a standalone module that replaces the ad-hoc `replyPrompt` construction in `text.ts` and `voice.ts` with a unified, structured reply generator. Tasks are ordered from pure utility functions (no dependencies) through the main module, then handler integration.

## Tasks

- [x] 1. Implement `orderMetrics()` — pure metric-ordering utility
  - Create `src/lib/bot/smart-reply.ts` with the `PRIMARY_METRIC_KEYS` set and the `orderMetrics()` export
  - `orderMetrics()` accepts `DashboardMetric[]` and returns a new array with all primary-key metrics (keys in `PRIMARY_METRIC_KEYS`) sorted to the front, preserving relative order within each group
  - Primary keys: `kcal_intake`, `protein_g`, `distance_km`, `sleep_hours`, `expense_amount`, `mood_score`, `weight_kg`, `alcohol_units`, `caffeine_mg`, `active_min`
  - Must not mutate the input array
  - _Requirements: 3.2_

  - [ ]* 1.1 Write property test for `orderMetrics()`
    - **Property 2: Primary metrics appear before secondary metrics**
    - **Validates: Requirements 3.2**
    - File: `src/__tests__/smart-bot-reply.test.ts`
    - Use `fc.array(arbitraryDashboardMetric(), { minLength: 2, maxLength: 10 }).filter(...)` as shown in design
    - Tag: `// Feature: smart-bot-reply, Property 2: orderMetrics places primary keys before secondary keys`

- [x] 2. Implement `buildLogSummary()` — pure metric-rendering utility
  - Add `buildLogSummary(entry: EntryPayload): string` to `src/lib/bot/smart-reply.ts`
  - Returns empty string when `entry.dashboard_metrics` is empty
  - Calls `orderMetrics()` to sort metrics before rendering
  - Each metric line: `<label>: <value> <unit>` (no trailing space when unit is empty string)
  - When `label` is empty, fall back to `key`
  - Skip lines where `value` is `NaN` or `Infinity`
  - Round float values to 1 decimal place (e.g. `5.2 км`)
  - Append `(~)` to a metric line when the entry `content` contains approximate markers: `десь`, `приблизно`, `~`, `≈`
  - No emoji characters in the output
  - _Requirements: 1.2, 3.1, 3.2, 3.4, 3.5, 3.6, 8.4_

  - [ ]* 2.1 Write property tests for `buildLogSummary()`
    - **Property 1: Log_Summary renders all metrics with correct format**
    - **Validates: Requirements 1.2, 3.1**
    - Tag: `// Feature: smart-bot-reply, Property 1: buildLogSummary renders every metric as label: value unit`
    - **Property 3: Log_Summary contains no emoji**
    - **Validates: Requirements 8.4**
    - Tag: `// Feature: smart-bot-reply, Property 3: buildLogSummary contains no emoji characters`
    - **Property 4: Log_Summary is sanitizeMarkdown-idempotent**
    - **Validates: Requirements 8.2**
    - Tag: `// Feature: smart-bot-reply, Property 4: buildLogSummary output is unchanged by sanitizeMarkdown`
    - Add `arbitraryDashboardMetric()` and `makeEntry()` helpers to the test file

- [x] 3. Implement `buildFallbackReply()` — deterministic no-AI fallback
  - Add `buildFallbackReply(entries: EntryPayload[]): string` to `src/lib/bot/smart-reply.ts`
  - When `entries` is empty, return `"✓"`
  - For each entry: if it has at least one `DashboardMetric`, format as `<category_label>: <primary_metric_label> <value> <unit> ✓` using the first primary metric found by `orderMetrics()`
  - If no metrics, format as `<category_label>: <content truncated to 60 chars> ✓`
  - When multiple entries, join with newline
  - _Requirements: 6.1, 6.2_

  - [ ]* 3.1 Write property tests for `buildFallbackReply()`
    - **Property 8: Fallback reply contains category_label and metric value for entries with metrics**
    - **Validates: Requirements 6.1**
    - Tag: `// Feature: smart-bot-reply, Property 8: buildFallbackReply contains category_label and a metric value`
    - **Property 9: Fallback reply truncates content to 60 characters for entries without metrics**
    - **Validates: Requirements 6.2**
    - Tag: `// Feature: smart-bot-reply, Property 9: buildFallbackReply content portion is at most 60 chars`
    - Add `arbitraryEntryPayloadWithMetrics()` helper to the test file

- [x] 4. Implement `buildSmartReplyPrompt()` — pure prompt-construction utility
  - Add `buildSmartReplyPrompt(options: SmartReplyOptions): string` to `src/lib/bot/smart-reply.ts`
  - Export `SmartReplyOptions` and `SmartReplyResult` interfaces as defined in the design
  - Prompt structure (in order):
    1. If `threadCtx` is present: `Контекст розмови:\n<threadCtx>\n\n`
    2. `Повідомлення користувача: <userMessage>\n\n`
    3. `[ЗБЕРЕЖЕНО В ЩОДЕННИК]\n` followed by one block per entry: `Категорія: <category_label>\n<buildLogSummary(entry)>\n`
    4. `ІНСТРУКЦІЇ ДЛЯ ВІДПОВІДІ:\n` with the instruction bullets from the design (language, intent-specific placement, multi-entry prose cap, forbidden openers, one-question limit, metric mention, Log_Summary placement)
  - Pure function — no side effects
  - _Requirements: 1.5, 2.5, 3.3, 5.1, 7.3, 7.5_

  - [ ]* 4.1 Write property test for `buildSmartReplyPrompt()`
    - **Property 10: Thread context is included in the generation prompt**
    - **Validates: Requirements 7.5**
    - Tag: `// Feature: smart-bot-reply, Property 10: buildSmartReplyPrompt includes thread context as substring`
    - Add `makeSmartReplyOptions()` helper to the test file

- [x] 5. Checkpoint — run all tests before wiring the AI layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement `generateSmartReply()` — main async entry point
  - Add `generateSmartReply(options: SmartReplyOptions): Promise<SmartReplyResult>` to `src/lib/bot/smart-reply.ts`
  - Call `buildSmartReplyPrompt(options)` to produce the structured prompt
  - Call `generateConverseReply(prompt, undefined, undefined, undefined, options.userCtx)` from `converse.ts` as the AI backend
  - Wrap the AI call in try/catch; on any error:
    - Log: `console.error("[smart-reply] AI generation failed", { category: options.entries[0]?.category, error: err.message })` — do NOT log `entry.content`
    - Call `buildFallbackReply(options.entries)` and return `{ text: fallbackText, usedFallback: true }`
  - On success, return `{ text: aiText, usedFallback: false }`
  - Never throws
  - When `entries` is empty, proceed with a minimal prompt and return whatever the AI produces, or `"✓"` on failure
  - _Requirements: 1.1, 1.3, 1.5, 2.5, 4.1, 5.1, 5.2, 5.3, 6.1, 6.3, 7.1, 7.3, 7.4_

  - [ ]* 6.1 Write property tests for `generateSmartReply()`
    - **Property 6: generateSmartReply returns a single string for any number of entries**
    - **Validates: Requirements 4.1, 4.6**
    - Tag: `// Feature: smart-bot-reply, Property 6: generateSmartReply returns a single non-empty string for any entry count`
    - Note: mock `generateConverseReply` to avoid real AI calls in tests

  - [ ]* 6.2 Write unit tests for `generateSmartReply()` edge cases
    - Test: AI failure → `usedFallback: true` and non-empty `text` (Req 6.1)
    - Test: `converse` intent with no metrics → only Conversational_Wrap, no metric block (Req 5.3)
    - Test: `entries` empty → returns non-empty string (defensive path)

- [x] 7. Integrate `generateSmartReply()` into `text.ts`
  - In `src/lib/bot/handlers/text.ts`, import `generateSmartReply` from `@/lib/bot/smart-reply`
  - Remove the `savedSummary` construction block and the `replyPrompt` / `replyContext` string-building block
  - Replace the `withTypingIndicator` call that invokes `generateConverseReply(replyPrompt, ...)` with:
    ```typescript
    const smartReply = await withTypingIndicator(ctx, () =>
      generateSmartReply({
        entries: entriesToSave,
        userMessage: text,
        userCtx,
        threadCtx,
        intent: result.intent as "save_entry" | "converse",
      })
    );
    const finalReplyText = smartReply.text;
    ```
  - Remove the surrounding try/catch that produced the bare `"Записав! ✓"` fallback — `generateSmartReply` never throws
  - Keep all surrounding entry-save logic, thread resolution, and post-processing unchanged
  - _Requirements: 7.1, 7.2, 7.4_

- [x] 8. Integrate `generateSmartReply()` into `voice.ts`
  - In `src/lib/bot/handlers/voice.ts`, import `generateSmartReply` from `@/lib/bot/smart-reply`
  - Remove the `replyContext` string-building block before the `generateConverseReply` call in the save-entries section
  - Replace the `withTypingIndicator` call that invokes `generateConverseReply(replyContext, ...)` with:
    ```typescript
    const smartReply = await withTypingIndicator(ctx, () =>
      generateSmartReply({
        entries: entriesToSave,
        userMessage: result.content,
        userCtx,
        threadCtx,
        intent: result.intent as "save_entry" | "converse",
      })
    );
    const botReplyText = smartReply.text;
    ```
  - Remove the surrounding try/catch that produced the bare `"Записав! ✓"` fallback
  - Keep all surrounding entry-save logic, thread resolution, and post-processing unchanged
  - _Requirements: 7.1, 7.2, 7.4_

- [x] 9. Checkpoint — run all tests and verify TypeScript compilation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Write property tests for `generateSmartReply()` output invariants
  - These tests require the full module to be wired and use mocked AI responses
  - **Property 5: Conversational_Wrap precedes Log_Summary in output**
    - **Validates: Requirements 3.3, 5.1**
    - Tag: `// Feature: smart-bot-reply, Property 5: Conversational_Wrap precedes Log_Summary in output`
    - Strategy: mock `generateConverseReply` to return a fixed prose sentence; verify the first metric line appears after the last character of that sentence
  - **Property 7: Multi-entry reply contains one Log_Summary block per entry with metrics**
    - **Validates: Requirements 4.2**
    - Tag: `// Feature: smart-bot-reply, Property 7: multi-entry reply contains one Log_Summary block per entry with metrics`
    - Strategy: generate N entries each with non-empty metrics; verify N metric blocks separated by blank lines
  - **Property 11: Reply never starts with a forbidden confirmation phrase**
    - **Validates: Requirements 1.5**
    - Tag: `// Feature: smart-bot-reply, Property 11: reply never starts with a forbidden confirmation phrase`
    - Forbidden patterns (case-insensitive): `записано`, `збережено`, `entry saved`, `saved`, `✅`
  - **Property 12: Reply contains at most one question mark**
    - **Validates: Requirements 2.5**
    - Tag: `// Feature: smart-bot-reply, Property 12: reply contains at most one sentence ending with ?`
  - _Requirements: 1.5, 2.5, 3.3, 4.2, 5.1_

- [x] 11. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- `generateSmartReply()` never throws — all AI failures are handled internally via `buildFallbackReply()`
- The test file lives at `src/__tests__/smart-bot-reply.test.ts`, following the existing `src/__tests__/` convention
- Run tests with `npm test` (executes `vitest run`)
- Property tests use `fast-check` (already installed at `^4.6.0`)
