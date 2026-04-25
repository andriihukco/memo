'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = () => {
    setDismissing(true);
    // Wait for fade-out animation before calling onDismiss
    setTimeout(() => {
      onDismiss();
    }, 200);
  };

  return (
    <div
      role="alert"
      className={cn(
        'flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 transition-opacity duration-200',
        dismissing ? 'opacity-0' : 'opacity-100'
      )}
    >
      <Icon name="error" size={16} className="shrink-0 text-destructive" />
      <p className="flex-1 text-[15px] text-destructive">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-[44px] min-w-[44px] text-[13px] font-semibold text-destructive"
        >
          Повторити
        </button>
      )}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Закрити"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-destructive"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
