'use client';

import * as React from 'react';
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

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm transition-opacity duration-200 animate-fadeIn"
        onClick={handleCancel}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-[101] p-4 pb-safe animate-slideUp">
        {/* Options Container */}
        <div className="overflow-hidden rounded-2xl bg-surface-elevated/95 backdrop-blur-xl shadow-2xl">
          {/* Header */}
          {(title || message) && (
            <div className="border-b border-border/50 px-4 py-3 text-center">
              {title && (
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              )}
              {message && (
                <p className="mt-0.5 text-xs text-muted-foreground">{message}</p>
              )}
            </div>
          )}

          {/* Options */}
          <div className="divide-y divide-border/50">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option)}
                className={cn(
                  'flex w-full items-center justify-center gap-2 px-4 py-3.5',
                  'min-h-[44px] transition-colors active:scale-[0.98]',
                  'hover:bg-white/5 active:bg-white/10',
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
              </button>
            ))}
          </div>
        </div>

        {/* Cancel Button */}
        <button
          onClick={handleCancel}
          className={cn(
            'mt-3 w-full rounded-2xl bg-surface-elevated/95 backdrop-blur-xl',
            'px-4 py-3.5 text-base font-semibold text-primary',
            'shadow-2xl transition-colors active:scale-[0.98]',
            'hover:bg-white/5 active:bg-white/10 min-h-[44px]'
          )}
        >
          {cancelLabel}
        </button>
      </div>
    </>
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

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/50 animate-fadeIn"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-6">
        <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-surface-elevated/95 backdrop-blur-xl shadow-2xl animate-fadeIn">
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
              <button
                onClick={() => {
                  haptics.tap();
                  secondaryAction.onClick();
                  onClose();
                }}
                className="flex-1 px-4 py-3 text-base text-primary transition-colors hover:bg-white/5 active:bg-white/10 min-h-[44px]"
              >
                {secondaryAction.label}
              </button>
            )}
            <button
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
                'flex-1 px-4 py-3 text-base font-semibold transition-colors hover:bg-white/5 active:bg-white/10 min-h-[44px]',
                primaryAction.destructive ? 'text-destructive' : 'text-primary'
              )}
            >
              {primaryAction.label}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
