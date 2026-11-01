import { useSyncExternalStore } from 'react';
import { getLocales } from 'expo-localization';
import en from './dicts/en.json';
import zh from './dicts/zh.json';
import es from './dicts/es.json';
import hi from './dicts/hi.json';
import ar from './dicts/ar.json';
import de from './dicts/de.json';
import fr from './dicts/fr.json';
import pt from './dicts/pt.json';
import it from './dicts/it.json';
import pl from './dicts/pl.json';
import uk from './dicts/uk.json';

/** Same eleven languages as the Mini App, in the same order. Names are shown in their own script. */
export const LOCALES = [
  { code: 'en', nativeName: 'English' },
  { code: 'zh', nativeName: '中文' },
  { code: 'es', nativeName: 'Español' },
  { code: 'hi', nativeName: 'हिन्दी' },
  { code: 'ar', nativeName: 'العربية' },
  { code: 'de', nativeName: 'Deutsch' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'pt', nativeName: 'Português' },
  { code: 'it', nativeName: 'Italiano' },
  { code: 'pl', nativeName: 'Polski' },
  { code: 'uk', nativeName: 'Українська' },
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];

type Dict = Record<string, string>;
const dictionaries: Record<LocaleCode, Dict> = { en, zh, es, hi, ar, de, fr, pt, it, pl, uk };

export const isLocale = (code: unknown): code is LocaleCode =>
  typeof code === 'string' && LOCALES.some((l) => l.code === code);

const deviceLocale = (): LocaleCode => {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return isLocale(code) ? code : 'en';
};

let current: LocaleCode = deviceLocale();
const listeners = new Set<() => void>();

export function getLocale(): LocaleCode {
  return current;
}

/** Changes the language and re-renders every component that calls useLocale(). */
export function setLocale(code: string): void {
  if (!isLocale(code) || code === current) return;
  current = code;
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** The active language. Components that show text should call it so a language change re-renders them. */
export function useLocale(): LocaleCode {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
}

/** Missing keys fall back to English, so a partly translated language still reads fully. */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = dictionaries[current][key] ?? en[key as keyof typeof en] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
