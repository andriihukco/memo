import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Reveal } from './reveal';
import { StartAnonymously } from '@/components/features/landing/start-anonymously';
import type { Dict } from '@/lib/marketing/dict';
import { cn } from '@/lib/utils';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** A full-width band. `tone` switches between the page colour and an inverted contrast band. */
function Band({ id, tone = 'light', children, className }: { id?: string; tone?: 'light' | 'dark' | 'muted'; children: ReactNode; className?: string }) {
  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-24 px-4 py-24 sm:px-6 sm:py-36',
        tone === 'dark' && 'bg-foreground text-background',
        tone === 'muted' && 'bg-muted',
        className,
      )}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

function Eyebrow({ children, inverted }: { children: ReactNode; inverted?: boolean }) {
  return <p className={cn('caption-3 uppercase tracking-widest', inverted ? 'text-background/60' : 'text-muted-foreground')}>{children}</p>;
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`btn-shimmer button-md group inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-primary-foreground transition-transform duration-300 ease-base active:scale-[0.98] ${FOCUS}`}
    >
      {children}
      <ArrowRight className="size-4 transition-transform duration-300 ease-base group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/** Three chapters, each a full-width row that alternates sides. The visual is the step's own words, set large. */
export function HowItWorks({ t }: { t: Dict['how'] }) {
  return (
    <Band id="how">
      <Reveal>
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <h2 className="heading-2 mt-4 max-w-3xl">{t.title}</h2>
      </Reveal>
      <div className="mt-20 flex flex-col gap-28">
        {t.steps.map(([title, body], i) => (
          <Reveal key={title}>
            <div className={cn('grid items-center gap-10 md:grid-cols-2', i % 2 === 1 && 'md:[&>*:first-child]:order-2')}>
              <div>
                <p className="heading-1 tabular-nums text-muted-foreground opacity-40">0{i + 1}</p>
                <h3 className="heading-3 mt-4">{title}</h3>
              </div>
              <div className="rounded-4xl bg-muted p-10 sm:p-14">
                <p className="title-2 text-foreground">{body}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Band>
  );
}

/** Bento: one large card and three smaller ones, all the same radius and gap. */
export function Benefits({ t }: { t: Dict['benefits'] }) {
  const [first, ...rest] = t.items;
  return (
    <Band tone="muted">
      <Reveal>
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <h2 className="heading-2 mt-4 max-w-3xl">{t.title}</h2>
      </Reveal>
      <div className="mt-14 grid gap-4 md:grid-cols-3">
        <Reveal className="md:col-span-2 md:row-span-2">
          <div className="flex h-full min-h-[22rem] flex-col justify-between rounded-4xl bg-background p-10 sm:p-12">
            <h3 className="heading-3">{first[0]}</h3>
            <p className="title-2 mt-10 max-w-xl text-muted-foreground">{first[1]}</p>
          </div>
        </Reveal>
        {rest.map(([title, body], i) => (
          <Reveal key={title} delay={(i + 1) * 80}>
            <div className="flex h-full min-h-[10rem] flex-col justify-between rounded-4xl bg-background p-8">
              <h3 className="title-1">{title}</h3>
              <p className="body-6 mt-6 text-muted-foreground">{body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Band>
  );
}

/** Contrast band: a bold statement on the left, the promises as a numbered list on the right. */
export function Privacy({ t }: { t: Dict['privacy'] }) {
  return (
    <Band tone="dark" id="privacy">
      <div className="grid gap-16 md:grid-cols-2 md:items-start">
        <Reveal>
          <Eyebrow inverted>{t.eyebrow}</Eyebrow>
          <h2 className="heading-2 mt-4">{t.title}</h2>
          <p className="body-3 mt-6 max-w-md text-background/70">{t.sub}</p>
          <Link href="/blog/how-memo-stores-your-diary" className={cn('title-3 mt-8 inline-flex min-h-11 items-center gap-2 underline underline-offset-4', FOCUS)}>
            {t.link}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Reveal>
        <ol className="divide-y divide-background/15 border-y border-background/15">
          {t.items.map((item, i) => (
            <Reveal key={item} delay={i * 60}>
              <li className="flex gap-6 py-6">
                <span className="title-3 w-8 shrink-0 tabular-nums text-background/50">{i + 1}</span>
                <span className="body-3 text-background/90">{item}</span>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </Band>
  );
}

export function PricingTeaser({ t, billingOpen }: { t: Dict['teaser']; billingOpen: boolean }) {
  return (
    <Band>
      <Reveal>
        <div className="flex flex-col items-center text-center">
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h2 className="heading-2 mt-4 max-w-3xl">{billingOpen ? t.titleOpen : t.titlePaid}</h2>
          <p className="body-3 mt-6 max-w-2xl text-muted-foreground">{t.sub}</p>
          <div className="mt-10">
            <PrimaryLink href="/pricing">{t.cta}</PrimaryLink>
          </div>
        </div>
      </Reveal>
    </Band>
  );
}

export function Faq({ t }: { t: Dict['faq'] }) {
  return (
    <Band tone="muted" id="faq">
      <div className="grid gap-12 md:grid-cols-[1fr_2fr]">
        <Reveal>
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h2 className="heading-3 mt-4">{t.title}</h2>
        </Reveal>
        <div className="divide-y divide-foreground/10 border-y border-foreground/10">
          {t.items.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className={cn('title-2 flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 rounded-md [&::-webkit-details-marker]:hidden', FOCUS)}>
                {q}
                <span aria-hidden className="relative size-4 shrink-0">
                  <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-foreground" />
                  <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rotate-90 rounded-full bg-foreground transition-transform duration-500 ease-base group-open:rotate-0" />
                </span>
              </summary>
              <p className="body-3 mt-4 max-w-2xl text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </Band>
  );
}

/** Closing band: one full-screen statement, the action, and the proof line under it. */
export function FinalCta({ t, cta, proof }: { t: Dict['final']; cta: string; proof: string }) {
  return (
    <section className="flex min-h-[80svh] items-center bg-foreground px-4 py-24 text-background sm:px-6">
      <Reveal className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <h2 className="heading-1 max-w-3xl">{t.title}</h2>
        <p className="body-3 mt-6 text-background/70">{proof}</p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <PrimaryLink href="/login">{cta}</PrimaryLink>
          <StartAnonymously labels={{ label: t.anon, busy: t.anonBusy, error: t.anonError, off: t.anonOff }} />
        </div>
      </Reveal>
    </section>
  );
}
