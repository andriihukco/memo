# Bot Pipeline Fix — Tasks

## Task List

- [x] 1. Verify and finalise voice.ts fixes
  - [x] 1.1 Confirm `import { t } from "@/i18n/t"` is present in `src/lib/bot/handlers/voice.ts`
  - [x] 1.2 Confirm all error `ctx.reply()` calls in `voice.ts` use `t(ctx.locale, key)` — no hardcoded Ukrainian strings remain
  - [x] 1.3 Confirm the retry block in `voice.ts` catches `ClassificationError` and retries `classifyAudio()` once before replying with `t(ctx.locale, 'bot.error.voice_failed')`

- [x] 2. Verify and finalise text.ts fixes
  - [x] 2.1 Confirm the `.catch()` on `classify()` in `src/lib/bot/handlers/text.ts` handles all error types (not just `ClassificationError`) and wraps them in a `ClassificationError` before the `instanceof` check
  - [x] 2.2 Confirm all error `ctx.reply()` calls in `text.ts` use `t(ctx.locale, key)` — no hardcoded Ukrainian strings remain
  - [x] 2.3 Confirm the retry path in `text.ts` retries `classify()` once on `ClassificationError` before replying with `t(ctx.locale, 'bot.error.classify_failed')`

- [x] 3. Verify and finalise action.ts fixes
  - [x] 3.1 Confirm `import { t } from "@/i18n/t"` is present in `src/lib/bot/handlers/action.ts`
  - [x] 3.2 Confirm all user-facing `ctx.reply()` calls in `handleAction` use `t(ctx.locale, key)` for every action type
  - [x] 3.3 Confirm all user-facing `ctx.reply()` calls in `checkPendingDelete` use `t(ctx.locale, key)`

- [x] 4. Verify and finalise classifier.ts retry logic
  - [x] 4.1 Confirm `classify()` in `src/lib/classifier.ts` wraps `classifyText()` with `attempt()` (2 total attempts)
  - [x] 4.2 Confirm `classifyAudio()` in `src/lib/classifier.ts` wraps `classifyText()` with `attempt()` (2 total attempts)
  - [x] 4.3 Confirm `attempt()` re-throws the last error after exhausting retries, and `classify()`/`classifyAudio()` wrap it in `ClassificationError`

- [x] 5. Verify and finalise i18n keys
  - [x] 5.1 Confirm all required `bot.error.*` keys exist in both `src/i18n/en.json` and `src/i18n/uk.json`
  - [x] 5.2 Confirm all required `bot.action.*` keys exist in both `en.json` and `uk.json`
  - [x] 5.3 Add any missing i18n keys and sync all locale files

- [x] 6. Write unit tests for error paths
  - [x] 6.1 In `src/__tests__/bot-pipeline-fix.test.ts`, write a test that mocks `classifyAudio()` to throw `ClassificationError` and asserts the handler replies with the English error string when `ctx.locale = "en"`
  - [x] 6.2 Write a test that mocks `classify()` to throw a plain `TypeError` and asserts `handleTextMessage` does not throw and replies with the English error string
  - [x] 6.3 Write a test that mocks `classify()` to throw `ClassificationError` on the first call and succeed on the second, and asserts the result is the successful classification

- [x] 7. Write unit tests for classifier.ts retry helper
  - [x] 7.1 Write a test for `attempt()` that passes a function failing once then succeeding — assert it returns the success value
  - [x] 7.2 Write a test for `attempt()` that passes a function always failing — assert it throws after `retries` attempts

- [x] 8. Run existing tests to confirm preservation
  - [x] 8.1 Run `src/__tests__/smart-bot-reply.test.ts` and confirm all tests pass
  - [x] 8.2 Run `src/__tests__/classifier.test.ts` and confirm all tests pass

- [x] 9. TypeScript compilation check
  - [x] 9.1 Run `npx tsc --noEmit` and confirm zero type errors in modified files
