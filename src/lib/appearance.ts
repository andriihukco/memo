/**
 * Appearance preferences shared with the native app (mobile/src/theme/theme.tsx):
 * text size and the app font. The font applies to all text, headings and body alike.
 * Theme (light, dark, system) is next-themes' choice.
 */
export type TextScale = 'small' | 'medium' | 'large';
export type AppFont = 'sans' | 'serif' | 'mono';

export interface AppearancePrefs {
  textScale: TextScale;
  font: AppFont;
}

export const TEXT_SCALES: TextScale[] = ['small', 'medium', 'large'];
export const APP_FONTS: AppFont[] = ['sans', 'serif', 'mono'];

export const DEFAULT_PREFS: AppearancePrefs = { textScale: 'medium', font: 'sans' };

const KEY = 'memo.appearance';

const isOneOf = <T extends string>(value: unknown, options: readonly T[]): value is T =>
  typeof value === 'string' && (options as readonly string[]).includes(value);

/** Stored prefs, or defaults. Storage can be blocked (private mode), so every access is guarded. */
export function readAppearance(): AppearancePrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    // Older saves stored the heading font under headingFont; it is the same choice.
    const parsed = JSON.parse(raw) as Partial<AppearancePrefs> & { headingFont?: unknown };
    const font = parsed.font ?? parsed.headingFont;
    return {
      textScale: isOneOf(parsed.textScale, TEXT_SCALES) ? parsed.textScale : DEFAULT_PREFS.textScale,
      font: isOneOf(font, APP_FONTS) ? font : DEFAULT_PREFS.font,
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
  root.dataset.font = prefs.font;
}
