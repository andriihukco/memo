/**
 * Colour tokens for the native app. Values are the web palette in
 * src/app/globals.css, converted from HSL to hex. Mapping is listed in
 * docs/design/tokens/color-map.json. Every value is checked for WCAG AA
 * contrast in src/theme/__tests__/palettes.test.ts.
 */
export const palettes = {
  dark: {
    bg: '#09090B', // --background
    card: '#131316', // --card
    label: '#FAFAFA', // --foreground
    secondary: '#FAFAFA', // --secondary-foreground
    muted: '#A4A4AD', // --muted-foreground
    separator: '#27272A', // --border
    tint: '#7885F7', // --primary
    tintFill: '#7885F7', // --primary (web pairs it with dark text)
    onTint: '#09090B', // --primary-foreground
    glass: 'rgba(19,19,22,0.8)', // --glass-bg
    glassBorder: 'rgba(61,61,66,0.3)', // --glass-border
    destructive: '#F15F5F', // --destructive
    gold: '#F6A823', // --warning
  },
  /** Sepia: paper background and brown ink. Values match the web :root tokens in src/app/globals.css. */
  light: {
    bg: '#F4ECD8',
    card: '#FBF6E9',
    label: '#3B2F20',
    secondary: '#4F3F2B',
    muted: '#6B5A44',
    separator: '#D9CBAE',
    tint: '#7A4A1E',
    tintFill: '#7A4A1E',
    onTint: '#FFFFFF',
    glass: 'rgba(251,246,233,0.85)',
    glassBorder: 'rgba(59,47,32,0.12)',
    destructive: '#A3321E',
    gold: '#8A5A00',
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

export type TextScale = 'small' | 'medium' | 'large';

/** Web uses the same steps: html font-size 90% / 100% / 115% (src/app/globals.css). */
export const TEXT_SCALE_FACTOR: Record<TextScale, number> = { small: 0.9, medium: 1, large: 1.15 };

export function scaleFontSize(size: number, scale: TextScale): number {
  return Math.round(size * TEXT_SCALE_FACTOR[scale]);
}
