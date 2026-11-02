import { useSyncExternalStore } from 'react';

/**
 * The app-wide font choice. It applies to every line of text, not only headings:
 * Text and TextInput (src/theme/typography.tsx) read it through useSyncExternalStore, so a change
 * re-renders all text at once. Set by the theme provider when the saved choice loads or changes.
 */
export type AppFont = 'sans' | 'serif' | 'mono';

let current: AppFont = 'sans';
const listeners = new Set<() => void>();

export function setAppFont(font: AppFont): void {
  if (font === current) return;
  current = font;
  listeners.forEach((notify) => notify());
}

export function getAppFont(): AppFont {
  return current;
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** Current font; components that draw text call this so they re-render on change. */
export function useAppFont(): AppFont {
  return useSyncExternalStore(subscribe, getAppFont, getAppFont);
}
