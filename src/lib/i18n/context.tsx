'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Locale } from '@/i18n/locales';
import { SUPPORTED_LOCALES } from '@/i18n/locales';

type Catalog = Record<string, string>;

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
    (key: string, vars?: Record<string, string>): string => {
      let str = catalog[key] ?? fallback[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(`{${k}}`, v);
        }
      }
      return str;
    },
    [catalog, fallback]
  );

  const setLocale = useCallback((newLocale: Locale) => {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(newLocale)) {
      setLocaleState(newLocale);
    }
  }, []);

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
