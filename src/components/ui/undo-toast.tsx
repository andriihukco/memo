'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';

export interface UndoToastOptions {
  /** Message to display in the toast, e.g. "1 запис видалено" */
  message: string;
  /** How long (ms) to show the toast before auto-dismissing. Default: 4000 */
  duration?: number;
  /** Called when the user clicks "Undo" — should reverse the action */
  onUndo: () => void;
}

interface UndoToastProps extends UndoToastOptions {
  onDismiss: () => void;
}

/**
 * UndoToast
 *
 * iOS-style dismissable toast with an Undo action.
 * Renders above the tab bar (uses CSS var --tab-bar-h).
 *
 * Usage:
 *   const { showUndo } = useUndoToast();
 *   showUndo({ message: '1 запис видалено', onUndo: () => restoreEntry(id) });
 */
export function UndoToast({ message, duration = 4000, onUndo, onDismiss }: UndoToastProps) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300); // wait for exit animation
  };

  const handleUndo = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onUndo();
    dismiss();
  };

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={cn(
            'fixed left-4 right-4 z-50 flex items-center gap-3',
            'rounded-2xl border border-border/40 bg-card/95 backdrop-blur-md',
            'px-4 py-3 shadow-drawer',
          )}
          style={{
            bottom: 'calc(var(--tab-bar-h, 64px) + env(safe-area-inset-bottom, 0px) + 12px)',
          }}
        >
          <Icon
            name="delete"
            size={16}
            className="shrink-0 text-muted-foreground"
            aria-hidden
          />
          <p className="flex-1 text-sm text-foreground/90">{message}</p>

          {/* Undo button */}
          <button
            type="button"
            onClick={handleUndo}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-primary',
              'min-h-[36px] transition-colors active:text-primary/70',
            )}
          >
            Скасувати
          </button>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Закрити сповіщення"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors active:text-muted-foreground"
          >
            <Icon name="close" size={15} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── useUndoToast hook ─────────────────────────────────────────────────────────

export interface UndoToastState {
  key: number;
  options: UndoToastOptions;
}

/**
 * Hook for imperative undo toast management.
 *
 * @example
 * const { toastState, showUndo, clearToast } = useUndoToast();
 * // In JSX:
 * {toastState && <UndoToast {...toastState.options} key={toastState.key} onDismiss={clearToast} />}
 */
export function useUndoToast() {
  const [toastState, setToastState] = useState<UndoToastState | null>(null);
  const counterRef = useRef(0);

  const showUndo = (options: UndoToastOptions) => {
    counterRef.current += 1;
    setToastState({ key: counterRef.current, options });
  };

  const clearToast = () => setToastState(null);

  return { toastState, showUndo, clearToast };
}
