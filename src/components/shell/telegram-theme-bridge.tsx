'use client';

import { useEffect, useRef } from 'react';
import { useTheme, useSetForcedTheme } from '@/lib/theme-provider';
import { useAuth } from '@/lib/supabase/auth-context';
import { resolveTelegramTheme, tg, type ThemeChoice } from '@/lib/telegram';

const isChoice = (v: unknown): v is ThemeChoice => v === 'light' || v === 'dark' || v === 'system';

function hslToHex(triplet: string): string {
  const [h, s, l] = triplet.match(/[\d.]+/g)!.map(Number);
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function TelegramThemeBridge() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const setForced = useSetForcedTheme();
  const { accessToken } = useAuth();
  const choice: ThemeChoice = isChoice(theme) ? theme : 'system';
  const lastChoice = useRef<ThemeChoice | undefined>(undefined);
  const synced = useRef(false);

  // Force Telegram's scheme only while the stored choice is 'system'; explicit choices always win.
  useEffect(() => {
    const apply = () => setForced(resolveTelegramTheme(choice, tg()?.colorScheme) ?? undefined);
    apply();
    const w = tg();
    w?.onEvent('themeChanged', apply);
    return () => w?.offEvent('themeChanged', apply);
  }, [choice, setForced]);

  // Chrome colours follow the applied theme.
  useEffect(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
    if (!raw) return;
    const hex = hslToHex(raw);
    tg()?.setHeaderColor(hex);
    tg()?.setBackgroundColor(hex);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = hex;
    document.head.appendChild(meta);
  }, [resolvedTheme]);

  // Read the profile once; adopt its theme without echoing it back.
  useEffect(() => {
    if (!accessToken || synced.current) return;
    synced.current = true;
    fetch('/api/profile/settings', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (isChoice(p?.theme)) {
          lastChoice.current = p.theme;
          setTheme(p.theme);
        }
      })
      .catch(() => {});
  }, [accessToken, setTheme]);

  // PATCH only when the user changes the choice (not on mount or profile adoption).
  useEffect(() => {
    if (!isChoice(theme)) return;
    if (lastChoice.current === undefined) lastChoice.current = choice;
    if (choice === lastChoice.current) return;
    lastChoice.current = choice;
    if (!accessToken) return;
    fetch('/api/profile/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ theme: choice }),
    }).catch(() => {});
  }, [theme, choice, accessToken]);

  return null;
}
