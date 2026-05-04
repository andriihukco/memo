'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { type UsageWarningVariant, getUsageWarningVariant } from '@/lib/usage-warning';

// Re-export for consumers that import from this module
export type { UsageWarningVariant };
export { getUsageWarningVariant };

// ── Types ─────────────────────────────────────────────────────────────────────

interface UsageWarningBannerProps {
  /** Current usage count */
  current: number;
  /** Maximum allowed count */
  limit: number;
  /** Called when the user clicks the "Upgrade" CTA */
  onUpgrade: () => void;
  /** sessionStorage key used to track dismiss state */
  dismissKey: string;
  /** Optional extra className */
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * UsageWarningBanner
 *
 * Shows an amber chip (warning) or amber banner with CTA (critical) based on
 * how close the user is to their usage limit.
 *
 * Dismiss state is stored in sessionStorage so it resets on each browser session.
 */
export function UsageWarningBanner({
  current,
  limit,
  onUpgrade,
  dismissKey,
  className,
}: UsageWarningBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Restore dismiss state from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(dismissKey);
      if (stored === 'true') setDismissed(true);
    } catch {
      // sessionStorage unavailable (e.g. SSR or private mode) — ignore
    }
  }, [dismissKey]);

  const variant = getUsageWarningVariant(current, limit);

  if (!variant || dismissed) return null;

  const remaining = Math.max(0, limit - current);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(dismissKey, 'true');
    } catch {
      // ignore
    }
  };

  // ── Warning variant — compact amber chip ──────────────────────────────────
  if (variant === 'warning') {
    return (
      <div
        role="status"
        aria-label="Попередження про ліміт"
        className={cn(
          'flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5',
          className,
        )}
      >
        <Icon name="warning" size={14} className="shrink-0 text-amber-400" />
        <span className="flex-1 text-[13px] text-amber-300">
          {current} / {limit} — залишилось {remaining}
        </span>
        <button
          type="button"
          onClick={onUpgrade}
          className="shrink-0 text-[12px] font-semibold text-amber-400 underline-offset-2 hover:underline min-h-[32px] px-1"
        >
          Upgrade
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Закрити"
          className="flex h-[28px] w-[28px] shrink-0 items-center justify-center text-amber-400/60 hover:text-amber-400 transition-colors"
        >
          <Icon name="close" size={14} />
        </button>
      </div>
    );
  }

  // ── Critical variant — full amber banner with CTA ─────────────────────────
  return (
    <div
      role="alert"
      aria-label="Критичне попередження про ліміт"
      className={cn(
        'flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/15 px-4 py-3',
        className,
      )}
    >
      <Icon name="warning" size={18} className="mt-0.5 shrink-0 text-amber-400" />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-amber-300 leading-snug">
          Ти майже на межі — {remaining} {remaining === 1 ? 'запис' : remaining < 5 ? 'записи' : 'записів'} залишилось
        </p>
        <p className="mt-0.5 text-[12px] text-amber-300/70">
          Використано {current} з {limit}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onUpgrade}
          className="min-h-[36px] rounded-xl bg-amber-400 px-3 py-1.5 text-[13px] font-bold text-slate-950 active:scale-[0.97] transition-transform"
        >
          Upgrade
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Закрити"
          className="flex h-[36px] w-[36px] items-center justify-center text-amber-400/60 hover:text-amber-400 transition-colors"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  );
}
