// iOS-style Haptic Feedback utilities
// Uses Telegram WebApp HapticFeedback API when available, falls back to vibration API

type HapticImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type HapticNotificationType = 'success' | 'error' | 'warning';

// Telegram WebApp HapticFeedback interface
interface HapticFeedback {
  impactOccurred: (style: HapticImpactStyle) => void;
  notificationOccurred: (type: HapticNotificationType) => void;
  selectionChanged: () => void;
}

function getTelegramHaptics(): HapticFeedback | null {
  const tg = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: HapticFeedback } } }).Telegram?.WebApp;
  return tg?.HapticFeedback ?? null;
}

/**
 * Trigger iOS-style impact haptic
 * Use: light for subtle feedback, medium for buttons, heavy for destructive actions
 */
export function hapticImpact(style: HapticImpactStyle = 'medium') {
  const tg = getTelegramHaptics();
  if (tg) {
    tg.impactOccurred(style);
  } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
    // Fallback vibration patterns
    const patterns: Record<HapticImpactStyle, number[]> = {
      light: [10],
      medium: [20],
      heavy: [30],
      rigid: [15],
      soft: [5, 10, 5],
    };
    navigator.vibrate(patterns[style]);
  }
}

/**
 * Trigger notification haptic (success, error, warning)
 */
export function hapticNotification(type: HapticNotificationType) {
  const tg = getTelegramHaptics();
  if (tg) {
    tg.notificationOccurred(type);
  } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
    const patterns: Record<HapticNotificationType, number[]> = {
      success: [10, 50, 20],
      error: [30, 50, 30, 50, 30],
      warning: [20, 50, 20],
    };
    navigator.vibrate(patterns[type]);
  }
}

/**
 * Trigger selection change haptic (light feedback for value changes)
 */
export function hapticSelection() {
  const tg = getTelegramHaptics();
  if (tg) {
    tg.selectionChanged();
  } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(5);
  }
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
  delete: () => hapticImpact('heavy'),
  confirm: () => hapticImpact('rigid'),
};
