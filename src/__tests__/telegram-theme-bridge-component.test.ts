// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, waitFor, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  state: { theme: 'system', resolvedTheme: 'light' } as { theme: string; resolvedTheme: string },
  setTheme: vi.fn(),
  setForced: vi.fn(),
}));

vi.mock('@/lib/supabase/auth-context', () => ({ useAuth: () => ({ accessToken: 'tok' }) }));
vi.mock('@/lib/theme-provider', () => ({
  useTheme: () => ({ ...h.state, setTheme: h.setTheme }),
  useSetForcedTheme: () => h.setForced,
}));

import { TelegramThemeBridge } from '@/components/shell/telegram-theme-bridge';

const LIGHT_BG = '0 0% 100%'; // #ffffff
const DARK_BG = '0 0% 0%'; // #000000

let fetchMock: ReturnType<typeof vi.fn>;
let handlers: Record<string, () => void>;
let webApp: { colorScheme: string; setHeaderColor: ReturnType<typeof vi.fn>; setBackgroundColor: ReturnType<typeof vi.fn> };

// Mimic next-themes: apply the forced/effective class and the matching --background.
function applyClass(scheme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', scheme === 'dark');
  document.documentElement.style.setProperty('--background', scheme === 'dark' ? DARK_BG : LIGHT_BG);
}
const patches = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');

beforeEach(() => {
  handlers = {};
  webApp = { colorScheme: 'dark', setHeaderColor: vi.fn(), setBackgroundColor: vi.fn() };
  Object.assign(webApp, {
    onEvent: (e: string, cb: () => void) => (handlers[e] = cb),
    offEvent: vi.fn(),
  });
  (window as unknown as { Telegram: unknown }).Telegram = { WebApp: webApp };
  h.state = { theme: 'system', resolvedTheme: 'light' };
  h.setTheme.mockReset();
  h.setForced.mockReset().mockImplementation((t?: 'light' | 'dark') => applyClass(t ?? 'light'));
  applyClass('light');
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ theme: 'dark' }) });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  delete (window as unknown as { Telegram?: unknown }).Telegram;
  vi.unstubAllGlobals();
});

describe('TelegramThemeBridge', () => {
  it('does not PATCH on mount or when adopting the profile theme', async () => {
    render(createElement(TelegramThemeBridge));
    await waitFor(() => expect(h.setTheme).toHaveBeenCalledWith('dark'));
    expect(patches()).toHaveLength(0);
  });

  it('PATCHes on an explicit user change', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const { rerender } = render(createElement(TelegramThemeBridge));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    h.state = { theme: 'dark', resolvedTheme: 'dark' };
    rerender(createElement(TelegramThemeBridge));
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(JSON.parse(patches()[0][1].body)).toEqual({ theme: 'dark' });
  });

  it('a late profile response does not overwrite a user change', async () => {
    let resolve!: (v: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const { rerender } = render(createElement(TelegramThemeBridge));
    h.state = { theme: 'light', resolvedTheme: 'light' };
    rerender(createElement(TelegramThemeBridge));
    await act(async () => resolve({ ok: true, json: async () => ({ theme: 'dark' }) }));
    expect(h.setTheme).not.toHaveBeenCalled();
  });

  it("'system' + Telegram dark forces dark and paints the dark background", async () => {
    render(createElement(TelegramThemeBridge));
    await waitFor(() => expect(h.setForced).toHaveBeenLastCalledWith('dark'));
    await waitFor(() => expect(webApp.setHeaderColor).toHaveBeenLastCalledWith('#000000'));
    expect(webApp.setBackgroundColor).toHaveBeenLastCalledWith('#000000');
  });

  it('explicit light stays light when Telegram fires themeChanged to dark', async () => {
    h.state = { theme: 'light', resolvedTheme: 'light' };
    render(createElement(TelegramThemeBridge));
    webApp.colorScheme = 'dark';
    act(() => handlers.themeChanged());
    expect(h.setForced).toHaveBeenLastCalledWith('light');
    await waitFor(() => expect(webApp.setHeaderColor).toHaveBeenLastCalledWith('#ffffff'));
  });
});
