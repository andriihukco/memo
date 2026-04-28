# Requirements Document

## Introduction

This feature adds multilingual support to the Memo Telegram bot and mini app. Currently the entire product is hardcoded in Ukrainian. The goal is to let each user choose their preferred language on first interaction, change it at any time via the `/language` bot command or the mini app settings menu, and have every user-facing string — both bot chat responses and the mini app UI — rendered in that language.

Eleven languages are supported: English, Mandarin Chinese, Spanish, Hindi, Arabic, German, French, Portuguese, Italian, Polish, and Ukrainian.

The selected language is stored in the user's `profiles.settings` JSONB column so it persists across devices and sessions.

---

## Glossary

- **Language_Selector**: The system component responsible for presenting the language-choice UI and persisting the selection.
- **Locale**: A BCP-47 language tag identifying a supported language (e.g. `en`, `zh`, `es`, `hi`, `ar`, `de`, `fr`, `pt`, `it`, `pl`, `uk`).
- **Translation_Catalog**: The set of all translated strings for a given Locale, stored as structured key-value files.
- **Bot**: The Memo Telegram bot backend (`src/lib/bot/`).
- **Mini_App**: The Next.js Telegram mini app (`src/app/miniapp/`).
- **Profile**: A row in the Supabase `profiles` table representing one Telegram user.
- **Settings**: The `settings` JSONB column on the `profiles` table.
- **Onboarding**: The first-run slide sequence shown to new users in the Mini_App.
- **Bot_Onboarding**: The first message exchange a new user has with the Bot (triggered by `/start`).
- **i18n_Provider**: The React context that supplies translated strings to Mini_App components.
- **RTL**: Right-to-left text direction, required for Arabic.
- **Supported_Locale**: One of the eleven Locales listed in the Introduction.

---

## Requirements

### Requirement 1: Language Persistence

**User Story:** As a Memo user, I want my language preference stored in my profile, so that my chosen language is consistent across the bot and mini app on any device.

#### Acceptance Criteria

1. THE Profile SHALL store the user's selected Locale in `settings.language` as a BCP-47 string.
2. WHEN a user's `settings.language` is absent or null, THE Profile SHALL default to `uk` (Ukrainian).
3. WHEN `settings.language` is updated, THE Profile SHALL persist the new value within 2 seconds of the user's selection.
4. IF `settings.language` contains a value that is not a Supported_Locale, THEN THE Profile SHALL fall back to `uk`.

---

### Requirement 2: Bot Language Selection on First Interaction

**User Story:** As a new user, I want the bot to ask me for my preferred language on my very first interaction, so that all subsequent bot responses are in my language from the start.

#### Acceptance Criteria

1. WHEN a user sends `/start` for the first time and `settings.language` is absent, THE Bot SHALL send a language-selection message before the welcome message.
2. THE Language_Selector message SHALL present all eleven Supported_Locales as inline keyboard buttons, each labelled with the language's native name and its flag emoji.
3. WHEN the user taps a language button, THE Bot SHALL store the chosen Locale in `settings.language` and reply with the welcome message in that Locale.
4. WHEN a returning user sends `/start` and `settings.language` is already set, THE Bot SHALL skip the language-selection step and reply in the stored Locale.
5. IF the user does not tap any button and sends a free-text message instead, THEN THE Bot SHALL treat the message normally using the default Locale (`uk`) and prompt language selection again at the next `/start`.

---

### Requirement 3: Language Change via Bot Command

**User Story:** As a user, I want to change my language at any time by sending `/language` to the bot, so that I can switch languages without opening the mini app.

#### Acceptance Criteria

1. WHEN a user sends `/language`, THE Bot SHALL reply with the Language_Selector message showing all eleven Supported_Locales as inline keyboard buttons.
2. WHEN the user taps a language button in the `/language` response, THE Bot SHALL update `settings.language` to the chosen Locale.
3. WHEN `settings.language` is updated via `/language`, THE Bot SHALL confirm the change with a short acknowledgement message in the newly selected Locale.
4. WHILE a language-selection inline keyboard is displayed, THE Bot SHALL accept the button tap at any time, not only immediately after the command.

---

### Requirement 4: Language Change via Mini App Settings

**User Story:** As a user, I want to change my language from the mini app settings menu, so that I can switch languages without leaving the app.

#### Acceptance Criteria

1. THE Mini_App settings page SHALL display a "Language" section containing a list of all eleven Supported_Locales.
2. WHEN the user selects a Locale from the settings list, THE Mini_App SHALL call the profile API to update `settings.language`.
3. WHEN `settings.language` is updated via the Mini_App, THE Mini_App SHALL re-render all visible UI strings in the newly selected Locale without a full page reload.
4. THE currently active Locale SHALL be visually distinguished (e.g. checkmark or highlight) in the language list.
5. IF the profile API call fails, THEN THE Mini_App SHALL display an error message in the current Locale and revert the selection to the previously active Locale.

---

### Requirement 5: Bot Responses in Selected Language

**User Story:** As a user, I want every bot message — commands, confirmations, errors, and AI replies — to be in my selected language, so that I never see text in a language I don't understand.

#### Acceptance Criteria

1. WHEN the Bot sends any system message (welcome, help, stats, report status, error), THE Bot SHALL render that message using the Translation_Catalog for the user's stored Locale.
2. WHEN the Bot generates an AI conversational reply via Gemini, THE Bot SHALL include the user's Locale in the system prompt so the AI responds in that language.
3. WHEN the Bot generates a retrospective report, THE Bot SHALL instruct the AI to produce the report in the user's Locale.
4. WHEN the Bot generates recommendations, THE Bot SHALL instruct the AI to produce the recommendations in the user's Locale.
5. THE Bot SHALL load the user's Locale from the Profile before processing any message, adding no more than one additional database read per request (reusing the existing profile fetch).

---

### Requirement 6: Mini App UI in Selected Language

**User Story:** As a user, I want the entire mini app interface — navigation, labels, buttons, empty states, error messages — to be displayed in my selected language, so that the app feels native to me.

#### Acceptance Criteria

1. THE i18n_Provider SHALL load the Translation_Catalog for the user's active Locale on app initialisation.
2. WHEN the active Locale changes, THE i18n_Provider SHALL swap the Translation_Catalog and trigger a re-render of all subscribed components.
3. THE Mini_App SHALL translate all static UI strings: tab bar labels, section headings, button labels, empty-state messages, error banners, and confirmation dialogs.
4. WHERE the active Locale is `ar` (Arabic), THE Mini_App SHALL apply RTL layout direction to the document root.
5. WHERE the active Locale is `zh` (Mandarin Chinese), THE Mini_App SHALL use Simplified Chinese characters.
6. IF a translation key is missing from the active Locale's Translation_Catalog, THEN THE i18n_Provider SHALL fall back to the `uk` (Ukrainian) string for that key.

---

### Requirement 7: Onboarding in Selected Language

**User Story:** As a new user opening the mini app for the first time, I want the onboarding slides to appear in my language, so that I understand the product from the very first screen.

#### Acceptance Criteria

1. WHEN the Mini_App Onboarding is shown and `settings.language` is already set (e.g. the user already chose a language via the Bot), THE Onboarding SHALL display all slide content in the stored Locale.
2. WHEN the Mini_App Onboarding is shown and `settings.language` is absent, THE Onboarding SHALL display a language-selection step as the first slide before the feature slides.
3. WHEN the user selects a Locale during Mini_App Onboarding, THE Onboarding SHALL immediately re-render subsequent slides in the chosen Locale.
4. WHEN the user completes Onboarding, THE Mini_App SHALL persist the selected Locale to `settings.language` via the profile API.

---

### Requirement 8: Translation Catalog Completeness

**User Story:** As a developer, I want a complete and consistent Translation_Catalog for all eleven languages, so that no user ever sees untranslated strings.

#### Acceptance Criteria

1. THE Translation_Catalog SHALL contain a key for every user-facing string in the Bot and Mini_App.
2. THE Translation_Catalog for each Supported_Locale SHALL contain the same set of keys as the `uk` (Ukrainian) base catalog.
3. WHEN a new user-facing string is added to the codebase, THE Translation_Catalog for all eleven Supported_Locales SHALL be updated before the change is deployed.
4. THE Translation_Catalog SHALL be stored as structured JSON files, one file per Locale, under a dedicated `src/i18n/` directory.
5. FOR ALL Supported_Locales, parsing the Translation_Catalog JSON file and re-serialising it SHALL produce an equivalent JSON structure (round-trip property).

---

### Requirement 9: Language Selector Accessibility

**User Story:** As a user with accessibility needs, I want the language selector to be usable regardless of my current language setting, so that I can always find and change my language.

#### Acceptance Criteria

1. THE Language_Selector in the Mini_App SHALL display each language option using the language's own native name (e.g. "Deutsch" not "German"), so it is recognisable to speakers of that language regardless of the current UI language.
2. THE Language_Selector in the Bot SHALL label each inline button with the language's native name and flag emoji.
3. WHERE the active Locale is `ar`, THE Language_Selector SHALL render the Arabic option in RTL direction even if the rest of the UI is LTR.
