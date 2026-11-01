import { describe, expect, it, vi } from 'vitest';
import en from '../dicts/en.json';
import de from '../dicts/de.json';
import { LOCALES, getLocale, setLocale, t } from '../index';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

describe('i18n', () => {
  it('ships every locale the Mini App supports, in the same order', () => {
    expect(LOCALES.map((l) => l.code)).toEqual(['en', 'zh', 'es', 'hi', 'ar', 'de', 'fr', 'pt', 'it', 'pl', 'uk']);
  });

  it('switches language and translates', () => {
    setLocale('de');
    expect(getLocale()).toBe('de');
    expect(t('goals.title')).toBe(de['goals.title']);
    setLocale('en');
    expect(t('goals.title')).toBe(en['goals.title']);
  });

  it('falls back to English for a key a language has not translated yet', () => {
    const missing = Object.keys(en).find((k) => !(k in de));
    expect(missing).toBeDefined();
    setLocale('de');
    expect(t(missing!)).toBe(en[missing as keyof typeof en]);
    setLocale('en');
  });

  it('ignores unknown language codes', () => {
    setLocale('xx');
    expect(getLocale()).toBe('en');
  });

  it('fills parameters and leaves unknown keys readable', () => {
    expect(t('goals.streak', { days: 3 })).toContain('3');
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
});
