# Bugfix Requirements Document

## Introduction

Two critical failures in the Telegram bot pipeline prevent users from saving data. Voice messages fail with a hardcoded Ukrainian error on every attempt due to unhandled Gemini API failures and a missing `t()` import in `voice.ts`. Text messages fail silently because non-`ClassificationError` exceptions thrown by `classify()` are not caught, crashing the handler before the entry is saved. Additionally, all three handler files (`voice.ts`, `text.ts`, `action.ts`) contain hardcoded Ukrainian error strings that are never routed through the i18n `t()` function, breaking the experience for non-Ukrainian users. The classifier has no retry logic, so a single transient Gemini API failure (quota spike, model hiccup) causes a permanent user-visible error for that request.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user sends a voice message THEN the system replies with the hardcoded Ukrainian string "Не вдалося розпізнати голосове. Спробуй ще раз або напиши текстом 🙏" regardless of the user's locale, because `voice.ts` does not import or call `t()` for any error reply

1.2 WHEN `classifyAudio()` throws a `ClassificationError` due to a Gemini API failure (quota exceeded, non-JSON response, network error) THEN the system immediately returns the error to the user without retrying, even though the failure may be transient

1.3 WHEN a user sends a text message and `classify()` throws any error that is NOT a `ClassificationError` (e.g. a network `TypeError`, `SyntaxError` from JSON parsing, or an unexpected runtime error) THEN the system throws the error uncaught, crashing the handler and silently dropping the message without any reply to the user

1.4 WHEN a user whose locale is not `'uk'` receives any bot error or action confirmation message from `voice.ts`, `text.ts`, or `action.ts` THEN the system displays Ukrainian text because all error and status strings in those files are hardcoded Ukrainian literals rather than calls to `t(locale, key)`

1.5 WHEN `voice.ts` attempts to call `t()` for error messages THEN the system throws a compile-time or runtime error because `import { t } from "@/i18n/t"` is absent from `voice.ts`

### Expected Behavior (Correct)

2.1 WHEN a user sends a voice message and an error occurs THEN the system SHALL reply using `t(ctx.locale, 'bot.error.voice_failed')` so the message is displayed in the user's configured language

2.2 WHEN `classifyAudio()` or `classify()` throws a `ClassificationError` on the first attempt THEN the system SHALL retry the Gemini API call at least once before surfacing the error to the user

2.3 WHEN a user sends a text message and `classify()` throws any error type (including non-`ClassificationError` exceptions) THEN the system SHALL catch all error types, log the error, and reply with a localised error message via `t(ctx.locale, 'bot.error.classify_failed')` without crashing the handler

2.4 WHEN any bot handler (`voice.ts`, `text.ts`, `action.ts`) sends an error or status reply THEN the system SHALL use `t(ctx.locale, key)` for all user-facing strings so the message respects the user's locale

2.5 WHEN `voice.ts` needs to call `t()` THEN the system SHALL have `import { t } from "@/i18n/t"` present at the top of the file so the function is available at runtime

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user sends a voice message that is successfully transcribed and classified THEN the system SHALL CONTINUE TO save the entry, generate a smart reply, and persist thread metadata exactly as before

3.2 WHEN a user sends a text message that is successfully classified THEN the system SHALL CONTINUE TO save the entry, generate a smart reply, and persist thread metadata exactly as before

3.3 WHEN a user sends a message with intent `question`, `smalltalk`, or `action` THEN the system SHALL CONTINUE TO route the message to the correct handler (`answerQuestion`, `generateConverseReply`, `handleAction`) without any change in behaviour

3.4 WHEN `classify()` or `classifyAudio()` succeeds on the first attempt THEN the system SHALL CONTINUE TO return the result immediately without any added latency from retry logic

3.5 WHEN a Ukrainian-locale user interacts with the bot THEN the system SHALL CONTINUE TO receive Ukrainian-language replies, because the i18n keys added for error messages SHALL have Ukrainian translations in `uk.json`

3.6 WHEN `action.ts` handles a `delete_entries`, `update_entry`, `create_widget`, `merge_widgets`, or `update_schedule` action THEN the system SHALL CONTINUE TO execute the action correctly; only the user-facing reply strings SHALL change to use `t()`

3.7 WHEN the Gemini API fails on both the initial attempt and the retry THEN the system SHALL surface a localised error message to the user and SHALL NOT crash the handler or leave the request hanging
