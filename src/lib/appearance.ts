/**
 * Appearance preferences shared with the native app (mobile/src/theme/theme.tsx):
 * text size and heading font. Theme (light, dark, system) is next-themes' choice.
 * Body text always uses the system font on every platform.
 */
export type TextScale = 'small' | 'medium' | 'large';
export type HeadingFont = 'sans' | 'serif' | 'mono';

export interface AppearancePrefs {
  textScale: TextScale;
  headingFont: HeadingFont;
}

export const TEXT_SCALES: TextScale[] = ['small', 'medium', 'large'];
export const HEADING_FONTS: HeadingFont[] = ['sans', 'serif', 'mono'];

export const DEFAULT_PREFS: AppearancePrefs = { textScale: 'medium', headingFont: 'sans' };

const KEY = 'memo.appearance';

const isOneOf = <T extends string>(value: unknown, options: readonly T[]): value is T =>
  typeof value === 'string' && (options as readonly string[]).includes(value);

/** Stored prefs, or defaults. Storage can be blocked (private mode), so every access is guarded. */
export function readAppearance(): AppearancePrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<AppearancePrefs>;
    return {
      textScale: isOneOf(parsed.textScale, TEXT_SCALES) ? parsed.textScale : DEFAULT_PREFS.textScale,
      headingFont: isOneOf(parsed.headingFont, HEADING_FONTS) ? parsed.headingFont : DEFAULT_PREFS.headingFont,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Writes the prefs and applies them to <html>. Only the storage write may fail silently. */
export function writeAppearance(prefs: AppearancePrefs): void {
  applyAppearance(prefs);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable: the choice still applies for this visit.
  }
}

export function applyAppearance(prefs: AppearancePrefs): void {
  const root = document.documentElement;
  root.dataset.textScale = prefs.textScale;
  root.dataset.headingFont = prefs.headingFont;
}
