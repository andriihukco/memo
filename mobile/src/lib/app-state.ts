import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const ONBOARDED_KEY = 'memo.onboarded';
const PIN_KEY = 'memo.pin_hash';

export async function isOnboarded(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ONBOARDED_KEY)) === '1';
}

export async function markOnboarded(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDED_KEY, '1');
}

export async function hasPin(): Promise<boolean> {
  return (await SecureStore.getItemAsync(PIN_KEY)) !== null;
}

async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `memo:${pin}`);
}

export async function setPin(pin: string): Promise<void> {
  await SecureStore.setItemAsync(PIN_KEY, await hashPin(pin));
}

export async function checkPin(pin: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PIN_KEY);
  return stored !== null && stored === (await hashPin(pin));
}

export async function removePin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
}

const LOCALE_KEY = 'memo.locale';
const LOCK_TIMER_KEY = 'memo.lock_timer';

/** Minutes the app may stay in the background before it locks again. 0 means lock at once. */
export const LOCK_TIMERS = [0, 1, 5, 15, 60] as const;
export type LockTimer = (typeof LOCK_TIMERS)[number];

export async function getStoredLocale(): Promise<string | null> {
  return SecureStore.getItemAsync(LOCALE_KEY);
}

export async function storeLocale(code: string): Promise<void> {
  await SecureStore.setItemAsync(LOCALE_KEY, code);
}

export async function getLockTimer(): Promise<LockTimer> {
  const raw = Number(await SecureStore.getItemAsync(LOCK_TIMER_KEY));
  return (LOCK_TIMERS as readonly number[]).includes(raw) ? (raw as LockTimer) : 0;
}

export async function setLockTimer(minutes: LockTimer): Promise<void> {
  await SecureStore.setItemAsync(LOCK_TIMER_KEY, String(minutes));
}

/** Forgets the passcode, the first-run flag and the lock timer. The language is kept. */
export async function clearAppState(): Promise<void> {
  await SecureStore.deleteItemAsync(ONBOARDED_KEY);
  await SecureStore.deleteItemAsync(PIN_KEY);
  await SecureStore.deleteItemAsync(LOCK_TIMER_KEY);
}
