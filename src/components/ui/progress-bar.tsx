import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  className?: string;
  completed?: boolean;
}

export function ProgressBar({ value, className, completed }: ProgressBarProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);

  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          completed ? 'bg-green-400' : 'bg-primary'
        )}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}
