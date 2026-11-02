'use client';

import Link from 'next/link';
import { CircleUser } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

/** Opens Settings from the header of every tab, opposite the page title. */
export function ProfileButton({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <Link
      href="/miniapp/you"
      aria-label={t('settings.title')}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <CircleUser className="size-6" strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}
