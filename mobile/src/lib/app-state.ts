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
