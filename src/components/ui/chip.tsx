'use client';

import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { useSound } from '@/lib/sound/use-sound';

interface ChipProps {
  label: string;
  icon?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Chip({ label, icon, selected, disabled, onClick, className }: ChipProps) {
  const { play } = useSound();

  const handleClick = () => {
    if (disabled) return;
    play('SELECT');
    onClick?.();
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        'inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-full border px-4 text-[15px] font-normal transition',
        selected
          ? 'bg-primary/15 border-primary text-primary'
          : 'bg-muted/40 border-border/50 text-foreground',
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
    >
      {icon && <Icon name={icon} size={18} />}
      {label}
    </button>
  );
}
