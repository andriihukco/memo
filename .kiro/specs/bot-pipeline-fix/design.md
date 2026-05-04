# Bot Pipeline Fix — Bugfix Design

## Overview

Four bugs in the Telegram bot pipeline were identified: a missing `t()` import in `voice.ts` causing hardcoded Ukrainian error strings, a catch-all gap in `text.ts` that let non-`ClassificationError` exceptions crash the handler silently, hardcoded Ukrainian strings across all three handler files (`voice.ts`, `text.ts`, `action.ts`), and no retry logic in `classifier.ts` for transient Gemini API failures.

The fix strategy is:
1. Add `import { t } from "@/i18n/t"` to `voice.ts` and replace all hardcoded Ukrainian strings with `t(ctx.locale, key)` calls.
2. Wrap the `classify()` call in `text.ts` with a catch-all that handles any error type, not just `ClassificationError`.
3. Replace all hardcoded Ukrainian strings in `action.ts` with `t(ctx.locale, key)` calls.
4. Add a 1-retry wrapper (`attempt()`) around `classifyAudio()` and `classify()` in `classifier.ts`.
5. Add the required i18n keys to `en.json` and `uk.json`.

**Current state:** All four fixes have been applied to the codebase. This design documents the intended final state and serves as the basis for verification tasks.

## Glossary

- **Bug_Condition (C)**: The set of inputs and code paths that trigger the defective behaviour described in the requirements.
- **Property (P)**: The desired correct behaviour when the bug condition holds.
- **Preservation**: Existing correct behaviour (successful message handling, entry saving, smart replies) that must remain unchanged by the fix.
- **`classify()`**: The exported function in `src/lib/classifier.ts` that classifies a text message via the Gemini API.
- **`classifyAudio()`**: The exported function in `src/lib/classifier.ts` that transcribes and classifies a voice message via the Gemini API.
- **`attempt(fn, retries)`**: Internal retry helper in `classifier.ts` that calls `fn` up to `retries` times before re-throwing.
- **`t(locale, key, params?)`**: The i18n translation function from `@/i18n/t` that returns a localised string for the given key.
- **`ClassificationError`**: The typed error class thrown by `classify()` and `classifyAudio()` when all retry attempts fail.
- **`ctx.locale`**: The `Locale` value on the bot context, set from the user's profile, used to select the correct translation.

## Bug Details

### Bug Condition

The bugs manifest across four distinct code paths:

**Bug 1 — Missing `t()` import in `voice.ts`:**
```
FUNCTION isBugCondition_1(file)
  INPUT: file = "src/lib/bot/handlers/voice.ts"
  OUTPUT: boolean

  RETURN NOT hasImport(file, "import { t } from \"@/i18n/t\"")
         AND hasHardcodedUkrainianStrings(file)
END FUNCTION
```

**Bug 2 — Narrow error catch in `text.ts`:**
```
FUNCTION isBugCondition_2(error)
  INPUT: error thrown by classify()
  OUTPUT: boolean

  RETURN NOT (error instanceof ClassificationError)
         AND handlerDoesNotCatchError(error)
END FUNCTION
```

**Bug 3 — Hardcoded Ukrainian strings in handlers:**
```
FUNCTION isBugCondition_3(ctx)
  INPUT: ctx.locale != "uk"
  OUTPUT: boolean

  RETURN anyHandlerRepliesWithHardcodedUkrainianString(ctx)
END FUNCTION
```

**Bug 4 — No retry in classifier:**
```
FUNCTION isBugCondition_4(call)
  INPUT: call to classify() or classifyAudio()
  OUTPUT: boolean

  RETURN geminiApiThrowsTransientError(call)
         AND noRetryAttempted(call)
END FUNCTION
```

### Examples

- **Bug 1**: User sends a voice message; Gemini fails; `voice.ts` replies "Не вдалося розпізнати голосове..." regardless of locale.
- **Bug 2**: `classify()` throws a `TypeError` (network failure); `text.ts` does not catch it; handler crashes silently with no reply to user.
- **Bug 3**: English-locale user triggers a delete action; `action.ts` replies "Готово — видалено N записів." in Ukrainian.
- **Bug 4**: Gemini returns a 503 on first attempt; `classifyAudio()` immediately surfaces the error without retrying.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Successful voice message handling: transcription → classification → entry save → smart reply → thread metadata persist.
- Successful text message handling: classification → entry save → smart reply → thread metadata persist.
- Question, smalltalk, and action intent routing to their respective handlers.
- Ukrainian-locale users continue to receive Ukrainian-language replies (i18n keys have Ukrainian translations in `uk.json`).
- Entry encryption, embedding, and memory extraction are unaffected.
- When `classify()` or `classifyAudio()` succeeds on the first attempt, no added latency from retry logic.

**Scope:**
All inputs that do NOT trigger an error path (i.e., successful classification and save) are completely unaffected by this fix. The retry logic only activates on failure; the i18n change only affects the string values of error/action replies, not their structure or timing.

## Hypothesized Root Cause

1. **Missing import in `voice.ts`**: The file was written without the `t()` import, so all error replies were inlined as Ukrainian string literals. The fix is a one-line import addition plus string replacement.

2. **Narrow catch clause in `text.ts`**: The original catch only handled `ClassificationError`. Any other exception type (network `TypeError`, JSON `SyntaxError`, Zod `ZodError`) propagated uncaught, crashing the handler. The fix wraps all error types and converts them to a `ClassificationError` before surfacing a localised reply.

3. **Hardcoded strings in all three handlers**: Error and action reply strings were written as Ukrainian literals during initial development before the i18n system was in place. The fix replaces each literal with a `t(ctx.locale, key)` call and adds the corresponding keys to `en.json` and `uk.json`.

4. **No retry in classifier**: `classify()` and `classifyAudio()` called `classifyText()` directly with no retry. Transient Gemini failures (quota spikes, non-JSON responses, network errors) immediately surfaced as errors. The fix wraps the `classifyText()` call in the existing `attempt()` helper (2 attempts total).

## Correctness Properties

Property 1: Bug Condition — Localised Error Replies

_For any_ bot context where `ctx.locale` is set to any supported locale (e.g. `"en"`, `"uk"`, `"fr"`) and an error occurs in `voice.ts`, `text.ts`, or `action.ts`, the fixed handlers SHALL reply using `t(ctx.locale, key)` so the error message is displayed in the user's configured language.

**Validates: Requirements 2.1, 2.4, 2.5**

Property 2: Bug Condition — Catch-All Error Handling in `text.ts`

_For any_ error thrown by `classify()` — whether a `ClassificationError`, `TypeError`, `SyntaxError`, `ZodError`, or any other type — the fixed `handleTextMessage` SHALL catch the error, log it, and reply with `t(ctx.locale, 'bot.error.classify_failed')` without crashing the handler.

**Validates: Requirements 2.3, 3.7**

Property 3: Bug Condition — Classifier Retry

_For any_ call to `classify()` or `classifyAudio()` where the first Gemini API attempt throws a transient error, the fixed classifier SHALL retry at least once before throwing a `ClassificationError` to the caller.

**Validates: Requirements 2.2, 3.7**

Property 4: Preservation — Successful Path Unchanged

_For any_ input where classification succeeds (on the first or retry attempt), the fixed handlers SHALL produce the same entry save, smart reply, and thread metadata behaviour as the original handlers, with no added latency on the success path.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

Property 5: Preservation — Ukrainian Locale Unchanged

_For any_ Ukrainian-locale user, the fixed handlers SHALL continue to reply in Ukrainian for all error and action messages, because `uk.json` contains translations for all new i18n keys.

**Validates: Requirement 3.5**

## Fix Implementation

### Changes Required

**File: `src/lib/bot/handlers/voice.ts`**

**Change 1 — Add `t()` import:**
```typescript
import { t } from "@/i18n/t";
```
Add at the top of the file alongside other imports.

**Change 2 — Replace hardcoded Ukrainian error strings:**
Replace every `ctx.reply("...Ukrainian...")` error call with `ctx.reply(t(ctx.locale, 'bot.error.<key>'))`.

Mapping:
| Hardcoded string | i18n key |
|---|---|
| Profile missing error | `bot.error.profile_missing` |
| Audio download failed | `bot.error.audio_download_failed` |
| Voice recognition failed | `bot.error.voice_failed` |
| Entry save failed | `bot.error.save_failed` |

---

**File: `src/lib/bot/handlers/text.ts`**

**Change 3 — Catch-all error handler around `classify()`:**

Replace the existing `ClassificationError`-only catch with a catch-all that wraps any error type:

```typescript
const classifyResult = await classify(text, classifierThreadCtx)
  .catch(async (err) => {
    if (err instanceof ClassificationError) {
      return classify(text, classifierThreadCtx).catch((retryErr) => {
        console.error("[text handler] ClassificationError on retry:", retryErr);
        return new ClassificationError("Retry failed", retryErr);
      });
    }
    // Catch-all: wrap any other error type
    console.error("[text handler] Unexpected error from classify():", err);
    return new ClassificationError("Unexpected classification error", err);
  });
```

**Change 4 — Replace hardcoded Ukrainian strings in `text.ts`:**
Same pattern as `voice.ts` — replace all Ukrainian literals with `t(ctx.locale, key)` calls.

---

**File: `src/lib/bot/handlers/action.ts`**

**Change 5 — Replace all hardcoded Ukrainian strings:**

Replace every Ukrainian string literal in `handleAction` and `checkPendingDelete` with `t(ctx.locale, key)` calls.

Mapping:
| Hardcoded string | i18n key |
|---|---|
| "Готово — видалено N записів." | `bot.action.deleted` |
| "Окей, нічого не видаляю 👍" | `bot.action.cancel_delete` |
| "Чекаю підтвердження..." | `bot.action.pending_delete` |
| "Не знайшов записів..." | `bot.action.not_found_delete` |
| "Не знайшов запис для редагування..." | `bot.action.edit_not_found` |
| "Не зрозумів що саме змінити..." | `bot.action.edit_no_changes` |
| "Щось пішло не так при оновленні..." | `bot.action.edit_error` |
| "✅ Оновив!..." | `bot.action.edit_success` |
| Widget created confirmation | `bot.action.widget_created` |
| Merge WIP message | `bot.action.merge_wip` |
| Schedule updated | `bot.action.schedule_updated` |
| Schedule parts (daily/weekly/monthly on/off) | `bot.action.schedule.*` |
| Unknown action | `bot.action.unknown` |

---

**File: `src/lib/classifier.ts`**

**Change 6 — Add retry wrapper to `classify()`:**

```typescript
export async function classify(text: string, threadContext?: string): Promise<ClassificationResult> {
  try {
    const input = threadContext
      ? `${text}\n\n[Conversation context for understanding short replies:\n${threadContext}]`
      : text;
    return await attempt(() => classifyText(input));
  } catch (err) {
    throw new ClassificationError("Classification failed", err);
  }
}
```

**Change 7 — Add retry wrapper to `classifyAudio()`:**

```typescript
export async function classifyAudio(audioBytes: Buffer, mimeType: string, threadContext?: string): Promise<ClassificationResult> {
  try {
    const contextNote = threadContext
      ? `\n\nConversation context...\n${threadContext}\n\nNow transcribe and classify the audio:`
      : "\n\nTranscribe and classify this audio diary entry.";

    return await attempt(() => classifyText([
      { inlineData: { data: audioBytes.toString("base64"), mimeType } },
      { text: contextNote },
    ]));
  } catch (err) {
    throw new ClassificationError("Audio classification failed", err);
  }
}
```

---

**Files: `src/i18n/en.json` and `src/i18n/uk.json`**

**Change 8 — Add new i18n keys:**

Keys to add (all already present in current codebase — verify completeness):

```json
"bot.error.profile_missing": "...",
"bot.error.audio_download_failed": "...",
"bot.error.voice_failed": "...",
"bot.error.classify_failed": "...",
"bot.error.save_failed": "...",
"bot.action.not_found_delete": "...",
"bot.action.deleted": "...",
"bot.action.cancel_delete": "...",
"bot.action.pending_delete": "...",
"bot.action.edit_not_found": "...",
"bot.action.edit_no_changes": "...",
"bot.action.edit_error": "...",
"bot.action.edit_success": "...",
"bot.action.widget_created": "...",
"bot.action.merge_wip": "...",
"bot.action.schedule_updated": "...",
"bot.action.schedule.daily_on": "...",
"bot.action.schedule.daily_off": "...",
"bot.action.schedule.weekly_on": "...",
"bot.action.schedule.weekly_off": "...",
"bot.action.schedule.monthly_on": "...",
"bot.action.schedule.monthly_off": "...",
"bot.action.schedule.no_changes": "...",
"bot.action.unknown": "..."
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first verify the bug condition is correctly identified (exploratory), then verify the fix works and existing behaviour is preserved.

### Exploratory Bug Condition Checking

**Goal**: Confirm the bugs are fixed by running tests against the current (fixed) code. If any test fails, the fix is incomplete.

**Test Plan**: Write unit tests that simulate the error paths and assert localised replies are sent. Run against the current codebase.

**Test Cases**:
1. **Voice handler locale test**: Mock `classifyAudio()` to throw `ClassificationError`; assert reply uses `t(locale, 'bot.error.voice_failed')` for `"en"` locale.
2. **Text handler catch-all test**: Mock `classify()` to throw a plain `TypeError`; assert handler does not crash and replies with `t(locale, 'bot.error.classify_failed')`.
3. **Action handler locale test**: Call `checkPendingDelete` with `"en"` locale; assert reply is in English.
4. **Classifier retry test**: Mock `classifyText` to fail once then succeed; assert `classify()` returns the successful result without throwing.

**Expected Results** (on fixed code):
- All tests pass — replies are localised, handler does not crash, retry succeeds.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behaviour.

**Pseudocode:**
```
FOR ALL ctx WHERE isBugCondition(ctx) DO
  result := fixedHandler(ctx)
  ASSERT result.reply == t(ctx.locale, expectedKey)
  ASSERT handlerDidNotCrash
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (successful classification), the fixed handlers produce the same result as before.

**Pseudocode:**
```
FOR ALL ctx WHERE NOT isBugCondition(ctx) DO
  ASSERT fixedHandler(ctx).entrySaved == true
  ASSERT fixedHandler(ctx).smartReplyGenerated == true
  ASSERT fixedHandler(ctx).threadMetadataPersisted == true
END FOR
```

**Testing Approach**: The existing test suite in `src/__tests__/smart-bot-reply.test.ts` and `src/__tests__/classifier.test.ts` covers the success path. Run these to confirm preservation.

**Test Cases**:
1. **Success path preservation**: Existing `smart-bot-reply.test.ts` tests pass unchanged.
2. **Classifier success path**: Existing `classifier.test.ts` tests pass unchanged.
3. **Retry does not add latency on success**: Mock `classifyText` to succeed on first call; assert `attempt()` calls it exactly once.

### Unit Tests

- Test `voice.ts` error paths with mocked `classifyAudio()` failures for multiple locales.
- Test `text.ts` catch-all with `TypeError`, `SyntaxError`, and `ClassificationError` inputs.
- Test `action.ts` reply strings for `"en"` and `"uk"` locales across all action types.
- Test `classifier.ts` `attempt()` helper: 1 failure then success, 2 failures then throw.

### Property-Based Tests

- Generate random `Locale` values and assert all error reply keys resolve to non-empty strings via `t()`.
- Generate random error types thrown by `classify()` and assert `text.ts` always replies without crashing.
- Generate random retry counts and assert `attempt()` retries exactly `retries` times before throwing.

### Integration Tests

- End-to-end voice message flow with a mocked Gemini failure on attempt 1, success on attempt 2.
- End-to-end text message flow with a non-`ClassificationError` thrown by `classify()`.
- Full action handler flow for `delete_entries` with `"en"` locale — assert English confirmation reply.
