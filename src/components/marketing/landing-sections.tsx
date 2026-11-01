import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, ChartLine, Network, MessageCircleQuestion, NotebookPen, PenLine, ScanText, ShieldCheck, Sparkles } from 'lucide-react';
import { Reveal } from './reveal';
import { StartAnonymously } from '@/components/features/landing/start-anonymously';
import type { Dict } from '@/lib/marketing/dict';

const SECTION = 'mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6';
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const LIFT = 'transition-transform duration-500 ease-base [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1 motion-reduce:transform-none';

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="caption-3 uppercase tracking-widest text-muted-foreground">{children}</p>;
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`button-md group inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-primary-foreground transition-transform duration-300 ease-base active:scale-[0.98] ${FOCUS}`}
    >
      {children}
      <ArrowRight className="size-4 transition-transform duration-300 ease-base group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

const STEP_ICONS = [PenLine, ScanText, ChartLine];

export function HowItWorks({ t }: { t: Dict['how'] }) {
  return (
    <section id="how" className={SECTION} aria-labelledby="how-title">
      <Reveal>
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <h2 id="how-title" className="heading-3 mt-3">{t.title}</h2>
      </Reveal>
      <ol className="mt-12 grid gap-4 md:grid-cols-3">
        {t.steps.map(([title, body], i) => {
          const Icon = STEP_ICONS[i];
          return (
            <li key={title}>
              <Reveal delay={i * 80} className="h-full">
                <div className={`h-full rounded-2xl border bg-card p-6 ${LIFT}`}>
                  <div className="flex items-center gap-3">
                    <span className="caption-3 grid size-8 place-items-center rounded-full bg-muted tabular-nums">{i + 1}</span>
                    <Icon className="size-5 text-muted-foreground" aria-hidden />
                  </div>
                  <h3 className="title-1 mt-6">{title}</h3>
                  <p className="body-6 mt-2 text-muted-foreground">{body}</p>
                </div>
              </Reveal>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const BENEFIT_ICONS = [MessageCircleQuestion, Sparkles, NotebookPen, Network];

export function Benefits({ t }: { t: Dict['benefits'] }) {
  return (
    <section className={SECTION} aria-labelledby="benefits-title">
      <Reveal>
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <h2 id="benefits-title" className="heading-3 mt-3">{t.title}</h2>
      </Reveal>
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {t.items.map(([title, body], i) => {
          const Icon = BENEFIT_ICONS[i];
          return (
            <Reveal key={title} delay={i * 80} className="h-full">
              <div className={`flex h-full gap-4 rounded-2xl border bg-card p-6 ${LIFT}`}>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="title-2">{title}</h3>
                  <p className="body-6 mt-1 text-muted-foreground">{body}</p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

export function Privacy({ t }: { t: Dict['privacy'] }) {
  return (
    <section className={SECTION} aria-labelledby="privacy-title">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
        <Reveal>
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h2 id="privacy-title" className="heading-3 mt-3">{t.title}</h2>
          <p className="body-3 mt-4 max-w-md text-muted-foreground">{t.sub}</p>
          <Link href="/blog/how-memo-stores-your-diary" className={`body-5 mt-6 inline-flex min-h-11 items-center gap-2 rounded-md underline underline-offset-4 ${FOCUS}`}>
            {t.link}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Reveal>
        <ul className="flex flex-col gap-3">
          {t.items.map((item, i) => (
            <li key={item}>
              <Reveal delay={i * 60}>
                <div className="flex items-start gap-4 rounded-2xl border bg-card p-4">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="body-6">{item}</span>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function PricingTeaser({ t, billingOpen }: { t: Dict['teaser']; billingOpen: boolean }) {
  return (
    <section className={SECTION} aria-labelledby="teaser-title">
      <Reveal>
        <div className="flex flex-col items-start gap-6 rounded-3xl border bg-card p-8 sm:p-12 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <Eyebrow>{t.eyebrow}</Eyebrow>
            <h2 id="teaser-title" className="heading-4 mt-3">{billingOpen ? t.titleOpen : t.titlePaid}</h2>
            <p className="body-3 mt-3 text-muted-foreground">{t.sub}</p>
          </div>
          <PrimaryLink href="/pricing">{t.cta}</PrimaryLink>
        </div>
      </Reveal>
    </section>
  );
}

export function Faq({ t }: { t: Dict['faq'] }) {
  return (
    <section className={SECTION} aria-labelledby="faq-title">
      <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
        <Reveal>
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h2 id="faq-title" className="heading-3 mt-3">{t.title}</h2>
        </Reveal>
        <div className="flex flex-col gap-2">
          {t.items.map(([q, a]) => (
            <details key={q} className="group rounded-2xl border bg-card">
              <summary className={`title-3 flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-6 py-3 ${FOCUS} [&::-webkit-details-marker]:hidden`}>
                {q}
                <span aria-hidden className="relative size-4 shrink-0">
                  <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-foreground" />
                  <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rotate-90 rounded-full bg-foreground transition-transform duration-500 ease-base group-open:rotate-0" />
                </span>
              </summary>
              <p className="body-6 px-6 pb-6 text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta({ t, cta, proof }: { t: Dict['final']; cta: string; proof: string }) {
  return (
    <section className={`${SECTION} text-center`} aria-labelledby="cta-title">
      <Reveal>
        <h2 id="cta-title" className="heading-2 mx-auto max-w-[680px]">{t.title}</h2>
        <p className="body-3 mt-4 text-muted-foreground">{proof}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <PrimaryLink href="/login">{cta}</PrimaryLink>
          <StartAnonymously labels={{ label: t.anon, busy: t.anonBusy, error: t.anonError, off: t.anonOff }} />
        </div>
      </Reveal>
    </section>
  );
}
