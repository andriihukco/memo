'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Lightbulb, Network, Plus, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompose } from '@/components/features/compose/compose-drawer';
import { useI18n } from '@/lib/i18n/context';
import { useSound } from '@/lib/sound/use-sound';
import { cn } from '@/lib/utils';

export const isTabActive = (tab: 'journal' | 'insights' | 'graph', pathname: string): boolean =>
  tab === 'journal'
    ? pathname === '/miniapp' || pathname.startsWith('/miniapp/entry/')
    : pathname === `/miniapp/${tab}` || pathname.startsWith(`/miniapp/${tab}/`);

function Tab({ href, label, icon: Icon, active, glow = false }: { href: string; label: string; icon: LucideIcon; active: boolean; glow?: boolean }) {
  const { play } = useSound();
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={() => play(active ? 'SELECT' : 'SLIDE')}
      className={cn(
        'flex h-full min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-secondary font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon
        className={cn('size-5', glow && active && 'text-glow drop-shadow-[0_0_6px_hsl(48_100%_75%/0.9)]')}
        strokeWidth={active ? 2.5 : 1.75}
        aria-hidden="true"
      />
      {label}
    </Link>
  );
}

/**
 * Floating navigation: a pill with the three tabs, and a separate round +
 * beside it. The + is not part of the tab row, so it keeps its own action.
 * The outer layer ignores pointer events so taps still reach the page behind.
 */
export function TabBar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const { open, hasDraft } = useCompose();

  return (
    <nav
      aria-label={t('shell.nav')}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]"
    >
      {/* Total height (pt-2 + h-14 + pb-3 = 76px) plus a little air must equal --tab-bar-h (5rem) in globals.css. */}
      <div className="mx-auto flex max-w-md items-center gap-3 px-4 pb-3 pt-2">
        <div className="pointer-events-auto flex h-14 flex-1 items-center rounded-full border bg-background/80 p-1 shadow-lg backdrop-blur-xl">
          <Tab href="/miniapp" label={t('shell.journal')} icon={BookOpen} active={isTabActive('journal', pathname)} />
          <Tab href="/miniapp/insights" label={t('shell.insights')} icon={Lightbulb} active={isTabActive('insights', pathname)} glow />
          <Tab href="/miniapp/graph" label={t('shell.graph')} icon={Network} active={isTabActive('graph', pathname)} />
        </div>
        <Button
          size="icon"
          className="pointer-events-auto relative size-14 shrink-0 rounded-full shadow-lg"
          aria-label={hasDraft ? t('shell.compose_draft') : t('shell.compose')}
          onClick={open}
        >
          <Plus className="size-6" strokeWidth={2.5} aria-hidden="true" />
          {hasDraft && (
            <span aria-hidden="true" className="absolute right-0 top-0 size-3 rounded-full bg-destructive ring-2 ring-background" />
          )}
        </Button>
      </div>
    </nav>
  );
}
