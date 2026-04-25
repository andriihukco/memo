import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FeatureItem {
  emoji: string;
  text: string;
}

interface EmptyStateProps {
  /** Material Symbols icon name OR an emoji string (e.g. '📊') */
  icon: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
  /** Optional feature list shown below subtitle */
  features?: FeatureItem[];
}

function isEmoji(str: string) {
  return str.length <= 4 && /\p{Emoji}/u.test(str);
}

export function EmptyState({ icon, title, subtitle, ctaLabel, onCta, className, features }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      {isEmoji(icon) ? (
        <span className="text-6xl leading-none select-none">{icon}</span>
      ) : (
        <span className="text-6xl leading-none select-none opacity-30">{icon}</span>
      )}
      <h3 className="text-[17px] font-semibold text-muted-foreground mt-1">{title}</h3>
      <p className="text-[14px] text-muted-foreground/60 leading-relaxed">{subtitle}</p>

      {features && features.length > 0 && (
        <div className="w-full rounded-2xl bg-muted/30 border border-border/30 px-4 py-3 mt-1 flex flex-col gap-2.5 text-left">
          {features.map(({ emoji, text }) => (
            <div key={text} className="flex items-center gap-3">
              <span className="text-[18px] leading-none shrink-0">{emoji}</span>
              <span className="text-[14px] text-foreground/75">{text}</span>
            </div>
          ))}
        </div>
      )}

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
