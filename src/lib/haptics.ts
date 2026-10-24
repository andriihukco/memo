// Haptic Feedback utilities
// Uses Telegram WebApp HapticFeedback API via useTelegramAdapter hook.
// Provides web fallback using navigator.vibrate when Telegram is unavailable.

type HapticImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type HapticNotificationType = 'success' | 'error' | 'warning';

/**
 * Trigger an impact haptic via the Telegram HapticFeedback API.
 * Use: light for subtle feedback, medium for buttons, heavy for destructive actions.
 * Falls back to navigator.vibrate on web if Telegram is unavailable.
 */
export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: { impactOccurred: (s: HapticImpactStyle) => void } } } }).Telegram?.WebApp;
    if (tg?.HapticFeedback?.impactOccurred) {
      tg.HapticFeedback.impactOccurred(style);
    } else {
      // Web fallback: use navigator.vibrate if available
      if (navigator.vibrate) {
        const duration = style === 'light' ? 10 : style === 'medium' ? 20 : 30;
        navigator.vibrate(duration);
      }
    }
  } catch { /* silent */ }
}

/**
 * Trigger a notification haptic via the Telegram HapticFeedback API.
 * Use 'warning' for destructive action confirmations (delete).
 * Falls back to navigator.vibrate on web if Telegram is unavailable.
 */
export function hapticNotification(type: 'error' | 'success' | 'warning') {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: { notificationOccurred: (t: HapticNotificationType) => void } } } }).Telegram?.WebApp;
    if (tg?.HapticFeedback?.notificationOccurred) {
      tg.HapticFeedback.notificationOccurred(type);
    } else {
      // Web fallback: use navigator.vibrate if available
      if (navigator.vibrate) {
        const pattern = type === 'success' ? [50] : type === 'error' ? [50, 50, 50] : [30];
        navigator.vibrate(pattern);
      }
    }
  } catch { /* silent */ }
}

/**
 * Trigger a selection change haptic via the Telegram HapticFeedback API.
 * Silently skips if the Telegram HapticFeedback API is unavailable.
 */
export function hapticSelection() {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: { selectionChanged: () => void } } } }).Telegram?.WebApp;
    if (tg?.HapticFeedback?.selectionChanged) {
      tg.HapticFeedback.selectionChanged();
    }
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
