'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { SkyCanvas } from './sky-canvas';
import { PERSONAS, TELEGRAM_HREF, isPersona, type Dict, type PersonaSlug } from '@/lib/marketing/dict';
import { cn } from '@/lib/utils';

const STORE_KEY = 'memo-site-persona';
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const HOVER = '[@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground/10';

type Props = {
  t: Pick<Dict, 'hero' | 'band' | 'personas'>;
  /** From ?for= on the server, so a campaign link renders the right copy without a flash. */
  initial: PersonaSlug | null;
  telegramUrl: string | null;
  billingOpen: boolean;
};

function resolveHref(href: string, telegramUrl: string | null) {
  return href === TELEGRAM_HREF ? telegramUrl ?? '/login' : href;
}

/**
 * Landing hero plus the persona band under it. Picking a chip swaps the heading, sub, demo card
 * and lead magnet (AIDA per persona, see docs/marketing/landing-plan.md). The choice is kept in
 * the URL (?for=) for sharing and in localStorage for the next visit.
 */
export function AdaptiveHero({ t, initial, telegramUrl, billingOpen }: Props) {
  const [picked, setPicked] = useState<PersonaSlug | null>(initial);
  const copyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initial) return;
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (isPersona(saved)) setPicked(saved);
    } catch {
      /* storage blocked: keep the generic hero */
    }
  }, [initial]);

  function pick(slug: PersonaSlug) {
    const next = picked === slug ? null : slug;
    setPicked(next);
    try {
      if (next) localStorage.setItem(STORE_KEY, next);
      else localStorage.removeItem(STORE_KEY);
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    if (next) url.searchParams.set('for', next);
    else url.searchParams.delete('for');
    window.history.replaceState(null, '', url);
  }

  const active = picked ?? 'fitness';
  const persona = t.personas[active];
  const h1 = picked ? persona.h1 : t.hero.h1;
  const sub = picked ? persona.sub : t.hero.sub;
  const isTelegram = picked === 'telegram' && telegramUrl;
  const cta = isTelegram ? { href: telegramUrl, label: t.hero.telegramCta } : { href: '/login', label: t.hero.cta };

  return (
    <>
      <section className="relative isolate flex min-h-svh items-center overflow-hidden bg-day-bottom dark:bg-night-top" aria-labelledby="hero-title">
        <SkyCanvas hazeRef={copyRef} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-b from-transparent to-background" />

        <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-4 pb-24 pt-28 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:pt-32">
          <div ref={copyRef} className="flex min-w-0 flex-col gap-6">
            <div>
              <p id="persona-label" className="caption-3 uppercase tracking-widest text-foreground/70">
                {t.hero.pickLabel}
              </p>
              <div
                role="group"
                aria-labelledby="persona-label"
                className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
              >
                {PERSONAS.map((slug) => (
                  <button
                    key={slug}
                    type="button"
                    aria-pressed={picked === slug}
                    onClick={() => pick(slug)}
                    className={cn(
                      'body-5 min-h-11 shrink-0 rounded-full border px-4 backdrop-blur-md transition-[background-color,color,transform] duration-300 ease-base active:scale-[0.98]',
                      picked === slug
                        ? 'border-foreground bg-foreground text-background'
                        : cn('border-foreground/15 bg-background/50 text-foreground', HOVER),
                      FOCUS,
                    )}
                  >
                    {t.personas[slug].chip}
                  </button>
                ))}
              </div>
            </div>

            <div key={picked ?? 'all'} className="flex flex-col gap-4">
              <h1 id="hero-title" className="heading-1 hero-ink max-w-[680px] pb-1 motion-safe:animate-mk-in">
                {h1.map((line, i) => (
                  <span key={line} className="block">
                    {line}
                    {i < h1.length - 1 ? ' ' : null}
                  </span>
                ))}
              </h1>
              <p className="body-3 max-w-[680px] text-foreground/80 motion-safe:animate-mk-in sm:text-lg" style={{ animationDelay: '80ms' }}>
                {sub}
              </p>
            </div>

            <div className="flex flex-col items-start gap-3">
              <Link
                href={cta.href}
                className={cn(
                  'button-md group inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-primary-foreground shadow-lg transition-transform duration-300 ease-base active:scale-[0.98] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5',
                  FOCUS,
                )}
              >
                {cta.label}
                <ArrowRight className="size-4 transition-transform duration-300 ease-base group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <p className="caption-4 flex items-center gap-2 text-foreground/75">
                <Check className="size-4" aria-hidden />
                {billingOpen ? t.hero.proofOpen : t.hero.proofPaid}
              </p>
            </div>
          </div>

          <DemoCard key={active} t={t} slug={active} />
        </div>
      </section>

      <PersonaBand t={t} slug={active} telegramUrl={telegramUrl} />
    </>
  );
}

function DemoCard({ t, slug }: { t: Props['t']; slug: PersonaSlug }) {
  const p = t.personas[slug];
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-foreground/10 bg-background/75 p-4 shadow-2xl backdrop-blur-xl sm:p-6" aria-live="polite">
      <p className="caption-4 text-right text-muted-foreground">{t.hero.you}</p>
      <p className="body-6 ml-auto mt-1 w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2 text-primary-foreground motion-safe:animate-mk-in">
        {p.demoInput}
      </p>
      <p className="caption-4 mt-4 text-muted-foreground">{t.hero.memo}</p>
      <div className="mt-1 rounded-2xl bg-muted p-3">
        <p className="caption-3 flex items-center gap-2 text-muted-foreground">
          <Check className="size-3" aria-hidden />
          {t.hero.parsed}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2">
          {p.demoOut.map(([label, value], i) => (
            <div
              key={label}
              className="rounded-lg bg-background p-3 motion-safe:animate-mk-in"
              style={{ animationDelay: `${Math.min(150 + i * 60, 400)}ms` }}
            >
              <dt className="caption-5 text-muted-foreground">{label}</dt>
              <dd className="title-3 mt-1 tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function PersonaBand({ t, slug, telegramUrl }: { t: Props['t']; slug: PersonaSlug; telegramUrl: string | null }) {
  const p = t.personas[slug];
  const magnetHref = resolveHref(p.magnet.href, telegramUrl);
  const external = magnetHref.startsWith('http');
  return (
    <section key={slug} className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="band-title">
      <p className="caption-3 uppercase tracking-widest text-muted-foreground">{t.band.eyebrow}</p>
      <h2 id="band-title" className="heading-4 mt-2">{p.chip}</h2>
      <div className="mt-8 grid gap-4 lg:grid-cols-4">
        {p.benefits.map(([title, body], i) => (
          <div
            key={title}
            className="rounded-2xl border bg-card p-6 motion-safe:animate-mk-in"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <h3 className="title-2">{title}</h3>
            <p className="body-6 mt-2 text-muted-foreground">{body}</p>
          </div>
        ))}
        <div className="flex flex-col rounded-2xl bg-primary p-6 text-primary-foreground motion-safe:animate-mk-in" style={{ animationDelay: '180ms' }}>
          <p className="caption-3 uppercase tracking-widest opacity-80">{t.band.magnet}</p>
          <h3 className="title-2 mt-2">{p.magnet.title}</h3>
          <p className="body-6 mb-6 mt-2 opacity-85">{p.magnet.body}</p>
          <Link
            href={magnetHref}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className={cn(
              'button-sm mt-auto inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-primary-foreground px-4 text-primary transition-transform duration-300 ease-base active:scale-[0.98]',
              FOCUS,
            )}
          >
            {p.magnet.cta}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
