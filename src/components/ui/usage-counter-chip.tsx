'use client';

import { Icon } from '@/components/ui/icon';

interface UsageCounterChipProps {
  label: string;
  onClick?: () => void;
}

export function UsageCounterChip({ label, onClick }: UsageCounterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="bg-amber-400/10 border border-amber-400/30 text-amber-300 rounded-full px-3 min-h-[32px] flex items-center gap-1.5 text-[13px] disabled:cursor-default"
    >
      <Icon name="warning" size={14} className="shrink-0" />
      <span>{label}</span>
    </button>
  );
}
