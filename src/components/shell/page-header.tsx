'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n/context';
import { tg } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import { useBack } from './back';

interface Props {
  title: string;
  back?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ title, back = false, actions, children }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const sentinel = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [inTelegram, setInTelegram] = useState(true); // assume Telegram until mounted so SSR never flashes a chevron
  useBack(back);

  useEffect(() => setInTelegram(!!tg()?.initData), []);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCollapsed(!e.isIntersecting), { rootMargin: '-44px 0px 0px 0px' }); // 44px = sticky bar height
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const showChevron = back && !inTelegram;

  return (
    <>
      <div className="sticky top-0 z-30 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className={cn('relative flex h-11 items-center gap-1 px-2', collapsed && 'border-b')}>
          {showChevron && (
            <Button variant="ghost" size="icon" className="size-11" aria-label={t('shell.back')} onClick={() => router.back()}>
              <ChevronLeft className="size-6" />
            </Button>
          )}
          <p
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-x-14 truncate text-center text-base font-semibold transition-opacity motion-reduce:transition-none',
              collapsed ? 'opacity-100' : 'opacity-0',
            )}
          >
            {title}
          </p>
          <div className="ml-auto flex items-center gap-1">{actions}</div>
        </div>
      </div>
      <div className="px-4 pb-2">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <div ref={sentinel} aria-hidden="true" />
        {children && <div className="pt-3">{children}</div>}
      </div>
    </>
  );
}
