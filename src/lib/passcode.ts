// Passcode settings stored in localStorage

export const PASSCODE_KEY = 'memo_passcode_hash';
export const LOCK_TIMER_KEY = 'memo_lock_timer'; // minutes: 0 = immediately, -1 = never
export const LAST_ACTIVE_KEY = 'memo_last_active';

export type LockTimer = 0 | 1 | 5 | 15 | 60;

export const LOCK_TIMER_LABELS: Record<LockTimer, string> = {
  0:  'Одразу',
  1:  'Через 1 хв',
  5:  'Через 5 хв',
  15: 'Через 15 хв',
  60: 'Через 1 год',
};

export function getPasscodeHash(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PASSCODE_KEY);
}

export function setPasscodeHash(hash: string): void {
  localStorage.setItem(PASSCODE_KEY, hash);
}

export function removePasscode(): void {
  localStorage.removeItem(PASSCODE_KEY);
  localStorage.removeItem(LOCK_TIMER_KEY);
  localStorage.removeItem(LAST_ACTIVE_KEY);
}

export function getLockTimer(): LockTimer {
  if (typeof window === 'undefined') return 0;
  const v = localStorage.getItem(LOCK_TIMER_KEY);
  return v !== null ? (parseInt(v) as LockTimer) : 0;
}

export function setLockTimer(minutes: LockTimer): void {
  localStorage.setItem(LOCK_TIMER_KEY, String(minutes));
}

export function touchLastActive(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
}

export function shouldLock(): boolean {
  const hash = getPasscodeHash();
  if (!hash) return false;

  const timer = getLockTimer();
  if (timer === 0) return true; // always lock on open

  const last = localStorage.getItem(LAST_ACTIVE_KEY);
  if (!last) return true;

  const elapsed = (Date.now() - parseInt(last)) / 1000 / 60; // minutes
  return elapsed >= timer;
}
