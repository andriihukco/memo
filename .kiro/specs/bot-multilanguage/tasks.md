# Implementation Plan: Bot Multilanguage Support

## Overview

Add multilingual support to the Memo Telegram bot and mini app. The implementation follows the design's "locale-first" principle: resolve the user's locale once per request from `profile.settings.language`, thread it through every layer that produces user-visible output, and expose language selection in both the bot (`/language` command, `/start` first-run) and the mini app (settings page, onboarding).

Eleven locales are supported: `en`, `zh`, `es`, `hi`, `ar`, `de`, `fr`, `pt`, `it`, `pl`, `uk`. Ukrainian (`uk`) is the default and the base catalog.

## Tasks

- [x] 1. Create the i18n foundation: locale metadata, types, and translation function
  - Create `src/i18n/locales.ts` with `SUPPORTED_LOCALES`, `Locale` type, and `LOCALE_META` (native names, flags, RTL flag for `ar`)
  - Create `src/i18n/t.ts` with `loadCatalog(locale)`, `getLocale(settings)`, and `t(key, locale, vars?)` — including `uk` fallback and `{varName}` interpolation
  - Create `src/i18n/ai-locale.ts` with `aiLanguageInstruction(locale)` returning the per-locale language instruction string for all 11 locales
  - _Requirements: 1.1, 1.2, 1.4, 5.1, 5.2_

  - [ ]* 1.1 Write property test: locale round-trip persistence (Property 1)
    - **Property 1: Locale round-trip persistence**
    - Generate random `Supported_Locale` values; write to settings object; read back via `getLocale()`; assert equality
    - **Validates: Requirements 1.1**

  - [ ]* 1.2 Write property test: invalid locale falls back to `uk` (Property 2)
    - **Property 2: Invalid locale falls back to `uk`**
    - Generate arbitrary strings (empty, whitespace, Unicode, very long); assert `getLocale({ language: value })` returns `'uk'` for all non-`Supported_Locale` inputs
    - **Validates: Requirements 1.4**

  - [ ]* 1.3 Write property test: system messages use the user's locale catalog (Property 5)
    - **Property 5: System messages use the user's locale catalog**
    - Generate random (key, locale) pairs from the catalog; assert `t(key, locale)` returns the catalog string or the `uk` fallback, never the raw key when a `uk` fallback exists
    - **Validates: Requirements 5.1, 6.6**

- [x] 2. Create the Ukrainian base translation catalog and all 10 locale catalogs
  - Create `src/i18n/uk.json` as the base catalog containing all user-facing strings for the bot (`bot.*`) and mini app (`miniapp.*`) — extract all hardcoded Ukrainian strings from `commands.ts`, `converse.ts`, `retrospective.ts`, `recommendations.ts`, and `layout.tsx`
  - Create the remaining 10 locale JSON files (`en.json`, `zh.json`, `es.json`, `hi.json`, `ar.json`, `de.json`, `fr.json`, `pt.json`, `it.json`, `pl.json`) with accurate translations for every key in `uk.json`
  - Ensure all 11 files have identical key sets
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 2.1 Write property test: all locale catalogs have the same key set as `uk` (Property 8)
    - **Property 8: All locale catalogs have the same key set as the `uk` base catalog**
    - For each `Supported_Locale`, compare its key set to `uk`; assert equality
    - **Validates: Requirements 8.2**

  - [ ]* 2.2 Write property test: translation catalog JSON round-trip (Property 9)
    - **Property 9: Translation catalog JSON round-trip**
    - For each `Supported_Locale`, parse its JSON, `JSON.stringify`, parse again; assert deep equality
    - **Validates: Requirements 8.5**

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Extend the bot middleware to attach `ctx.locale` and add the `/language` command
  - Extend the `BotContext` interface in `src/app/api/telegram/webhook/route.ts` to include `locale: Locale`
  - In the profile middleware, call `getLocale(ctx.profile.settings)` and assign to `ctx.locale` (zero extra DB reads)
  - Add `buildLanguageSelectorKeyboard()` to `src/lib/bot/commands.ts` — 11 buttons (2-column layout), each labelled `{flag} {nativeName}`, callback data `lang:<locale>`
  - Add `handleLanguage(ctx)` to `src/lib/bot/commands.ts` — replies with `t('bot.language.prompt', ctx.locale)` and the language selector keyboard
  - Register `/language` command in `webhook/route.ts`
  - _Requirements: 2.2, 3.1, 5.5_

  - [ ]* 4.1 Write property test: language selector contains all eleven locales (Property 3)
    - **Property 3: Language selector contains all eleven locales**
    - Call `buildLanguageSelectorKeyboard()` multiple times; assert exactly 11 buttons, one per `Supported_Locale`, no duplicates
    - **Validates: Requirements 2.2, 3.1**

- [x] 5. Implement language callback handler and first-run `/start` language selection
  - Extend `handleCallbackQuery` in `commands.ts` to handle `lang:<locale>` callbacks: validate locale, call `updateProfileLanguage(profileId, locale)` (new helper using Supabase service client to merge `settings.language`), update `ctx.locale`, reply with `t('bot.language.changed', locale, { language: nativeName })`
  - Modify `handleStart` to check `ctx.profile?.settings?.language`: if absent, send language selector (using `'uk'` for the prompt itself) and return early; if present, call `sendWelcome(ctx)` which uses `t('bot.welcome', ctx.locale)`
  - After a language button tap during first-run, the callback handler sends the welcome message in the chosen locale
  - _Requirements: 2.1, 2.3, 2.4, 3.2, 3.3, 3.4_

  - [ ]* 5.1 Write property test: language button tap stores and acknowledges the chosen locale (Property 4)
    - **Property 4: Language button tap stores and acknowledges the chosen locale**
    - For any `Supported_Locale`, when `lang:<locale>` callback is processed, assert `settings.language` is updated to that locale AND the acknowledgement message is rendered using that locale's catalog
    - **Validates: Requirements 2.3, 3.2, 3.3**

- [x] 6. Translate all bot system messages to use `t()` with `ctx.locale`
  - Replace all hardcoded Ukrainian strings in `commands.ts` (`WELCOME`, `HELP`, `REPORT_STATUS`, inline reply strings, error messages) with `t(key, ctx.locale)` calls using keys from the catalog
  - Update `handleStats`, `handleReport*`, `handleRecommendations`, `handleRemind`, `handleInvite`, `handleCancel` to use `t()` for all user-facing strings
  - Update `miniappButton()` to use `t('bot.miniapp.button', locale)` for the button label
  - _Requirements: 5.1_

- [x] 7. Inject locale into AI system prompts (converse, retrospective, recommendations)
  - Modify `buildSystemPrompt(ctx: UserContext, locale: Locale)` in `converse.ts` to prepend `aiLanguageInstruction(locale)` to the system prompt
  - Update `generateConverseReply` signature to accept `locale: Locale` and pass it to `buildSystemPrompt`
  - Update all callers of `generateConverseReply` in `src/lib/bot/handlers/text.ts` (and any other callers) to pass `ctx.locale`
  - Modify `generateRetrospective` in `retrospective.ts` to accept `locale: Locale` and prepend `aiLanguageInstruction(locale)` to `RETRO_SYSTEM_PROMPT`
  - Update `runReport` in `commands.ts` to pass `ctx.locale` to `generateRetrospective`
  - Modify `generateRecommendations` in `recommendations.ts` to accept `locale: Locale` and prepend `aiLanguageInstruction(locale)` to `RECOMMENDATION_SYSTEM_PROMPT`
  - Update `getRecommendationsForUser` and `handleRecommendations` to pass `ctx.locale`
  - _Requirements: 5.2, 5.3, 5.4_

  - [ ]* 7.1 Write property test: AI system prompts contain a language instruction (Property 6)
    - **Property 6: AI system prompts contain a language instruction for the user's locale**
    - For any `Supported_Locale`, assert the system prompt passed to Gemini contains the string returned by `aiLanguageInstruction(locale)`
    - **Validates: Requirements 5.2, 5.3, 5.4**

- [x] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Create the profile settings API endpoint (`/api/profile/settings`)
  - Create `src/app/api/profile/settings/route.ts` with a `PATCH` handler that:
    - Authenticates via JWT (reuse `getUserJwt` / `makeServiceClient` pattern from `profile/route.ts`)
    - Validates `body.language` is a `Supported_Locale`
    - Looks up the profile by `telegram_id` (or `id` fallback) and merges `{ language }` into the existing `settings` JSONB
    - Returns `{ ok: true }` on success, `{ error: 'Invalid locale' }` (400) on bad input
  - _Requirements: 1.3, 4.2_

- [x] 10. Create the mini app i18n provider and wire it into the layout
  - Create `src/lib/i18n/context.tsx` with `I18nProvider` (React context) that:
    - Accepts `initialLocale: Locale` prop
    - Dynamically imports `src/i18n/<locale>.json` on locale change
    - Loads `uk.json` as fallback catalog
    - Exposes `locale`, `t(key, vars?)`, and `setLocale(locale)` via `useI18n()` hook
    - Sets `document.documentElement.dir = 'rtl'` for `ar`, `'ltr'` for all others (RTL support)
    - Sets `document.documentElement.lang = locale`
  - Modify `src/app/miniapp/layout.tsx` to wrap the existing `AuthProvider` with `I18nProvider`, resolving `initialLocale` from the profile's `settings.language` once auth is available (default `'uk'` until profile loads)
  - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_

  - [ ]* 10.1 Write property test: i18n provider swaps catalog on locale change (Property 7)
    - **Property 7: i18n provider swaps catalog on locale change**
    - For any pair of distinct `Supported_Locales` (fromLocale, toLocale), after calling `setLocale(toLocale)`, `t(key)` returns strings from toLocale's catalog (or `uk` fallback), not fromLocale's catalog
    - **Validates: Requirements 6.2, 4.3**

- [x] 11. Add the Language section to the mini app settings page
  - Add a `LanguageSection` component to `src/app/miniapp/settings/page.tsx` that:
    - Lists all 11 locales using `LOCALE_META` (native name + flag)
    - Shows a checkmark on the currently active locale (optimistic state)
    - On selection: calls `PATCH /api/profile/settings` with `{ language: newLocale }`, calls `setLocale(newLocale)` immediately (optimistic), reverts on API failure and shows an error message in the current locale
    - Disables buttons while saving
  - Insert `LanguageSection` into the settings page layout above or below the existing sections
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 9.1_

  - [ ]* 11.1 Write property test: language selector displays native names (Property 10)
    - **Property 10: Language selector displays native names**
    - For any `Supported_Locale`, the language selector displays the locale's native name as defined in `LOCALE_META`, not a translated or English name
    - **Validates: Requirements 9.1, 9.2**

- [x] 12. Translate mini app static UI strings to use `t()` from `useI18n()`
  - Update `src/app/miniapp/layout.tsx`: replace hardcoded tab bar labels (`'Стрічка'`, `'Віджети'`, `'Графік'`, `'Інсайти'`, `'Меню'`) and onboarding slide content with `t()` calls
  - Update `src/app/miniapp/settings/page.tsx`: replace hardcoded section headings, button labels, and status strings with `t()` calls
  - Update `src/app/miniapp/onboarding/page.tsx`: replace slide titles, body text, and CTA button labels with `t()` calls
  - Update other mini app pages (`dashboard`, `reports`, `categories`, `graph`, `subscriptions`) to replace hardcoded UI strings with `t()` calls
  - _Requirements: 6.3, 7.1_

- [x] 13. Add language picker as first step in mini app onboarding
  - Modify the `OnboardingOverlay` in `src/app/miniapp/layout.tsx` to check whether `settings.language` is absent on mount
  - If absent, render an `OnboardingLanguagePicker` component as the first step (before the feature slides): a full-screen overlay listing all 11 locales; on selection, call `setLocale(loc)` and proceed to the feature slides in the chosen locale
  - When onboarding completes, persist the chosen locale via `PATCH /api/profile/settings`
  - If `settings.language` is already set, skip the language picker and render slides in the stored locale
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 14. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Write the bot-multilanguage test file
  - Create `src/__tests__/bot-multilanguage.test.ts` containing all property-based tests defined in tasks 1.1, 1.2, 1.3, 2.1, 2.2, 4.1, 5.1, 7.1, 10.1, 11.1 using `fast-check` and `vitest`
  - Each test must be tagged with its property number and the requirements clause it validates
  - Mock Supabase and Telegram bot API calls where needed; test pure functions directly
  - _Requirements: 8.1, 8.2, 8.5_

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases
- The `settings.language` key is stored in the existing `profiles.settings` JSONB column — no DB migration required
- Arabic (`ar`) requires RTL layout direction; this is handled by the `I18nProvider` via `document.documentElement.dir`
- The `uk` catalog is the source of truth; all other catalogs must have identical key sets
