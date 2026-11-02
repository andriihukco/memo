'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import { useTheme } from '@/lib/theme-provider';
import { useSound } from '@/lib/sound/use-sound';
import { LogoMark } from './logo-mark';
import type { Dict, SiteLocale } from '@/lib/marketing/dict';
import { cn } from '@/lib/utils';

const LANG_COOKIE = 'memo-site-lang';
const EASE = 'ease-base';
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const HOVER = '[@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground/5';

type Nav = Dict['nav'];

function links(t: Nav) {
  return [
    { href: '/#how', label: t.product, match: '/__none__' },
    { href: '/pricing', label: t.pricing, match: '/pricing' },
    { href: '/blog', label: t.blog, match: '/blog' },
  ];
}

function ThemeToggle({ t }: { t: Nav }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={`${t.theme}: ${dark ? t.light : t.dark}`}
      className={cn('relative grid size-11 place-items-center rounded-full transition-colors duration-300', HOVER, FOCUS)}
    >
      <Sun className={cn('absolute size-5 transition-[transform,opacity] duration-500', EASE, dark ? 'rotate-90 scale-50 opacity-0' : 'opacity-100')} aria-hidden />
      <Moon className={cn('absolute size-5 transition-[transform,opacity] duration-500', EASE, dark ? 'opacity-100' : '-rotate-90 scale-50 opacity-0')} aria-hidden />
    </button>
  );
}

function SoundToggle({ t }: { t: Nav }) {
  const { enabled, setEnabled, play } = useSound();
  return (
    <button
      type="button"
      onClick={() => {
        setEnabled(!enabled);
        if (!enabled) play('TAP');
      }}
      aria-pressed={enabled}
      aria-label={enabled ? t.soundOff : t.soundOn}
      className={cn('grid size-11 place-items-center rounded-full transition-colors duration-300', HOVER, FOCUS)}
    >
      {enabled ? <Volume2 className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
    </button>
  );
}

function LangSwitch({ locale, t }: { locale: SiteLocale; t: Nav }) {
  const router = useRouter();
  function pick(next: SiteLocale) {
    if (next === locale) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }
  return (
    <div role="group" aria-label={t.language} className="flex items-center rounded-full">
      {(['en', 'uk'] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          onClick={() => pick(l)}
          className={cn(
            'caption-3 grid h-11 min-w-11 place-items-center rounded-full px-2 uppercase transition-colors duration-300',
            l === locale ? 'text-foreground' : 'text-muted-foreground',
            HOVER,
            FOCUS,
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function SiteHeader({ t, locale }: { t: Nav; locale: SiteLocale }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = links(t);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isCurrent = (match: string) => pathname === match || pathname.startsWith(`${match}/`);

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <a
          href="#main"
          className="body-5 pointer-events-auto absolute left-4 top-4 z-10 -translate-y-24 rounded-full bg-primary px-4 py-2 text-primary-foreground focus:translate-y-0"
        >
          {t.skip}
        </a>
        <nav
          aria-label="Main"
          className="pointer-events-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 rounded-full border border-foreground/10 bg-background/70 py-2 pl-6 pr-4 shadow-sm backdrop-blur-xl md:w-auto md:justify-start md:gap-4"
        >
          <Link href="/" aria-label={t.home} className={cn('flex min-h-11 items-center gap-2 rounded-full pr-2', FOCUS)}>
            <LogoMark className="size-6" />
            <span className="title-3">Memo</span>
          </Link>

          <ul className="hidden items-center md:flex">
            {items.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isCurrent(l.match) ? 'page' : undefined}
                  className={cn(
                    'title-4 flex min-h-11 items-center rounded-full px-3 text-muted-foreground transition-colors duration-300 aria-[current=page]:text-foreground',
                    HOVER,
                    FOCUS,
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-1">
            <div className="hidden items-center md:flex">
              <LangSwitch locale={locale} t={t} />
              <SoundToggle t={t} />
              <ThemeToggle t={t} />
              <Link
                href="/login"
                className={cn('button-sm flex min-h-11 items-center rounded-full px-3 transition-colors duration-300', HOVER, FOCUS)}
              >
                {t.signIn}
              </Link>
            </div>
            <Link
              href="/login"
              className={cn(
                'btn-shimmer button-sm flex min-h-11 items-center rounded-full bg-primary px-4 text-primary-foreground transition-transform duration-300 active:scale-[0.98]',
                EASE,
                FOCUS,
              )}
            >
              {t.startFree}
            </Link>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? t.close : t.menu}
              className={cn('relative grid size-11 place-items-center rounded-full md:hidden', FOCUS)}
            >
              <span className={cn('absolute h-0.5 w-5 rounded-full bg-foreground transition-transform duration-500', EASE, open ? 'rotate-45' : '-translate-y-1')} />
              <span className={cn('absolute h-0.5 w-5 rounded-full bg-foreground transition-transform duration-500', EASE, open ? '-rotate-45' : 'translate-y-1')} />
            </button>
          </div>
        </nav>
      </header>

      <div
        id="site-menu"
        hidden={!open}
        className="fixed inset-0 z-40 flex-col bg-background/95 [&:not([hidden])]:flex px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-24 backdrop-blur-2xl md:hidden"
      >
        <ul className="flex flex-col gap-1">
          {[...items, { href: '/login', label: t.signIn, match: '/login' }].map((l, i) => (
            <li
              key={l.href}
              className="motion-safe:animate-mk-in"
              style={{ animationDelay: `${Math.min(i * 60, 400)}ms` }}
            >
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={isCurrent(l.match) ? 'page' : undefined}
                className={cn('heading-5 flex min-h-12 items-center rounded-2xl px-3 aria-[current=page]:underline', FOCUS)}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-center justify-between border-t border-foreground/10 pt-4">
          <LangSwitch locale={locale} t={t} />
          <div className="flex items-center">
            <SoundToggle t={t} />
            <ThemeToggle t={t} />
          </div>
        </div>
      </div>
    </>
  );
}
