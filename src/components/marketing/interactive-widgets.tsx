'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, Moon, Sparkles, BookOpen, ChartColumn, CalendarDays, Footprints, ListChecks } from 'lucide-react';
import { useSound } from '@/lib/sound/use-sound';
import { fill, type Dict } from '@/lib/marketing/dict';
import { cn } from '@/lib/utils';

type T = Dict['try'];

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card';
const TAP = 'transition-[background-color,color,transform,box-shadow] duration-300 ease-base active:scale-[0.98] motion-reduce:transform-none';
const HOVER = '[@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground/5';

/** Shared card shell for every demo. */
function Panel({ icon, title, children, className }: { icon: ReactNode; title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col rounded-2xl border bg-card p-5 shadow-sm sm:p-6', className)}>
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-muted text-foreground">{icon}</span>
        <h3 className="title-2">{title}</h3>
      </div>
      <div className="mt-5 flex flex-1 flex-col">{children}</div>
    </div>
  );
}

/** Day checklist: tap to tick. Ticks use the sound provider's TOGGLE tones. */
export function DayChecklist({ t }: { t: T }) {
  const { play } = useSound();
  const [done, setDone] = useState<boolean[]>([true, true, false, false]);
  const count = done.filter(Boolean).length;
  const pct = Math.round((count / done.length) * 100);

  function toggle(i: number) {
    const next = done.map((v, j) => (j === i ? !v : v));
    setDone(next);
    play(next[i] ? 'TOGGLE_ON' : 'TOGGLE_OFF');
  }

  return (
    <Panel icon={<ListChecks className="size-4" aria-hidden />} title={t.checklist.title}>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-base" style={{ width: `${pct}%` }} />
      </div>
      <p className="caption-4 mt-2 text-muted-foreground tabular-nums" aria-live="polite">
        {fill(t.checklist.progress, { done: count, total: done.length })}
      </p>
      <ul className="mt-4 flex flex-col gap-1">
        {t.checklist.items.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              aria-pressed={done[i]}
              onClick={() => toggle(i)}
              className={cn('flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left', TAP, HOVER, FOCUS)}
            >
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full border transition-[background-color,border-color] duration-300 ease-base',
                  done[i] ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/25',
                )}
                aria-hidden
              >
                {done[i] ? <Check className="size-3.5 motion-safe:animate-mk-in" /> : null}
              </span>
              <span className={cn('body-5 transition-colors duration-300', done[i] && 'text-muted-foreground line-through decoration-1')}>{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Sleep ring: drag the range input, the ring and the readout update together. */
export function SleepRing({ t }: { t: T }) {
  const { play } = useSound();
  const [hours, setHours] = useState(7.2);
  const goal = 8;
  const pct = Math.min(1, hours / goal);
  const circ = 2 * Math.PI * 44;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const last = useRef(hours);
  const id = useId();

  function onChange(v: number) {
    setHours(v);
    // A tick each time the value crosses a whole hour, so the slider has feedback without a sound on every pixel.
    if (Math.floor(v) !== Math.floor(last.current)) play('SLIDE');
    last.current = v;
  }

  return (
    <Panel icon={<Moon className="size-4" aria-hidden />} title={t.sleep.title}>
      <div className="relative mx-auto grid size-40 place-items-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r="44" fill="none" strokeWidth="7" className="stroke-muted" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-base"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
          />
        </svg>
        <div className="text-center">
          <p className="heading-5 tabular-nums" aria-live="polite">{fill(t.sleep.hours, { h, m })}</p>
          <p className="caption-5 text-muted-foreground">{fill(t.sleep.goal, { goal })}</p>
        </div>
      </div>
      <label htmlFor={id} className="caption-4 mt-5 text-muted-foreground">{t.sleep.label}</label>
      <input
        id={id}
        type="range"
        min={4}
        max={10}
        step={0.25}
        value={hours}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn('mt-2 h-11 w-full cursor-pointer accent-[hsl(var(--primary))] rounded-md', FOCUS)}
      />
    </Panel>
  );
}

/** Week strip: tap a day to see that day's numbers. */
export function WeekCalendar({ t }: { t: T }) {
  const { play } = useSound();
  const [sel, setSel] = useState(3);
  const days = t.week.days;
  const steps = [6214, 9402, 4118, 8706, 7295, 11240, 12383];
  const mood = [6, 7, 5, 8, 6, 7, 8];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function pick(i: number) {
    setSel(i);
    play('SELECT');
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (sel + dir + days.length) % days.length;
    pick(next);
    refs.current[next]?.focus();
  }

  return (
    <Panel icon={<CalendarDays className="size-4" aria-hidden />} title={t.week.title}>
      <div role="radiogroup" aria-label={t.week.title} onKeyDown={onKey} className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <button
            key={d}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={sel === i}
            tabIndex={sel === i ? 0 : -1}
            onClick={() => pick(i)}
            className={cn(
              'flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-center transition-[background-color,color,transform] duration-300 ease-base active:scale-[0.96]',
              sel === i ? 'bg-primary text-primary-foreground' : cn('text-foreground', HOVER),
              FOCUS,
            )}
          >
            <span className="caption-5 opacity-80">{d}</span>
            <span className="body-5 tabular-nums">{10 + i}</span>
          </button>
        ))}
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted p-3">
          <dt className="caption-5 text-muted-foreground">{t.week.stepsLabel}</dt>
          <dd className="title-1 mt-1 tabular-nums" aria-live="polite">{steps[sel].toLocaleString('en-US')}</dd>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <dt className="caption-5 text-muted-foreground">{t.week.moodLabel}</dt>
          <dd className="title-1 mt-1 tabular-nums" aria-live="polite">{mood[sel]} / 10</dd>
        </div>
      </dl>
    </Panel>
  );
}

/** Steps bars: tap a bar to read its value. The whole week is also keyboard reachable. */
export function StepsBars({ t }: { t: T }) {
  const { play } = useSound();
  const values = [6214, 9402, 4118, 8706, 7295, 11240, 12383];
  const max = Math.max(...values);
  const [sel, setSel] = useState(6);

  return (
    <Panel icon={<Footprints className="size-4" aria-hidden />} title={t.steps.title}>
      <p className="heading-4 tabular-nums" aria-live="polite">{values[sel].toLocaleString('en-US')}</p>
      <p className="caption-4 text-muted-foreground">{t.steps.caption}</p>
      <div className="mt-6 flex h-28 items-end gap-2" role="list">
        {values.map((v, i) => (
          <button
            key={i}
            type="button"
            role="listitem"
            aria-label={`${t.week.days[i]}: ${v.toLocaleString('en-US')}`}
            aria-pressed={sel === i}
            onClick={() => { setSel(i); play('TYPE'); }}
            className={cn('flex h-full flex-1 items-end rounded-t-lg', FOCUS)}
          >
            <span
              className={cn(
                'block w-full rounded-t-lg transition-[height,background-color] duration-500 ease-base',
                sel === i ? 'bg-primary' : 'bg-primary/35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-primary/55',
              )}
              style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
    </Panel>
  );
}

/** Reminder switches: spring thumb, sound on each change. */
export function ReminderToggles({ t }: { t: T }) {
  const { play } = useSound();
  const [on, setOn] = useState([true, false]);

  function flip(i: number) {
    const next = on.map((v, j) => (j === i ? !v : v));
    setOn(next);
    play(next[i] ? 'TOGGLE_ON' : 'TOGGLE_OFF');
  }

  return (
    <Panel icon={<Sparkles className="size-4" aria-hidden />} title={t.reminders.title}>
      <ul className="flex flex-col gap-4">
        {t.reminders.items.map(([label, time], i) => (
          <li key={label} className="flex items-center justify-between gap-4">
            <div>
              <p className="title-3">{label}</p>
              <p className="caption-5 text-muted-foreground tabular-nums">{time}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on[i]}
              aria-label={label}
              onClick={() => flip(i)}
              className={cn(
                'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ease-base',
                on[i] ? 'bg-primary' : 'bg-muted',
                FOCUS,
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-6 rounded-full bg-background shadow transition-transform duration-500 ease-base',
                  on[i] ? 'translate-x-[22px]' : 'translate-x-0.5',
                )}
              />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Topic explorer: arrow keys move between tabs, tap a topic to inspect it. */
export function TopicExplorer({ t }: { t: T }) {
  const { play } = useSound();
  const [tab, setTab] = useState(0);
  const [topic, setTopic] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const groups = t.topics.groups;
  const current = groups[tab];

  function selectTab(i: number) {
    setTab(i);
    setTopic(0);
    play('SELECT');
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (tab + dir + groups.length) % groups.length;
    selectTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <Panel icon={<ChartColumn className="size-4" aria-hidden />} title={t.topics.title} className="md:col-span-2">
      <div role="tablist" aria-label={t.topics.title} onKeyDown={onKey} className="flex flex-wrap gap-2">
        {groups.map((g, i) => (
          <button
            key={g.name}
            ref={(el) => { tabRefs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={tab === i}
            tabIndex={tab === i ? 0 : -1}
            onClick={() => selectTab(i)}
            className={cn(
              'body-5 min-h-11 rounded-full border px-4 transition-[background-color,color] duration-300 ease-base',
              tab === i ? 'border-foreground bg-foreground text-background' : cn('border-foreground/15 text-foreground', HOVER),
              FOCUS,
            )}
          >
            {g.name}
          </button>
        ))}
      </div>
      <div role="tabpanel" key={tab} className="mt-5 grid gap-6 md:grid-cols-[1fr_1.2fr] motion-safe:animate-mk-in">
        <ul className="flex flex-col gap-1" aria-label={current.name}>
          {current.topics.map((item, i) => (
            <li key={item}>
              <button
                type="button"
                aria-pressed={topic === i}
                onClick={() => { setTopic(i); play('TAP'); }}
                className={cn(
                  'body-5 flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left transition-[background-color,color] duration-300 ease-base',
                  topic === i ? 'bg-primary text-primary-foreground' : cn('text-foreground', HOVER),
                  FOCUS,
                )}
              >
                {item}
                <span aria-hidden className={cn('transition-transform duration-300 ease-base', topic === i && 'translate-x-0.5')}>→</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="rounded-2xl bg-muted p-5">
          <p className="caption-4 text-muted-foreground">{t.topics.exampleLabel}</p>
          <p className="body-3 mt-2">{current.examples[topic]}</p>
          <p className="caption-5 mt-4 text-muted-foreground">{t.topics.note}</p>
        </div>
      </div>
    </Panel>
  );
}

/** Reflection card: a read-only sample retro, the content the Retro section describes. */
export function ReflectionCard({ t }: { t: T }) {
  return (
    <Panel icon={<BookOpen className="size-4" aria-hidden />} title={t.reflection.title}>
      <p className="body-6 text-muted-foreground">{t.reflection.summary}</p>
      <dl className="mt-4 flex flex-col gap-3">
        {t.reflection.rows.map(([label, body]) => (
          <div key={label}>
            <dt className="caption-4 text-muted-foreground">{label}</dt>
            <dd className="body-5 mt-0.5">{body}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/** The "Try it" band on the landing page: six working demos plus one read-only sample retro. */
export function TrySection({ t }: { t: Dict['try'] }) {
  return (
    <section className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6" aria-labelledby="try-title">
      <p className="caption-3 uppercase tracking-widest text-muted-foreground">{t.eyebrow}</p>
      <h2 id="try-title" className="heading-3 mt-3 max-w-[680px]">{t.title}</h2>
      <p className="body-3 mt-4 max-w-[680px] text-muted-foreground">{t.sub}</p>
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DayChecklist t={t} />
        <SleepRing t={t} />
        <WeekCalendar t={t} />
        <StepsBars t={t} />
        <ReminderToggles t={t} />
        <ReflectionCard t={t} />
        <TopicExplorer t={t} />
      </div>
    </section>
  );
}
