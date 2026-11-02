import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { palettes, resolveScheme, scaleFontSize, THEME_CHOICES, type Palette, type Scheme, type ThemeChoice, type TextScale } from './palettes';
import { setAppFont } from './font-store';

export type { Palette, Scheme, ThemeChoice, TextScale } from './palettes';

export type AppFont = 'sans' | 'serif' | 'mono';

export const TEXT_SCALES: TextScale[] = ['small', 'medium', 'large'];
/** The app font applies to all text on the web and native apps, not only headings. */
export const APP_FONTS: AppFont[] = ['sans', 'serif', 'mono'];

/** Family for the chosen font, kept on the theme for screens that name a family. Text applies it itself. */
const FAMILY: Record<AppFont, string | undefined> = {
  sans: undefined,
  serif: Platform.select({ ios: 'Georgia', default: 'serif' }),
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
};

/** Colour palette plus typography settings. Styles read both through this object. */
export type Theme = Palette & {
  /** Scales a design font size by the user's text size. */
  fs: (size: number) => number;
  /** Family of the app font. Undefined for sans, which uses Commissioner through Text. */
  heading: string | undefined;
};

interface ThemeValue {
  choice: ThemeChoice;
  scheme: Scheme;
  palette: Theme;
  textScale: TextScale;
  font: AppFont;
  setChoice: (choice: ThemeChoice) => void;
  setTextScale: (scale: TextScale) => void;
  setFont: (font: AppFont) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

const THEME_KEY = 'memo.theme';
const SCALE_KEY = 'memo.text_scale';
const FONT_KEY = 'memo.heading_font';

const isOneOf = <T extends string>(value: string | null, options: readonly T[]): value is T =>
  options.includes(value as T);

/** Saved preference, or the default. A failed read keeps the default. */
function useStoredChoice<T extends string>(key: string, options: readonly T[], fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    SecureStore.getItemAsync(key)
      .then((saved) => {
        if (isOneOf(saved, options)) setValue(saved);
      })
      .catch(() => undefined);
  }, [key, options]);
  const save = useCallback(
    (next: T) => {
      setValue(next);
      SecureStore.setItemAsync(key, next).catch(() => undefined);
    },
    [key],
  );
  return [value, save] as const;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [choice, setChoice] = useStoredChoice<ThemeChoice>(THEME_KEY, THEME_CHOICES, 'system');
  const [textScale, setTextScale] = useStoredChoice<TextScale>(SCALE_KEY, TEXT_SCALES, 'medium');
  const [font, setFont] = useStoredChoice<AppFont>(FONT_KEY, APP_FONTS, 'sans');

  // Every Text reads the app font from the store, so a change re-renders all text at once.
  useEffect(() => setAppFont(font), [font]);

  const value = useMemo<ThemeValue>(() => {
    const scheme = resolveScheme(choice, system);
    return {
      choice,
      scheme,
      palette: {
        ...palettes[scheme],
        fs: (size) => scaleFontSize(size, textScale),
        heading: FAMILY[font],
      },
      textScale,
      font,
      setChoice,
      setTextScale,
      setFont,
    };
  }, [choice, system, textScale, font, setChoice, setTextScale, setFont]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}

/**
 * Theme plus styles built from it. Pass a module-level factory so the
 * result is memoised per theme: `const { colors, styles } = useThemed(makeStyles);`
 */
export function useThemed<T>(makeStyles: (colors: Theme) => T): { colors: Theme; styles: T } {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [makeStyles, palette]);
  return { colors: palette, styles };
}
