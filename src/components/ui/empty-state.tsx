'use client';

import { motion, type Variants } from 'framer-motion';
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

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

const featureItem: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

export function EmptyState({ icon, title, subtitle, ctaLabel, onCta, className, features }: EmptyStateProps) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}
    >
      <motion.div variants={item}>
        {isEmoji(icon) ? (
          <motion.span
            className="text-6xl leading-none select-none block"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 15, delay: 0.15 }}
          >
            {icon}
          </motion.span>
        ) : (
          <span className="text-6xl leading-none select-none opacity-30">{icon}</span>
        )}
      </motion.div>
      <motion.h3 variants={item} className="text-[17px] font-semibold text-muted-foreground mt-1">
        {title}
      </motion.h3>
      <motion.p variants={item} className="text-[14px] text-muted-foreground/60 leading-relaxed">
        {subtitle}
      </motion.p>

      {features && features.length > 0 && (
        <motion.div
          variants={item}
          className="w-full rounded-2xl bg-muted/30 border border-border/30 px-4 py-3 mt-1 flex flex-col gap-2.5 text-left"
        >
          {features.map(({ emoji, text }, i) => (
            <motion.div
              key={text}
              variants={featureItem}
              custom={i}
              className="flex items-center gap-3"
            >
              <span className="text-[18px] leading-none shrink-0">{emoji}</span>
              <span className="text-[14px] text-foreground/75">{text}</span>
            </motion.div>
          ))}
        </motion.div>
      )}

      {ctaLabel && onCta && (
        <motion.div variants={item} className="w-full">
          <Button
            onClick={onCta}
            className="mt-2 w-full min-h-[44px]"
            variant="default"
          >
            {ctaLabel}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
