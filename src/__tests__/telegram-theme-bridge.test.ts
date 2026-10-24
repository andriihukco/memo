import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveTelegramTheme, withVerticalSwipesDisabled, tg } from '@/lib/telegram';

describe('resolveTelegramTheme', () => {
  it('explicit light/dark is never overridden by Telegram', () => {
    expect(resolveTelegramTheme('light', 'dark')).toBe('light');
    expect(resolveTelegramTheme('dark', 'light')).toBe('dark');
  });
  it('system follows Telegram when present', () => {
    expect(resolveTelegramTheme('system', 'dark')).toBe('dark');
    expect(resolveTelegramTheme('system', 'light')).toBe('light');
  });
  it('system without Telegram defers to the OS', () => {
    expect(resolveTelegramTheme('system', undefined)).toBeNull();
  });
});

describe('withVerticalSwipesDisabled', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is a no-op outside Telegram', () => {
    expect(tg()).toBeNull();
    expect(() => withVerticalSwipesDisabled(true)).not.toThrow();
  });
  it('toggles the Telegram swipe lock', () => {
    const WebApp = { disableVerticalSwipes: vi.fn(), enableVerticalSwipes: vi.fn() };
    vi.stubGlobal('window', { Telegram: { WebApp } });
    withVerticalSwipesDisabled(true);
    expect(WebApp.disableVerticalSwipes).toHaveBeenCalledOnce();
    withVerticalSwipesDisabled(false);
    expect(WebApp.enableVerticalSwipes).toHaveBeenCalledOnce();
  });
});
