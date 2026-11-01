'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { applyAppearance, readAppearance } from '@/lib/appearance';

export { useTheme } from 'next-themes';

type Forced = 'light' | 'dark' | undefined;
const ForcedSetter = createContext<(t: Forced) => void>(() => {});

/** Lets the Telegram bridge apply Telegram's scheme without touching the stored choice. */
export const useSetForcedTheme = () => useContext(ForcedSetter);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [forced, setForced] = useState<Forced>();

  // Text size and heading font apply on every page, not only on Settings.
  useEffect(() => applyAppearance(readAppearance()), []);
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange forcedTheme={forced}>
      <ForcedSetter.Provider value={setForced}>{children}</ForcedSetter.Provider>
    </NextThemesProvider>
  );
}
