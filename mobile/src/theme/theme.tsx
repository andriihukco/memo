import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { palettes, resolveScheme, THEME_CHOICES, type Palette, type Scheme, type ThemeChoice } from './palettes';

export type { Palette, Scheme, ThemeChoice } from './palettes';

const THEME_KEY = 'memo.theme';

interface ThemeValue {
  choice: ThemeChoice;
  scheme: Scheme;
  palette: Palette;
  setChoice: (choice: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

const isChoice = (value: string | null): value is ThemeChoice => THEME_CHOICES.includes(value as ThemeChoice);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>('system');

  // Restore the saved choice once. A failed read keeps 'system'.
  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY)
      .then((saved) => {
        if (isChoice(saved)) setChoiceState(saved);
      })
      .catch(() => undefined);
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const scheme = resolveScheme(choice, system);
    return {
      choice,
      scheme,
      palette: palettes[scheme],
      setChoice: (next) => {
        setChoiceState(next);
        SecureStore.setItemAsync(THEME_KEY, next).catch(() => undefined);
      },
    };
  }, [choice, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}

/**
 * Palette plus styles built from it. Pass a module-level factory so the
 * result is memoised per palette: `const { colors, styles } = useThemed(makeStyles);`
 */
export function useThemed<T>(makeStyles: (colors: Palette) => T): { colors: Palette; styles: T } {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [makeStyles, palette]);
  return { colors: palette, styles };
}
