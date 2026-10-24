import { describe, it, expect } from 'vitest';
import en from '@/i18n/en.json';
import uk from '@/i18n/uk.json';

const diff = (a: object, b: object) => Object.keys(a).filter((k) => !(k in b));

describe('i18n parity', () => {
  it('every en key exists in uk', () => expect(diff(en, uk)).toEqual([]));
  it('every uk key exists in en', () => expect(diff(uk, en)).toEqual([]));
  for (const l of ['ar', 'de', 'es', 'fr', 'hi', 'it', 'pl', 'pt', 'zh']) {
    it.todo(`${l} has every en key (enabled in Phase 2)`);
  }
});
