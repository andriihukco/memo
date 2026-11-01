'use client';

import { useState, type ReactNode } from 'react';
import { BookOpen, CalendarDays, Check, Footprints, ListChecks, Moon, Sparkles, Sun } from 'lucide-react';
import { CountUp, Reveal, useInView } from './motion-kit';

type Tone = 'day' | 'night';

/** A widget tile. Lifts a little under a fine pointer; the lift is skipped on touch. */
function Tile({ children, className, tone }: { children: ReactNode; className?: string; tone: Tone }) {
  const base =
    tone === 'day'
      ? 'border-day-line bg-day-card text-day-ink shadow-md'
      : 'border-night-line bg-night-card text-night-ink shadow-2xl backdrop-blur';
  return (
    <div
      className={`rounded-2xl border p-5 transition-transform duration-300 ease-spring [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1 motion-reduce:transform-none ${base} ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

/** A round check that springs in when ticked. Min 44px target. */
function CheckBox({ checked, onToggle, label, tone }: { checked: boolean; onToggle: () => void; label: string; tone: Tone }) {
  const on = tone === 'day' ? 'border-day-sun bg-day-sun text-day-ink' : 'border-night-accent bg-night-accent text-night-top';
  const off = tone === 'day' ? 'border-day-line' : 'border-night-line';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-1 text-left text-sm transition-colors active:scale-[0.98] motion-reduce:transition-none"
    >
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-full border transition-[background-color,border-color,transform] duration-300 ease-spring ${
          checked ? `${on} scale-100` : `${off} scale-90`
        }`}
      >
        <Check className={`size-3.5 transition-opacity duration-200 ${checked ? 'opacity-100' : 'opacity-0'}`} aria-hidden />
      </span>
      <span className={checked ? (tone === 'day' ? 'text-day-muted line-through' : 'text-night-muted line-through') : ''}>{label}</span>
    </button>
  );
}

/** Heights (in % of the bar box) for the week's steps. */
const STEP_BARS = [6, 9, 4, 8, 7, 3, 9];

export function DayBand() {
  const [todos, setTodos] = useState([true, true, false, false]);
  const [reminders, setReminders] = useState([true, false]);
  const [barsRef, barsIn] = useInView<HTMLDivElement>();
  const [weekRef, weekIn] = useInView<HTMLDivElement>();
  const todoLabels = ['Daily reminder', 'Stretch and water', 'Read 10 pages', 'Checklist'];
  const reminderRows = [
    { time: '8:45 pm', label: 'Log your day' },
    { time: '9:00 am', label: 'Set one goal' },
  ];

  return (
    <section className="bg-day-top py-24 text-day-ink" aria-labelledby="day-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-widest text-day-muted">Day</p>
          <h2 id="day-title" className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
            Reminders, to-dos and your week, in daylight.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Reveal className="h-full">
            <Tile tone="day" className="h-full">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Sun className="size-4" aria-hidden /> Reminders
              </div>
              <ul className="flex flex-col gap-2">
                {reminderRows.map((row, i) => (
                  <li key={row.time}>
                    <button
                      type="button"
                      aria-pressed={reminders[i]}
                      onClick={() => setReminders((r) => r.map((v, j) => (j === i ? !v : v)))}
                      className="flex min-h-11 w-full items-center justify-between rounded-lg px-2 text-left text-sm transition-colors hover:bg-day-bottom"
                    >
                      <span>
                        <span className="block font-medium">{row.label}</span>
                        <span className="text-xs text-day-muted">{row.time}</span>
                      </span>
                      <span className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-300 ${reminders[i] ? 'bg-day-sun' : 'bg-day-line'}`}>
                        <span
                          className={`block size-5 rounded-full bg-white shadow transition-transform duration-300 ease-spring ${reminders[i] ? 'translate-x-5' : ''}`}
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Tile>
          </Reveal>

          <Reveal delay={0.08} className="h-full">
            <Tile tone="day" className="h-full">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <ListChecks className="size-4" aria-hidden /> Today
              </div>
              {todoLabels.map((label, i) => (
                <CheckBox
                  key={label}
                  tone="day"
                  label={label}
                  checked={todos[i]}
                  onToggle={() => setTodos((t) => t.map((v, j) => (j === i ? !v : v)))}
                />
              ))}
            </Tile>
          </Reveal>

          <Reveal delay={0.16} className="h-full">
            <Tile tone="day" className="h-full">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="size-4" aria-hidden /> This week
              </div>
              <div ref={weekRef} className="grid grid-cols-7 gap-1.5 text-center text-xs">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <span key={`${d}-${i}`} className="text-day-muted">
                    {d}
                  </span>
                ))}
                {Array.from({ length: 7 }, (_, i) => (
                  <span
                    key={i}
                    style={{ transitionDelay: `${0.3 + i * 0.06}s` }}
                    className={`grid aspect-square place-items-center rounded-lg transition-[opacity,transform] duration-500 ease-spring motion-reduce:transition-none ${
                      weekIn ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                    } ${i === 3 ? 'bg-day-sun font-semibold text-day-ink' : 'bg-day-bottom'}`}
                  >
                    {i + 10}
                  </span>
                ))}
              </div>
            </Tile>
          </Reveal>

          <Reveal delay={0.24} className="h-full">
            <Tile tone="day" className="h-full">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Footprints className="size-4" aria-hidden /> Steps
              </div>
              <p className="mt-4 text-3xl font-bold">
                <CountUp to={12383} />
              </p>
              <p className="text-xs text-day-muted">Steps this week</p>
              <div ref={barsRef} className="mt-4 flex h-16 items-end gap-1.5" aria-hidden>
                {STEP_BARS.map((v, i) => (
                  <span
                    key={i}
                    style={{ height: barsIn ? `${v * 10}%` : '0%', transitionDelay: `${0.4 + i * 0.07}s` }}
                    className="flex-1 rounded-t-md bg-day-sun transition-[height] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                  />
                ))}
              </div>
            </Tile>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function NightBand() {
  const [routine, setRoutine] = useState([true, false, false, false]);
  const [ringRef, ringIn] = useInView<SVGSVGElement>();
  const routineLabels = ['Dim the lights', 'Screens off', 'Warm shower', 'Read one page'];

  return (
    <section className="bg-gradient-to-b from-night-top to-night-bottom py-24 text-night-ink" aria-labelledby="night-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-widest text-night-muted">Night</p>
          <h2 id="night-title" className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
            Wind-down, sleep and dreams, after dark.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Reveal className="h-full">
            <Tile tone="night" className="h-full">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Moon className="size-4" aria-hidden /> Wind-down
              </div>
              {routineLabels.map((label, i) => (
                <CheckBox
                  key={label}
                  tone="night"
                  label={label}
                  checked={routine[i]}
                  onToggle={() => setRoutine((r) => r.map((v, j) => (j === i ? !v : v)))}
                />
              ))}
            </Tile>
          </Reveal>

          <Reveal delay={0.08} className="h-full">
            <Tile tone="night" className="flex h-full flex-col items-center">
              <p className="self-start text-sm font-semibold">Hours of sleep</p>
              <div className="relative mt-4 grid size-40 place-items-center">
                <svg ref={ringRef} viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
                  <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(230 30% 28%)" strokeWidth="9" />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="hsl(45 90% 84%)"
                    strokeWidth="9"
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray={100}
                    strokeDashoffset={ringIn ? 10 : 100}
                    className="transition-[stroke-dashoffset] duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)] delay-200 motion-reduce:transition-none"
                  />
                </svg>
                <div className="text-center">
                  <p className="text-2xl font-semibold tabular-nums">7 h 12</p>
                  <p className="text-xs text-night-muted">of 8 h goal</p>
                </div>
              </div>
            </Tile>
          </Reveal>

          <Reveal delay={0.16} className="h-full">
            <Tile tone="night" className="h-full">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4" aria-hidden /> Dreams log
              </div>
              <ul className="flex flex-col gap-3 text-sm">
                <li className="rounded-lg bg-night-top/50 p-3">
                  <p className="text-xs text-night-muted">Last night</p>
                  <p>Walking through a quiet city.</p>
                </li>
                <li className="rounded-lg bg-night-top/50 p-3">
                  <p className="text-xs text-night-muted">Tuesday</p>
                  <p>A long train ride, calm.</p>
                </li>
              </ul>
            </Tile>
          </Reveal>

          <Reveal delay={0.24} className="h-full">
            <Tile tone="night" className="h-full">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <BookOpen className="size-4" aria-hidden /> Evening reflection
              </div>
              <p className="text-sm text-night-muted">A short review of the week.</p>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                <div>
                  <dt className="text-xs text-night-muted">What did not work</dt>
                  <dd>Late screens on weekdays.</dd>
                </div>
                <div>
                  <dt className="text-xs text-night-muted">One thing to try</dt>
                  <dd>Lights down at 10 pm.</dd>
                </div>
              </dl>
            </Tile>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
