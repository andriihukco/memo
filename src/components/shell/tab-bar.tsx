'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, CircleUser, Plus, Sparkles, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompose } from '@/components/features/compose/compose-drawer';
import { useI18n } from '@/lib/i18n/context';
import { useSound } from '@/lib/sound/use-sound';
import { cn } from '@/lib/utils';

export const isTabActive = (tab: 'journal' | 'insights' | 'you', pathname: string): boolean =>
  tab === 'journal'
    ? pathname === '/miniapp' || pathname.startsWith('/miniapp/entry/')
    : pathname === `/miniapp/${tab}` || pathname.startsWith(`/miniapp/${tab}/`);

function Tab({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  const { play } = useSound();
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={() => play(active ? 'SELECT' : 'SLIDE')}
      className={cn(
        'flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'font-semibold text-foreground' : 'text-muted-foreground',
      )}
    >
      <Icon className="size-6" strokeWidth={active ? 2.5 : 1.75} aria-hidden="true" />
      {label}
    </Link>
  );
}

export function TabBar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const { open, hasDraft } = useCompose();

  return (
    <nav
      aria-label={t('shell.nav')}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      {/* h-16 must equal --tab-bar-h in globals.css */}
      <div className="mx-auto flex h-16 max-w-md items-center px-2">
        <Tab href="/miniapp" label={t('shell.journal')} icon={BookOpen} active={isTabActive('journal', pathname)} />
        <div className="flex flex-1 justify-center">
          <Button
            size="icon"
            className="relative size-12 rounded-full"
            aria-label={hasDraft ? t('shell.compose_draft') : t('shell.compose')}
            onClick={open}
          >
            <Plus className="size-6" strokeWidth={2.5} aria-hidden="true" />
            {hasDraft && (
              <span aria-hidden="true" className="absolute right-0 top-0 size-3 rounded-full bg-destructive ring-2 ring-background" />
            )}
          </Button>
        </div>
        <Tab href="/miniapp/insights" label={t('shell.insights')} icon={Sparkles} active={isTabActive('insights', pathname)} />
        <Tab href="/miniapp/you" label={t('shell.you')} icon={CircleUser} active={isTabActive('you', pathname)} />
      </div>
    </nav>
  );
}
