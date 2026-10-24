// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { I18nProvider, useI18n } from '@/lib/i18n/context';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider initialLocale="uk">{children}</I18nProvider>
);

describe('i18n tp', () => {
  it('picks uk plural forms', async () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    await waitFor(() => expect(result.current.tp('journal.entries', 1)).toBe('1 запис'));
    expect(result.current.tp('journal.entries', 3)).toBe('3 записи');
    expect(result.current.tp('journal.entries', 5)).toBe('5 записів');
  });

  it('interpolates every occurrence of a var', async () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    // missing key returns the key itself, so vars apply to it
    await waitFor(() => expect(result.current.tp('journal.entries', 5)).toBe('5 записів'));
    expect(result.current.t('{a}-{a}', { a: 'x' })).toBe('x-x');
  });
});
