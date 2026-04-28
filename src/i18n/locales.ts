export const SUPPORTED_LOCALES = ['en', 'zh', 'es', 'hi', 'ar', 'de', 'fr', 'pt', 'it', 'pl', 'uk'] as const;

export type Locale = typeof SUPPORTED_LOCALES[number];

export const LOCALE_META: Record<Locale, { nativeName: string; flag: string; rtl?: boolean }> = {
  en: { nativeName: 'English',     flag: '🇬🇧' },
  zh: { nativeName: '中文',         flag: '🇨🇳' },
  es: { nativeName: 'Español',     flag: '🇪🇸' },
  hi: { nativeName: 'हिन्दी',       flag: '🇮🇳' },
  ar: { nativeName: 'العربية',     flag: '🇸🇦', rtl: true },
  de: { nativeName: 'Deutsch',     flag: '🇩🇪' },
  fr: { nativeName: 'Français',    flag: '🇫🇷' },
  pt: { nativeName: 'Português',   flag: '🇧🇷' },
  it: { nativeName: 'Italiano',    flag: '🇮🇹' },
  pl: { nativeName: 'Polski',      flag: '🇵🇱' },
  uk: { nativeName: 'Українська',  flag: '🇺🇦' },
};
