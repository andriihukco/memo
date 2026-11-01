/**
 * Colour tokens for the native app. Dark matches the Mini App dark theme,
 * light matches its light theme (web: src/app/globals.css). Every value is
 * checked for WCAG AA contrast in src/theme/__tests__/palettes.test.ts.
 */
export const palettes = {
  dark: {
    bg: '#090B12',
    card: '#131722',
    label: '#F4F5F8',
    secondary: '#B4BBCB',
    muted: '#7D889F',
    separator: '#222838',
    tint: '#4C8DFF',
    onTint: '#FFFFFF',
    destructive: '#F87171',
    gold: '#FACC15',
  },
  light: {
    bg: '#F2F3F7',
    card: '#FFFFFF',
    label: '#0B0D14',
    secondary: '#4A5268',
    muted: '#5B6478',
    separator: '#D9DDE7',
    tint: '#1D4ED8',
    onTint: '#FFFFFF',
    destructive: '#B91C1C',
    gold: '#92400E',
  },
} as const;

export type Palette = { readonly [K in keyof typeof palettes.dark]: string };
export type Scheme = keyof typeof palettes;
export type ThemeChoice = Scheme | 'system';

export const THEME_CHOICES: ThemeChoice[] = ['system', 'light', 'dark'];

/** 'system' follows the device; an unknown device value falls back to dark, the app's original look. */
export function resolveScheme(choice: ThemeChoice, system: string | null | undefined): Scheme {
  if (choice !== 'system') return choice;
  return system === 'light' ? 'light' : 'dark';
}
