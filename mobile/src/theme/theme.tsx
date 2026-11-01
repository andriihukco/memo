import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { palettes, resolveScheme, scaleFontSize, THEME_CHOICES, type Palette, type Scheme, type ThemeChoice, type TextScale } from './palettes';

export type { Palette, Scheme, ThemeChoice, TextScale } from './palettes';

export type HeadingFont = 'sans' | 'serif' | 'mono';

export const TEXT_SCALES: TextScale[] = ['small', 'medium', 'large'];
export const HEADING_FONTS: HeadingFont[] = ['sans', 'serif', 'mono'];

/** Body text always uses the system font. Only headings take the family chosen here. */
const HEADING_FAMILY: Record<HeadingFont, string | undefined> = {
  sans: undefined,
  serif: Platform.select({ ios: 'Georgia', default: 'serif' }),
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
};

/** Colour palette plus typography settings. Styles read both through this object. */
export type Theme = Palette & {
  /** Scales a design font size by the user's text size. */
  fs: (size: number) => number;
  /** Font family for headings (Text with accessibilityRole="header"). Undefined keeps the system font. */
  heading: string | undefined;
};

interface ThemeValue {
  choice: ThemeChoice;
  scheme: Scheme;
  palette: Theme;
  textScale: TextScale;
  headingFont: HeadingFont;
  setChoice: (choice: ThemeChoice) => void;
  setTextScale: (scale: TextScale) => void;
  setHeadingFont: (font: HeadingFont) => void;
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
  const [headingFont, setHeadingFont] = useStoredChoice<HeadingFont>(FONT_KEY, HEADING_FONTS, 'sans');

  const value = useMemo<ThemeValue>(() => {
    const scheme = resolveScheme(choice, system);
    return {
      choice,
      scheme,
      palette: {
        ...palettes[scheme],
        fs: (size) => scaleFontSize(size, textScale),
        heading: HEADING_FAMILY[headingFont],
      },
      textScale,
      headingFont,
      setChoice,
      setTextScale,
      setHeadingFont,
    };
  }, [choice, system, textScale, headingFont, setChoice, setTextScale, setHeadingFont]);

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
