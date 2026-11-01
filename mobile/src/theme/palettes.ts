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
  light: {
    bg: '#FFFFFF', // --background
    card: '#FFFFFF', // --card
    label: '#09090B', // --foreground
    secondary: '#18181B', // --secondary-foreground
    muted: '#5D5D65', // --muted-foreground
    separator: '#E4E4E7', // --border
    tint: '#3948D0', // --primary
    tintFill: '#3948D0', // --primary
    onTint: '#FFFFFF', // --primary-foreground
    glass: 'rgba(255,255,255,0.8)', // --glass-bg
    glassBorder: 'rgba(228,228,231,0.3)', // --glass-border
    destructive: '#C52020', // --destructive
    gold: '#954D04', // --warning
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
