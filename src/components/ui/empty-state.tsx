import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
}

export function EmptyState({ icon, title, subtitle, ctaLabel, onCta, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 px-6 py-16 text-center', className)}>
      <Icon name={icon} size={48} className="text-muted-foreground/40" />
      <h3 className="text-[17px] font-semibold text-muted-foreground">{title}</h3>
      <p className="text-[15px] text-muted-foreground/70">{subtitle}</p>
      {ctaLabel && onCta && (
        <Button
          onClick={onCta}
          className="w-full min-h-[44px]"
          variant="default"
        >
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
