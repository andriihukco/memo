import type { Locale } from './locales';
import { SUPPORTED_LOCALES } from './locales';

type Catalog = Record<string, string>;

// Module-level cache for loaded catalogs
const catalogCache = new Map<Locale, Catalog>();

/**
 * Loads and caches the JSON translation catalog for the given locale.
 * Uses Node.js require() for dynamic loading.
 */
export function loadCatalog(locale: Locale): Catalog {
  if (catalogCache.has(locale)) return catalogCache.get(locale)!;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const catalog = require(`./${locale}.json`) as Catalog;
  catalogCache.set(locale, catalog);
  return catalog;
}

/**
 * Reads settings?.language, validates it's a Supported_Locale,
 * returns 'en' as fallback for any invalid/absent value.
 */
export function getLocale(settings: Record<string, unknown> | null | undefined): Locale {
  const lang = settings?.language;
  if (typeof lang === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(lang)) {
    return lang as Locale;
  }
  return 'en';
}

/**
 * Looks up key in locale catalog, falls back to uk catalog, falls back to key itself.
 * Supports {varName} interpolation.
 */
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
