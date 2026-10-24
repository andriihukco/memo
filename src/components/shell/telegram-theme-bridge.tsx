'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme, useSetForcedTheme } from '@/lib/theme-provider';
import { useAuth } from '@/lib/supabase/auth-context';
import { resolveTelegramTheme, tg, type Scheme, type ThemeChoice } from '@/lib/telegram';

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
  const userChanged = useRef(false);

  const [tgScheme, setTgScheme] = useState<Scheme | undefined>();
  const forced = resolveTelegramTheme(choice, tgScheme) ?? undefined;
  // resolvedTheme ignores forcedTheme in next-themes, so derive the effective theme here.
  const effective = forced ?? resolvedTheme;

  // Track Telegram's scheme; 'system' follows it, explicit choices always win (see forced above).
  useEffect(() => {
    const w = tg();
    const read = () => setTgScheme(tg()?.colorScheme);
    read();
    w?.onEvent('themeChanged', read);
    return () => w?.offEvent('themeChanged', read);
  }, []);
  useEffect(() => setForced(forced), [forced, setForced]);

  // Chrome colours follow the applied theme. rAF: the provider applies the class in its own effect, after ours.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
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
    });
    return () => cancelAnimationFrame(id);
  }, [effective]);

  // Read the profile once; adopt its theme without echoing it back.
  useEffect(() => {
    if (!accessToken || synced.current) return;
    synced.current = true;
    fetch('/api/profile/settings', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (isChoice(p?.theme) && !userChanged.current) {
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
    userChanged.current = true;
    if (!accessToken) return;
    fetch('/api/profile/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ theme: choice }),
    }).catch(() => {});
  }, [theme, choice, accessToken]);

  return null;
}
