import { getLocales } from 'expo-localization';
import en from './en.json';
import uk from './uk.json';

type Dict = Record<string, string>;
const dictionaries: Record<string, Dict> = { en, uk };

const deviceLocale = (): string => {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return code in dictionaries ? code : 'en';
};

/** Active language. Starts from the device, changed by onboarding's language step. */
export let locale: string = deviceLocale();

export function setLocale(code: string): void {
  if (code in dictionaries) locale = code;
}

/** Same keys as the Mini App; {name} placeholders are filled from params. */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = dictionaries[locale][key] ?? en[key as keyof typeof en] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
