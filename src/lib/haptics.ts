// Haptic Feedback utilities
// Uses Telegram WebApp HapticFeedback API as primary implementation.
// Silently skips if the API is unavailable (desktop browser, non-Telegram context).

type HapticImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type HapticNotificationType = 'success' | 'error' | 'warning';

// Telegram WebApp HapticFeedback interface
interface HapticFeedback {
  impactOccurred: (style: HapticImpactStyle) => void;
  notificationOccurred: (type: HapticNotificationType) => void;
  selectionChanged: () => void;
}

function getTelegramHaptics(): HapticFeedback | null {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: HapticFeedback } } }).Telegram?.WebApp;
    return tg?.HapticFeedback ?? null;
  } catch {
    return null;
  }
}

/**
 * Trigger an impact haptic via the Telegram HapticFeedback API.
 * Use: light for subtle feedback, medium for buttons, heavy for destructive actions.
 * Silently skips if the Telegram HapticFeedback API is unavailable.
 */
export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
  try {
    getTelegramHaptics()?.impactOccurred(style);
  } catch { /* silent */ }
}

/**
 * Trigger a notification haptic via the Telegram HapticFeedback API.
 * Use 'warning' for destructive action confirmations (delete).
 * Silently skips if the Telegram HapticFeedback API is unavailable.
 */
export function hapticNotification(type: 'error' | 'success' | 'warning') {
  try {
    getTelegramHaptics()?.notificationOccurred(type);
  } catch { /* silent */ }
}

/**
 * Trigger a selection change haptic via the Telegram HapticFeedback API.
 * Silently skips if the Telegram HapticFeedback API is unavailable.
 */
export function hapticSelection() {
  try {
    getTelegramHaptics()?.selectionChanged();
  } catch { /* silent */ }
}

// Predefined haptic helpers for common actions
export const haptics = {
  // Navigation
  tap: () => hapticImpact('light'),
  buttonPress: () => hapticImpact('medium'),
  longPress: () => hapticImpact('heavy'),

  // Feedback
  success: () => hapticNotification('success'),
  error: () => hapticNotification('error'),
  warning: () => hapticNotification('warning'),

  // Selection
  selection: () => hapticSelection(),

  // Destructive
  delete: () => hapticNotification('warning'),
  confirm: () => hapticImpact('heavy'),
};
