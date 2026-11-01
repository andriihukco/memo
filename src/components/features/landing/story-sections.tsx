'use client';

import type { ReactNode } from 'react';
import { ChartColumn, Eye, Lock, PenLine, Ruler, Scale, ShieldCheck, TrendingUp } from 'lucide-react';
import { CountUp, Reveal, useInView } from './motion-kit';

const SECTION = 'mx-auto max-w-6xl px-4 py-24 sm:px-6';
/** Lift on hover for a fine pointer only. Skipped on touch and for reduced motion. */
const LIFT = 'transition-transform duration-300 ease-spring [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1 motion-reduce:transform-none';

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{children}</p>;
}

const STEPS = [
  { icon: PenLine, title: 'Log in a few taps', body: 'Write one line or add a number: steps, sleep, mood.' },
  { icon: ChartColumn, title: 'See the pattern', body: 'Memo lines up your days so you can see what changed.' },
  { icon: TrendingUp, title: 'Review the week', body: 'A short retro: what went well, what did not, and one thing to try.' },
];

export function HowItWorks() {
  const [lineRef, lineIn] = useInView<HTMLDivElement>();
  return (
    <section className={SECTION} aria-labelledby="how-title">
      <Reveal>
        <Eyebrow>How it works</Eyebrow>
        <h2 id="how-title" className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Three steps. No setup.
        </h2>
      </Reveal>
      <div className="relative mt-14 grid gap-10 md:grid-cols-3">
        <div
          ref={lineRef}
          aria-hidden
          className={`absolute left-6 right-6 top-6 hidden h-px origin-left bg-border transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] md:block motion-reduce:transition-none ${
            lineIn ? 'scale-x-100' : 'scale-x-0'
          }`}
        />
        {STEPS.map((step, i) => (
          <Reveal key={step.title} delay={i * 0.12}>
            <div className="relative flex flex-col gap-4">
              <span className="grid size-12 place-items-center rounded-2xl bg-card text-foreground shadow-md ring-1 ring-border">
                <step.icon className="size-5" aria-hidden />
              </span>
              <p className="text-xs font-semibold text-muted-foreground">Step {i + 1}</p>
              <h3 className="text-xl font-semibold">{step.title}</h3>
              <p className="text-muted-foreground">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const PRIVACY = [
  { icon: PenLine, text: 'You choose what to write. Every field is optional.' },
  { icon: Lock, text: 'Entries are stored encrypted on the server.' },
  { icon: Eye, text: 'Not end-to-end encrypted yet. We will say so when that changes.' },
  { icon: ShieldCheck, text: 'You can start without an account.' },
];

export function PrivacyOnLogs() {
  return (
    <section className={SECTION} aria-labelledby="privacy-title">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
        <Reveal>
          <Eyebrow>Privacy</Eyebrow>
          <h2 id="privacy-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Your logs are yours.
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Memo stores what you write and nothing more. Here is how it is kept, in plain words.
          </p>
        </Reveal>
        <ul className="flex flex-col gap-3">
          {PRIVACY.map((item, i) => (
            <Reveal key={item.text} delay={i * 0.08}>
              <li className="flex min-h-11 items-start gap-4 rounded-2xl border bg-card p-4 transition-transform duration-300 ease-spring [@media(hover:hover)_and_(pointer:fine)]:hover:translate-x-1 motion-reduce:transform-none">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted">
                  <item.icon className="size-4" aria-hidden />
                </span>
                <span className="text-sm leading-relaxed">{item.text}</span>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

const SCIENCE = [
  { icon: Ruler, title: 'We count, we do not guess', body: 'Averages and changes from your own entries. Each number shows the math behind it.' },
  { icon: Scale, title: 'We compare you with you', body: 'This week is measured against your past weeks, not against other people.' },
  { icon: ShieldCheck, title: 'Patterns, not diagnoses', body: 'Memo describes what your numbers show. It is not medical advice.' },
];

export function DataPlain() {
  return (
    <section className={SECTION} aria-labelledby="science-title">
      <Reveal>
        <Eyebrow>Data, plainly</Eyebrow>
        <h2 id="science-title" className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Simple math, shown in full.
        </h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Your entry is stored. Your week is added up with fixed rules. You see the result and the numbers behind it.
        </p>
      </Reveal>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {SCIENCE.map((item, i) => (
          <Reveal key={item.title} delay={i * 0.1} className="h-full">
            <div className={`h-full rounded-2xl border bg-card p-6 ${LIFT}`}>
              <item.icon className="mb-4 size-5 text-muted-foreground" aria-hidden />
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function RetroPreview() {
  return (
    <section className={SECTION} aria-labelledby="retro-title">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <Eyebrow>Weekly retro</Eyebrow>
          <h2 id="retro-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            A short review, every Sunday.
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            What went well, what did not, and one thing to try next week. Built from your own entries.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-3xl border bg-card p-6 shadow-lg sm:p-8">
            <p className="text-sm text-muted-foreground">This week</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-xs text-muted-foreground">Steps vs last week</p>
                <p className="mt-1 text-2xl font-semibold">
                  +<CountUp to={12} suffix="%" />
                </p>
              </div>
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-xs text-muted-foreground">Average sleep</p>
                <p className="mt-1 text-2xl font-semibold">6 h 50 min</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 text-sm">
              <p><span className="font-semibold">Went well:</span> Walks on three days.</p>
              <p><span className="font-semibold">Did not work:</span> Late screens on weekdays.</p>
              <p><span className="font-semibold">Try next week:</span> Lights down at 10 pm.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function FinalCta({ actions }: { actions: ReactNode }) {
  return (
    <section className={`${SECTION} text-center`} aria-labelledby="cta-title">
      <Reveal>
        <h2 id="cta-title" className="text-3xl font-bold tracking-tight sm:text-5xl">
          Start with one line today.
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{actions}</div>
      </Reveal>
    </section>
  );
}
