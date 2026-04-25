'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

export interface ActionSheetOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  onClick: () => void;
}

interface IOSActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  options: ActionSheetOption[];
  cancelLabel?: string;
}

export function IOSActionSheet({
  isOpen,
  onClose,
  title,
  message,
  options,
  cancelLabel = 'Скасувати',
}: IOSActionSheetProps) {
  // Trigger haptic when opening
  React.useEffect(() => {
    if (isOpen) {
      haptics.buttonPress();
    }
  }, [isOpen]);

  const handleOptionClick = (option: ActionSheetOption) => {
    if (option.destructive) {
      haptics.delete();
    } else {
      haptics.buttonPress();
    }
    option.onClick();
    onClose();
  };

  const handleCancel = () => {
    haptics.tap();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
            onClick={handleCancel}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
            className="fixed inset-x-0 bottom-0 z-[101] p-4 pb-safe"
          >
            {/* Options Container */}
            <div className="overflow-hidden rounded-2xl bg-surface-elevated/95 backdrop-blur-xl shadow-2xl">
              {/* Header */}
              {(title || message) && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08, duration: 0.2 }}
                  className="border-b border-border/50 px-4 py-3 text-center"
                >
                  {title && (
                    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                  )}
                  {message && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{message}</p>
                  )}
                </motion.div>
              )}

              {/* Options */}
              <div className="divide-y divide-border/50">
                {options.map((option, i) => (
                  <motion.button
                    key={option.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.06 + i * 0.04, duration: 0.18 }}
                    whileTap={{ scale: 0.97, backgroundColor: 'rgba(255,255,255,0.08)' }}
                    onClick={() => handleOptionClick(option)}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 px-4 py-3.5',
                      'min-h-[44px] transition-colors',
                      'hover:bg-white/5',
                      option.destructive && 'text-destructive'
                    )}
                  >
                    {option.icon && (
                      <span className="text-base">{option.icon}</span>
                    )}
                    <span className={cn(
                      'text-base font-medium',
                      option.destructive ? 'text-destructive' : 'text-primary'
                    )}>
                      {option.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Cancel Button */}
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, type: 'spring', stiffness: 300, damping: 26 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleCancel}
              className={cn(
                'mt-3 w-full rounded-2xl bg-surface-elevated/95 backdrop-blur-xl',
                'px-4 py-3.5 text-base font-semibold text-primary',
                'shadow-2xl transition-colors',
                'hover:bg-white/5 min-h-[44px]'
              )}
            >
              {cancelLabel}
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Simple iOS Alert Dialog
interface IOSAlertProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  primaryAction: {
    label: string;
    onClick: () => void;
    destructive?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export function IOSAlert({
  isOpen,
  onClose,
  title,
  message,
  primaryAction,
  secondaryAction,
}: IOSAlertProps) {
  React.useEffect(() => {
    if (isOpen) {
      if (primaryAction.destructive) {
        haptics.error();
      } else {
        haptics.warning();
      }
    }
  }, [isOpen, primaryAction.destructive]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="alert-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/50"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-6">
            <motion.div
              key="alert-dialog"
              initial={{ opacity: 0, scale: 0.88, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="w-full max-w-sm overflow-hidden rounded-2xl bg-surface-elevated/95 backdrop-blur-xl shadow-2xl"
            >
              {/* Content */}
              <div className="px-5 py-4 text-center">
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                {message && (
                  <p className="mt-1 text-sm text-muted-foreground">{message}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex border-t border-border/50 divide-x divide-border/50">
                {secondaryAction && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      haptics.tap();
                      secondaryAction.onClick();
                      onClose();
                    }}
                    className="flex-1 px-4 py-3 text-base text-primary transition-colors hover:bg-white/5 min-h-[44px]"
                  >
                    {secondaryAction.label}
                  </motion.button>
                )}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (primaryAction.destructive) {
                      haptics.delete();
                    } else {
                      haptics.confirm();
                    }
                    primaryAction.onClick();
                    onClose();
                  }}
                  className={cn(
                    'flex-1 px-4 py-3 text-base font-semibold transition-colors hover:bg-white/5 min-h-[44px]',
                    primaryAction.destructive ? 'text-destructive' : 'text-primary'
                  )}
                >
                  {primaryAction.label}
                </motion.button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
