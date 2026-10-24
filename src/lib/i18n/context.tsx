'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Locale } from '@/i18n/locales';
import { SUPPORTED_LOCALES } from '@/i18n/locales';

type Catalog = Record<string, string>;

interface I18nContextValue {
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
  tp: (key: string, count: number, vars?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'uk',
  t: (key) => key,
  tp: (key) => key,
  setLocale: () => {},
});

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [catalog, setCatalog] = useState<Catalog>({});
  const [fallback, setFallback] = useState<Catalog>({});

  // Sync locale when initialLocale changes (e.g. after async profile load)
  useEffect(() => {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(initialLocale)) {
      setLocaleState(initialLocale);
    }
  }, [initialLocale]);

  // Load the active locale catalog whenever locale changes
  useEffect(() => {
    import(`@/i18n/${locale}.json`)
      .then((m) => setCatalog(m.default as Catalog))
      .catch(() => setCatalog({}));
  }, [locale]);

  // Load the uk fallback catalog once
  useEffect(() => {
    import('@/i18n/uk.json')
      .then((m) => setFallback(m.default as Catalog))
      .catch(() => setFallback({}));
  }, []);

  // RTL + lang attribute
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      let str = catalog[key] ?? fallback[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replaceAll(`{${k}}`, String(v));
        }
      }
      return str;
    },
    [catalog, fallback]
  );

  const tp = useCallback(
    (key: string, count: number, vars?: Record<string, string | number>): string => {
      const form = new Intl.PluralRules(locale).select(count);
      const k = `${key}.${form}`;
      const found = (catalog[k] ?? fallback[k]) ? k : `${key}.other`;
      return t(found, { count, ...vars });
    },
    [locale, catalog, fallback, t]
  );

  const setLocale = useCallback((newLocale: Locale) => {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(newLocale)) {
      setLocaleState(newLocale);
    }
  }, []);

  return (
    <I18nContext.Provider value={{ locale, t, tp, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
