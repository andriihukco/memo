'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Bell, BedDouble, Check, Moon, Star } from 'lucide-react';
import { parallax, usePointerParallax } from './motion-kit';

type HeroProps = { actions: ReactNode };

/** Delay for the entrance of the n-th element, in seconds. */
const enter = (delay: number): CSSProperties => ({ animationDelay: `${delay}s` });

/** A soft cloud built from one path. Drifts sideways on a loop. */
function Cloud({ className, duration, delay = 0 }: { className: string; duration: number; delay?: number }) {
  return (
    <svg
      viewBox="0 0 220 110"
      aria-hidden
      className={`pointer-events-none absolute text-white/85 motion-safe:animate-lp-drift ${className}`}
      style={{ animationDuration: `${duration}s`, animationDelay: `${delay}s` }}
    >
      <path fill="currentColor" d="M30 90a30 30 0 0 1 22-50 40 40 0 0 1 76-10 34 34 0 0 1 60 22 26 26 0 0 1 4 38Z" />
    </svg>
  );
}

/** Day hero: sun, clouds, reminder and to-do cards. Shown in the light theme. */
export function DayHero({ actions }: HeroProps) {
  const pointer = usePointerParallax();
  return (
    <section
      {...pointer}
      className="relative isolate overflow-hidden bg-gradient-to-b from-day-top to-day-bottom text-day-ink dark:hidden"
    >
      <div
        aria-hidden
        className="absolute -inset-10 -z-10 bg-[radial-gradient(circle_at_78%_20%,hsl(40_100%_95%/0.9),transparent_45%)] transition-transform duration-500 ease-out"
        style={parallax(-14, -10)}
      />

      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-28 sm:px-6 lg:grid-cols-2 lg:pt-36">
        <div className="flex flex-col gap-6 motion-safe:animate-lp-rise" style={enter(0)}>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">A day in your life, organized.</h1>
          <p className="max-w-md text-lg text-day-muted">
            Log your steps, sleep and mood in a few taps. Memo shows how your week went, in plain numbers.
          </p>
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        </div>

        <div className="relative mx-auto aspect-[5/4] w-full max-w-md transition-transform duration-500 ease-out" style={parallax(22, 16)}>
          <div
            aria-hidden
            className="absolute right-[6%] top-[4%] size-40 rounded-full bg-day-sun shadow-[0_0_80px_hsl(38_95%_62%/0.7)] motion-safe:animate-lp-breathe"
          />
          <Cloud className="-left-2 top-[10%] w-44" duration={9} />
          <Cloud className="right-0 top-[38%] w-32" duration={11} delay={1} />
          <Cloud className="bottom-[6%] left-[8%] w-56" duration={13} delay={2} />

          <div
            className="absolute left-0 top-[18%] w-56 -rotate-2 rounded-2xl border border-day-line bg-day-card p-4 shadow-lg motion-safe:animate-lp-rise"
            style={enter(0.25)}
          >
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-day-sun/30">
                <Bell className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">Daily reminder</p>
                <p className="text-xs text-day-muted">Today at 8:45 pm</p>
              </div>
            </div>
          </div>

          <div
            className="absolute right-0 top-[44%] w-60 rotate-2 rounded-2xl border border-day-line bg-day-card p-4 shadow-xl motion-safe:animate-lp-rise"
            style={enter(0.4)}
          >
            <p className="mb-3 text-sm font-semibold">Today</p>
            {['Daily reminder', 'Stretch and water', 'Checklist'].map((item, i) => (
              <div
                key={item}
                className="flex items-center gap-2 py-1 text-sm motion-safe:animate-lp-rise"
                style={enter(0.6 + i * 0.12)}
              >
                <span
                  className={`grid size-5 place-items-center rounded-full border ${i < 2 ? 'border-day-sun bg-day-sun text-day-ink' : 'border-day-line'}`}
                >
                  {i < 2 ? <Check className="size-3" aria-hidden /> : null}
                </span>
                <span className={i < 2 ? 'text-day-muted line-through' : ''}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const STARS = [
  [8, 14, 2], [18, 40, 1.5], [30, 9, 1], [44, 26, 2], [58, 12, 1.5], [70, 46, 1], [84, 20, 2],
  [92, 60, 1.5], [12, 72, 1], [40, 84, 1.5], [63, 78, 1], [78, 88, 2],
] as const;

/** Night hero: moon, stars, a constellation and a sleep card. Shown in the dark theme. */
export function NightHero({ actions }: HeroProps) {
  const pointer = usePointerParallax();
  return (
    <section
      {...pointer}
      className="relative isolate hidden overflow-hidden bg-gradient-to-b from-night-top to-night-bottom text-night-ink dark:block"
    >
      <div aria-hidden className="absolute -inset-10 -z-10 transition-transform duration-500 ease-out" style={parallax(-14, -10)}>
        {STARS.map(([left, top, size], i) => (
          <span
            key={`${left}-${top}`}
            className="absolute rounded-full bg-white motion-safe:animate-lp-twinkle"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: size * 2,
              height: size * 2,
              animationDelay: `${i * 0.37}s`,
              animationDuration: `${3 + (i % 4)}s`,
            }}
          />
        ))}
        <svg viewBox="0 0 100 100" className="absolute left-[8%] top-[10%] size-44 text-night-accent/70 sm:size-56">
          <path
            d="M10 20 L30 35 L48 22 L66 40 L84 30"
            pathLength={100}
            strokeDasharray={100}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.4"
            className="motion-safe:animate-lp-draw"
            style={enter(0.5)}
          />
        </svg>
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-28 sm:px-6 lg:grid-cols-2 lg:pt-36">
        <div className="flex flex-col gap-6 motion-safe:animate-lp-rise" style={enter(0)}>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">A night for you to recharge.</h1>
          <p className="max-w-md text-lg text-night-muted">
            Log your sleep, wind-down and mood in a few taps. Memo shows what your nights say, in plain numbers.
          </p>
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        </div>

        <div className="relative mx-auto aspect-[5/4] w-full max-w-md transition-transform duration-500 ease-out" style={parallax(22, 16)}>
          <div
            aria-hidden
            className="absolute right-[4%] top-[2%] grid size-36 place-items-center rounded-full bg-night-moon shadow-[0_0_90px_hsl(45_90%_84%/0.55)] motion-safe:animate-lp-bob sm:size-44"
          >
            <Moon className="size-10 text-night-top/40" aria-hidden />
          </div>

          <div
            className="absolute left-0 top-[34%] w-60 rounded-2xl border border-night-line bg-night-card p-4 shadow-2xl backdrop-blur motion-safe:animate-lp-rise"
            style={enter(0.3)}
          >
            <p className="mb-3 text-sm font-semibold">Wind-down routine</p>
            {['Checklist', 'Wind-down', 'Sleep routine'].map((item, i) => (
              <div key={item} className="flex items-center gap-2 py-1 text-sm">
                <span
                  className={`grid size-5 place-items-center rounded-md border ${i === 1 ? 'border-night-accent bg-night-accent text-night-top' : 'border-night-line'}`}
                >
                  {i === 1 ? <Check className="size-3" aria-hidden /> : null}
                </span>
                <span className={i === 1 ? 'text-night-muted' : ''}>{item}</span>
              </div>
            ))}
          </div>

          <div
            className="absolute bottom-[6%] right-0 w-48 rounded-2xl border border-night-line bg-night-card p-4 shadow-2xl backdrop-blur motion-safe:animate-lp-rise"
            style={enter(0.45)}
          >
            <p className="text-xs text-night-muted">Hours of sleep</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">7 h 12 min</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-night-muted">
              <BedDouble className="size-3" aria-hidden /> Last night
            </p>
          </div>
          <Star className="absolute left-[46%] top-[52%] size-4 text-night-moon/70" aria-hidden />
        </div>
      </div>
    </section>
  );
}
