# Design Document: Bot Multilanguage Support

## Overview

This document describes the technical design for adding multilingual support to the Memo Telegram bot and mini app. The feature allows each user to choose their preferred language, persists that choice in their profile, and renders all user-facing strings — bot messages, AI prompts, and mini app UI — in the selected language.

Eleven locales are supported: `en`, `zh`, `es`, `hi`, `ar`, `de`, `fr`, `pt`, `it`, `pl`, `uk`. Ukrainian (`uk`) is the default and the base catalog against which all other catalogs are validated.

The design follows a "locale-first" principle: the user's locale is resolved once per request (from `profile.settings.language`) and threaded through every layer that produces user-visible output.

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Telegram User                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │ /start, /language, text, button tap
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│          /api/telegram/webhook  (grammY bot)                    │
│                                                                 │
│  Profile Middleware                                             │
│    resolveOrCreateProfile() → ctx.profile                      │
│    getLocale(ctx.profile) → ctx.locale  ← NEW                  │
│                                                                 │
│  Command Router                                                 │
│    /start  → handleStart(ctx)  ← language selector on 1st use  │
│    /language → handleLanguage(ctx)  ← NEW                      │
│    /help, /stats, /report, etc. → use t(key, ctx.locale)       │
│                                                                 │
│  Message Handler                                                │
│    handleTextMessage(ctx, profile, locale)  ← locale threaded  │
│    buildSystemPrompt(ctx, locale)  ← locale in AI prompt       │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Supabase — profiles.settings.language              │
│                                                                 │
│  settings JSONB: { ..., "language": "en" }                     │
│  Read: profile middleware (zero extra DB reads)                 │
│  Write: language callback handler, /api/profile/settings PATCH  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Telegram Mini App (Next.js)                        │
│                                                                 │
│  i18nProvider (React context)                                   │
│    loads catalog from src/i18n/<locale>.json                   │
│    exposes t(key) → translated string                          │
│    swaps catalog on locale change (no page reload)             │
│                                                                 │
│  Settings page → Language section                              │
│    lists all 11 locales with native names                      │
│    calls PATCH /api/profile/settings on selection              │
│                                                                 │
│  Onboarding overlay                                             │
│    shows language picker as first step if no locale stored     │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

**1. Locale stored in `settings.language`, not a dedicated column**
The `profiles.settings` JSONB column already holds user preferences. Adding `language` there avoids a schema migration and keeps all user preferences in one place. The trade-off is that reading the locale requires deserialising the JSONB, but this is already done by the profile middleware.

**2. Zero extra DB reads for locale**
The profile middleware already fetches the full profile row (including `settings`) before any handler runs. `getLocale(profile)` simply reads `profile.settings.language` — no additional query.

**3. Translation catalogs as static JSON files**
Catalogs live in `src/i18n/<locale>.json`. They are imported at build time in the mini app (Next.js static analysis) and loaded dynamically in the bot (Node.js `require`/`import`). This keeps the translation layer simple and avoids a runtime i18n library dependency.

**4. AI language instruction via system prompt injection**
Rather than post-processing AI output, the user's locale is injected into every Gemini system prompt as a language instruction (e.g., `"Respond in English (en)."` or `"Відповідай українською (uk)."`). This is the most reliable way to control AI output language.

**5. RTL support via `dir` attribute on `<html>`**
Arabic requires right-to-left layout. The `i18nProvider` sets `document.documentElement.dir = 'rtl'` when the active locale is `ar` and resets it to `'ltr'` for all other locales.

---

## Components and Interfaces

### 1. Translation Catalog (`src/i18n/`)

```
src/i18n/
  uk.json   ← base catalog (source of truth)
  en.json
  zh.json
  es.json
  hi.json
  ar.json
  de.json
  fr.json
  pt.json
  it.json
  pl.json
```

**Catalog structure** (flat key-value, namespaced by dot notation):

```json
{
  "bot.welcome": "👋 Привіт! Я *Memo* — твій особистий AI-щоденник 📓",
  "bot.help.title": "📖 *Довідка Memo*",
  "bot.stats.empty": "За сьогодні ще нічого немає 🙂",
  "bot.report.status.0": "Збираю твої записи... 📂",
  "bot.language.prompt": "🌍 Оберіть мову / Choose your language:",
  "bot.language.changed": "✅ Мову змінено на {language}",
  "bot.cancel.reply": "✅ Скинуто. Можеш починати з чистого аркуша!",
  "miniapp.tab.feed": "Стрічка",
  "miniapp.tab.dashboard": "Віджети",
  "miniapp.tab.graph": "Графік",
  "miniapp.tab.insights": "Інсайти",
  "miniapp.tab.menu": "Меню",
  "miniapp.settings.language": "Мова",
  "miniapp.onboarding.skip": "Пропустити",
  "miniapp.onboarding.next": "Далі →",
  "miniapp.error.generic": "Щось пішло не так. Спробуй ще раз.",
  "..."
}
```

**Locale metadata** (separate constant, not in JSON):

```typescript
// src/i18n/locales.ts
export const SUPPORTED_LOCALES = ['en','zh','es','hi','ar','de','fr','pt','it','pl','uk'] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];

export const LOCALE_META: Record<Locale, { nativeName: string; flag: string; rtl?: boolean }> = {
  en: { nativeName: 'English',    flag: '🇬🇧' },
  zh: { nativeName: '中文',        flag: '🇨🇳' },
  es: { nativeName: 'Español',    flag: '🇪🇸' },
  hi: { nativeName: 'हिन्दी',      flag: '🇮🇳' },
  ar: { nativeName: 'العربية',    flag: '🇸🇦', rtl: true },
  de: { nativeName: 'Deutsch',    flag: '🇩🇪' },
  fr: { nativeName: 'Français',   flag: '🇫🇷' },
  pt: { nativeName: 'Português',  flag: '🇧🇷' },
  it: { nativeName: 'Italiano',   flag: '🇮🇹' },
  pl: { nativeName: 'Polski',     flag: '🇵🇱' },
  uk: { nativeName: 'Українська', flag: '🇺🇦' },
};
```

### 2. Translation Function (`src/i18n/t.ts`)

```typescript
// src/i18n/t.ts
import type { Locale } from './locales';
import { SUPPORTED_LOCALES } from './locales';

type Catalog = Record<string, string>;

// Catalogs are loaded lazily and cached
const catalogCache = new Map<Locale, Catalog>();

export function loadCatalog(locale: Locale): Catalog {
  if (catalogCache.has(locale)) return catalogCache.get(locale)!;
  // In Node.js (bot): dynamic require
  // In Next.js (mini app): handled by i18nProvider via import()
  const catalog = require(`./${locale}.json`) as Catalog;
  catalogCache.set(locale, catalog);
  return catalog;
}

export function getLocale(settings: Record<string, unknown>): Locale {
  const lang = settings?.language;
  if (typeof lang === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(lang)) {
    return lang as Locale;
  }
  return 'uk';
}

export function t(key: string, locale: Locale, vars?: Record<string, string>): string {
  const catalog = loadCatalog(locale);
  const fallback = loadCatalog('uk');
  let str = catalog[key] ?? fallback[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, v);
    }
  }
  return str;
}
```

### 3. Bot: Locale Middleware

The existing profile middleware in `webhook/route.ts` is extended to attach the locale:

```typescript
// In BotContext interface
interface BotContext extends Context {
  profile?: Profile;
  locale: Locale;  // NEW — always set after middleware
}

// In profile middleware
bot.use(async (ctx, next) => {
  const from = ctx.from;
  if (!from) return next();
  try {
    ctx.profile = await resolveOrCreateProfile(BigInt(from.id), from.username ?? '');
    ctx.locale = getLocale(ctx.profile.settings);  // NEW — zero extra DB reads
  } catch (err) { ... }
  return next();
});
```

### 4. Bot: Language Command Handler (`src/lib/bot/commands.ts`)

```typescript
// New handler
export async function handleLanguage(ctx: BotContext): Promise<void> {
  const keyboard = buildLanguageSelectorKeyboard();
  await ctx.reply(t('bot.language.prompt', ctx.locale), {
    reply_markup: keyboard,
  });
}

// Language selector keyboard (reused for /start first-run and /language)
export function buildLanguageSelectorKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  let col = 0;
  for (const locale of SUPPORTED_LOCALES) {
    const { nativeName, flag } = LOCALE_META[locale];
    kb.text(`${flag} ${nativeName}`, `lang:${locale}`);
    col++;
    if (col % 2 === 0) kb.row();
  }
  return kb;
}

// Callback handler extension (in handleCallbackQuery)
if (data.startsWith('lang:')) {
  const locale = data.slice(5) as Locale;
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  await updateProfileLanguage(ctx.profile!.id, locale);
  ctx.locale = locale;
  const { nativeName } = LOCALE_META[locale];
  await ctx.answerCallbackQuery();
  await ctx.reply(t('bot.language.changed', locale, { language: nativeName }));
  return;
}
```

### 5. Bot: First-Run Language Selection

`handleStart` is modified to check whether the user has a stored locale:

```typescript
export async function handleStart(ctx: BotContext): Promise<void> {
  const isFirstRun = !ctx.profile?.settings?.language;
  if (isFirstRun) {
    // Show language selector before welcome
    const keyboard = buildLanguageSelectorKeyboard();
    await ctx.reply(t('bot.language.prompt', 'uk'), {  // always uk for first message
      reply_markup: keyboard,
    });
    // Welcome is sent after the user taps a language button (in callback handler)
    return;
  }
  await sendWelcome(ctx);
}

async function sendWelcome(ctx: BotContext): Promise<void> {
  await ctx.reply(t('bot.welcome', ctx.locale), {
    parse_mode: 'MarkdownV2',
    reply_markup: miniappButton(ctx.locale),
  });
}
```

### 6. Bot: AI Prompt Language Injection

A helper injects the language instruction into every AI system prompt:

```typescript
// src/i18n/ai-locale.ts
export function aiLanguageInstruction(locale: Locale): string {
  const instructions: Record<Locale, string> = {
    en: 'Respond in English.',
    zh: '请用简体中文回复。',
    es: 'Responde en español.',
    hi: 'हिन्दी में जवाब दें।',
    ar: 'أجب باللغة العربية.',
    de: 'Antworte auf Deutsch.',
    fr: 'Réponds en français.',
    pt: 'Responda em português.',
    it: 'Rispondi in italiano.',
    pl: 'Odpowiadaj po polsku.',
    uk: 'Відповідай українською.',
  };
  return instructions[locale] ?? instructions.uk;
}
```

This instruction is prepended to the system prompts in:
- `buildSystemPrompt()` in `converse.ts`
- `RETRO_SYSTEM_PROMPT` in `retrospective.ts` (passed as a parameter)
- `RECOMMENDATION_SYSTEM_PROMPT` in `recommendations.ts` (passed as a parameter)

### 7. Mini App: i18n Provider (`src/lib/i18n/`)

```typescript
// src/lib/i18n/context.tsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Locale } from '@/i18n/locales';
import { SUPPORTED_LOCALES } from '@/i18n/locales';

interface I18nContextValue {
  locale: Locale;
  t: (key: string, vars?: Record<string, string>) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'uk',
  t: (key) => key,
  setLocale: () => {},
});

export function I18nProvider({ children, initialLocale }: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [catalog, setCatalog] = useState<Record<string, string>>({});
  const [fallback, setFallback] = useState<Record<string, string>>({});

  // Load catalogs
  useEffect(() => {
    import(`@/i18n/${locale}.json`).then(m => setCatalog(m.default));
  }, [locale]);

  useEffect(() => {
    import('@/i18n/uk.json').then(m => setFallback(m.default));
  }, []);

  // RTL support
  useEffect(() => {
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback((key: string, vars?: Record<string, string>): string => {
    let str = catalog[key] ?? fallback[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v);
    }
    return str;
  }, [catalog, fallback]);

  const setLocale = useCallback((newLocale: Locale) => {
    if (SUPPORTED_LOCALES.includes(newLocale)) setLocaleState(newLocale);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
```

The `I18nProvider` is added to `src/app/miniapp/layout.tsx`, wrapping the existing `AuthProvider`. The `initialLocale` is resolved from the profile settings fetched during auth.

### 8. Mini App: Settings Language Section

A new `LanguageSection` component is added to `src/app/miniapp/settings/page.tsx`:

```typescript
function LanguageSection() {
  const { locale, setLocale } = useI18n();
  const { accessToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticLocale, setOptimisticLocale] = useState(locale);

  const handleSelect = async (newLocale: Locale) => {
    const prev = optimisticLocale;
    setOptimisticLocale(newLocale);
    setLocale(newLocale);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ language: newLocale }),
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch {
      // Revert on failure
      setOptimisticLocale(prev);
      setLocale(prev);
      setError(t('miniapp.error.language_save_failed', locale));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('miniapp.settings.language', locale)}
      </p>
      <Card>
        <CardContent className="p-0">
          {SUPPORTED_LOCALES.map((loc, i) => {
            const { nativeName, flag } = LOCALE_META[loc];
            const isActive = loc === optimisticLocale;
            return (
              <React.Fragment key={loc}>
                {i > 0 && <Separator />}
                <button
                  onClick={() => handleSelect(loc)}
                  disabled={saving}
                  className="flex w-full items-center gap-3 px-4 py-3.5"
                >
                  <span className="text-xl">{flag}</span>
                  <span className="flex-1 text-left text-sm font-medium">{nativeName}</span>
                  {isActive && <Icon name="check" size={16} className="text-primary" />}
                </button>
              </React.Fragment>
            );
          })}
        </CardContent>
      </Card>
      {error && <p className="mt-2 px-1 text-xs text-destructive">{error}</p>}
    </section>
  );
}
```

### 9. Profile Settings API (`/api/profile/settings`)

A new PATCH endpoint is added (or the existing `/api/profile` PATCH is extended) to update `settings.language`:

```typescript
// src/app/api/profile/settings/route.ts
export async function PATCH(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) return unauthorized();

  const supabase = makeServiceClient();
  const { data: { user } } = await supabase.auth.getUser(jwt);
  if (!user) return unauthorized();

  const body = await req.json() as { language?: string };
  const { language } = body;

  if (!language || !SUPPORTED_LOCALES.includes(language as Locale)) {
    return new Response(JSON.stringify({ error: 'Invalid locale' }), { status: 400 });
  }

  // Merge into existing settings JSONB
  const telegramId = user.user_metadata?.telegram_id as string | undefined;
  const lookupColumn = telegramId ? 'telegram_id' : 'id';
  const lookupValue = telegramId ?? user.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, settings')
    .eq(lookupColumn, lookupValue)
    .single();

  if (!profile) return notFound();

  const newSettings = { ...(profile.settings as Record<string, unknown>), language };
  await supabase.from('profiles').update({ settings: newSettings }).eq('id', profile.id);

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
```

### 10. Onboarding Language Step

The `OnboardingOverlay` in `layout.tsx` is modified to show a language picker as the first step when `settings.language` is absent:

```typescript
// In OnboardingOverlay, before the slides
const [onboardingLocale, setOnboardingLocale] = useState<Locale | null>(
  initialLocale ?? null  // null = not yet chosen
);

if (!onboardingLocale) {
  return <OnboardingLanguagePicker onSelect={(loc) => {
    setOnboardingLocale(loc);
    setLocale(loc);  // immediately re-render slides in chosen locale
  }} />;
}
// ... rest of slides in onboardingLocale
```

---

## Data Models

### Profile Settings Extension

No schema migration is required. The `settings` JSONB column gains a new optional key:

```json
{
  "language": "en",
  "dashboard_widgets": [...],
  "custom_widgets": [...],
  "report_schedule": { ... },
  "pending_delete": { ... }
}
```

**Validation rules:**
- `language` must be one of the 11 supported BCP-47 tags, or absent/null
- Absent or null → treated as `"uk"` by `getLocale()`
- Invalid value → treated as `"uk"` by `getLocale()`

### Translation Catalog Schema

Each `src/i18n/<locale>.json` file is a flat JSON object:

```typescript
type TranslationCatalog = Record<string, string>;
```

Keys use dot-notation namespacing:
- `bot.*` — bot system messages
- `miniapp.tab.*` — tab bar labels
- `miniapp.settings.*` — settings page strings
- `miniapp.onboarding.*` — onboarding slide content
- `miniapp.error.*` — error messages
- `miniapp.dashboard.*` — dashboard labels
- `miniapp.empty.*` — empty state messages

Variable interpolation uses `{varName}` syntax: `"bot.language.changed": "✅ Language changed to {language}"`.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Locale round-trip persistence

*For any* Supported_Locale value written to `settings.language`, reading it back via `getLocale(settings)` SHALL return the same locale.

**Validates: Requirements 1.1**

---

### Property 2: Invalid locale falls back to `uk`

*For any* string that is not a member of the Supported_Locale set (including empty string, null-like values, and arbitrary Unicode), `getLocale({ language: value })` SHALL return `'uk'`.

**Validates: Requirements 1.4**

---

### Property 3: Language selector contains all eleven locales

*For any* invocation of `buildLanguageSelectorKeyboard()`, the resulting inline keyboard SHALL contain exactly eleven buttons, one for each Supported_Locale, with no duplicates.

**Validates: Requirements 2.2, 3.1**

---

### Property 4: Language button tap stores and acknowledges the chosen locale

*For any* Supported_Locale, when the corresponding language callback (`lang:<locale>`) is processed, `settings.language` SHALL be updated to that locale AND the acknowledgement message SHALL be rendered using the Translation_Catalog for that locale.

**Validates: Requirements 2.3, 3.2, 3.3**

---

### Property 5: System messages use the user's locale catalog

*For any* Supported_Locale and *for any* translation key in the bot catalog, `t(key, locale)` SHALL return the string from that locale's Translation_Catalog, falling back to the `uk` string if the key is absent in the target catalog.

**Validates: Requirements 5.1, 6.6**

---

### Property 6: AI system prompts contain a language instruction for the user's locale

*For any* Supported_Locale, the system prompt passed to Gemini (for conversational replies, retrospectives, and recommendations) SHALL contain the locale-specific language instruction returned by `aiLanguageInstruction(locale)`.

**Validates: Requirements 5.2, 5.3, 5.4**

---

### Property 7: i18n provider swaps catalog on locale change

*For any* pair of distinct Supported_Locales (fromLocale, toLocale), after calling `setLocale(toLocale)`, `t(key)` SHALL return strings from toLocale's catalog (or the `uk` fallback), not from fromLocale's catalog.

**Validates: Requirements 6.2, 4.3**

---

### Property 8: All locale catalogs have the same key set as the `uk` base catalog

*For any* Supported_Locale, the set of keys in its Translation_Catalog SHALL be equal to the set of keys in the `uk` Translation_Catalog.

**Validates: Requirements 8.2**

---

### Property 9: Translation catalog JSON round-trip

*For any* Supported_Locale, parsing its Translation_Catalog JSON file and re-serialising it SHALL produce a JSON string that, when parsed again, yields a deeply equal object.

**Validates: Requirements 8.5**

---

### Property 10: Language selector displays native names

*For any* Supported_Locale, the language selector (both bot keyboard and mini app list) SHALL display the locale's native name as defined in `LOCALE_META`, not a translated or English name.

**Validates: Requirements 9.1, 9.2**

---

## Error Handling

### Bot

| Scenario | Handling |
|---|---|
| `settings.language` absent or invalid | `getLocale()` returns `'uk'`; no error surfaced to user |
| Translation key missing in target locale | `t()` falls back to `uk` string; if also missing in `uk`, returns the key itself |
| Profile DB write fails on language update | Log error; reply with error message in current locale; do not update `ctx.locale` |
| Gemini AI call fails | Existing retry/fallback logic unchanged; language instruction is part of system prompt so no additional failure mode |
| Unknown `lang:*` callback data | Silently ignore; `answerCallbackQuery()` still called to dismiss loading state |

### Mini App

| Scenario | Handling |
|---|---|
| Profile API call fails on language save | Optimistic update is reverted; error message shown in current locale |
| Catalog JSON fails to load | Falls back to `uk` catalog; logs error to console |
| `initialLocale` not available at layout mount | Defaults to `'uk'`; locale is updated once profile is fetched |
| RTL direction change causes layout shift | Accepted; direction is set synchronously in `useEffect` before paint |

---

## Testing Strategy

### Unit Tests

Unit tests cover pure functions and logic that does not require external services:

- `getLocale(settings)` — valid locales, invalid locales, absent key, null value
- `t(key, locale, vars)` — key present, key absent (fallback), variable interpolation
- `buildLanguageSelectorKeyboard()` — button count, button labels, callback data format
- `aiLanguageInstruction(locale)` — returns non-empty string for all 11 locales
- Catalog key set equality — all 11 catalogs have the same keys as `uk`
- Catalog JSON round-trip — parse → stringify → parse produces equal object

### Property-Based Tests

Property-based tests use a PBT library (e.g., `fast-check` for TypeScript) with a minimum of 100 iterations per property. Each test is tagged with the design property it validates.

**Feature: bot-multilanguage, Property 1: Locale round-trip persistence**
Generate random Supported_Locale values; write to settings object; read back via `getLocale()`; assert equality.

**Feature: bot-multilanguage, Property 2: Invalid locale falls back to uk**
Generate arbitrary strings (including empty, whitespace, Unicode, very long strings); assert `getLocale({ language: value })` returns `'uk'` for all non-Supported_Locale inputs.

**Feature: bot-multilanguage, Property 3: Language selector contains all eleven locales**
Call `buildLanguageSelectorKeyboard()` multiple times; assert exactly 11 buttons, one per Supported_Locale, no duplicates.

**Feature: bot-multilanguage, Property 5: System messages use the user's locale catalog**
Generate random (key, locale) pairs from the catalog; assert `t(key, locale)` returns the catalog string or the `uk` fallback.

**Feature: bot-multilanguage, Property 8: All locale catalogs have the same key set**
For each Supported_Locale, compare its key set to `uk`; assert equality.

**Feature: bot-multilanguage, Property 9: Translation catalog JSON round-trip**
For each Supported_Locale, parse its JSON, stringify, parse again; assert deep equality.

### Integration Tests

Integration tests verify end-to-end behavior with real or mocked external dependencies:

- First-run `/start` flow: new user with no `settings.language` receives language selector before welcome
- Returning user `/start` flow: user with `settings.language` set skips language selector
- `/language` command: language selector is sent; callback updates DB and sends acknowledgement
- Mini app settings: locale selection calls API, UI re-renders in new locale, error reverts selection
- Onboarding: language picker shown as first step when locale absent; subsequent slides in chosen locale

### Smoke Tests

- All 11 `src/i18n/<locale>.json` files exist and are valid JSON
- `SUPPORTED_LOCALES` array contains exactly 11 entries
- `LOCALE_META` has an entry for every member of `SUPPORTED_LOCALES`
- Profile middleware attaches `ctx.locale` without additional DB reads (verified by query count assertion)
