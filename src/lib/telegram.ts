export type Scheme = 'light' | 'dark';
export type ThemeChoice = Scheme | 'system';

export interface TelegramWebApp {
  colorScheme: Scheme;
  themeParams: Record<string, string | undefined>;
  initDataUnsafe: { user?: { id: number; language_code?: string } };
  ready(): void;
  expand(): void;
  onEvent(event: string, cb: () => void): void;
  offEvent(event: string, cb: () => void): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  disableVerticalSwipes?(): void;
  enableVerticalSwipes?(): void;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback: {
    impactOccurred(style: string): void;
    notificationOccurred(type: string): void;
    selectionChanged(): void;
  };
}

export function tg(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null;
}

/** null = no override, let next-themes follow the OS. */
export function resolveTelegramTheme(choice: ThemeChoice, tgScheme: Scheme | undefined): Scheme | null {
  if (choice !== 'system') return choice;
  return tgScheme ?? null;
}

/** Stops Telegram's swipe-down-to-close from fighting a sheet's drag. */
export function withVerticalSwipesDisabled(open: boolean): void {
  const w = tg();
  if (open) w?.disableVerticalSwipes?.();
  else w?.enableVerticalSwipes?.();
}
