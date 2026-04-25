import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  /** Material Symbols icon name OR an emoji string (e.g. '📊') */
  icon: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
}

function isEmoji(str: string) {
  // Emoji strings are short and contain non-ASCII characters
  return str.length <= 4 && /\p{Emoji}/u.test(str);
}

export function EmptyState({ icon, title, subtitle, ctaLabel, onCta, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-16 text-center', className)}>
      {isEmoji(icon) ? (
        <span className="text-6xl leading-none select-none">{icon}</span>
      ) : (
        <span className="text-6xl leading-none select-none opacity-30">
          {/* fallback: render as large text */}
          {icon}
        </span>
      )}
      <h3 className="text-[17px] font-semibold text-muted-foreground mt-1">{title}</h3>
      <p className="text-[14px] text-muted-foreground/60 leading-relaxed">{subtitle}</p>
      {ctaLabel && onCta && (
        <Button
          onClick={onCta}
          className="mt-2 w-full min-h-[44px]"
          variant="default"
        >
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
