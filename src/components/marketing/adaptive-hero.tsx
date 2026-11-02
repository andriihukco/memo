'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties, type ElementType } from 'react';
import { Ban, ArrowRight, ArrowUp, BedDouble, CalendarDays, Check, ChartColumn, Clock, Dumbbell, Droplets, Gauge, ListChecks, Tag, Target, Utensils, Wallet } from 'lucide-react';
import { SkyCanvas } from './sky-canvas';
import { PERSONAS, TELEGRAM_HREF, isPersona, type Dict, type PersonaSlug } from '@/lib/marketing/dict';
import { cn } from '@/lib/utils';

const STORE_KEY = 'memo-site-persona';
/** How long each persona stays before the carousel moves on. */
const STEP_MS = 12000;
/** Typing speed for the demo entry, per character. */
const TYPE_MS = 58;
/** The AI reading pass: the words in the entry are scanned left to right. */
const SCAN_MS = 2600;

type Kind = 'record' | 'reminder' | 'note' | 'thought' | 'chart' | 'ring' | 'todo';

const ICONS: Record<PersonaSlug, ElementType> = {
  food: Utensils,
  money: Wallet,
  water: Droplets,
  quit: Ban,
  sleep: BedDouble,
  fitness: Dumbbell,
};

/**
 * What the AI turns each detected value into, in the order of the persona's demo output.
 * Numbers and goals become records, times become reminders, dates become notes, and categories become thoughts.
 */
const KINDS: Record<PersonaSlug, Kind[]> = {
  food: ['record', 'record', 'chart', 'todo'],
  money: ['record', 'chart', 'note', 'thought'],
  water: ['record', 'record', 'ring', 'reminder'],
  quit: ['record', 'record', 'thought', 'reminder'],
  sleep: ['record', 'ring', 'record', 'reminder'],
  fitness: ['record', 'record', 'chart', 'record'],
};

/** One hue per kind. Chips use it at 10% fill, with the hue on the border and icon. */
const KIND_STYLE: Record<Kind, { hue: string; icon: ElementType }> = {
  record: { hue: '227 100% 60%', icon: Gauge },
  reminder: { hue: '38 95% 55%', icon: Clock },
  note: { hue: '160 70% 42%', icon: CalendarDays },
  thought: { hue: '262 70% 64%', icon: Tag },
  chart: { hue: '152 65% 42%', icon: ChartColumn },
  ring: { hue: '190 85% 45%', icon: Target },
  todo: { hue: '330 75% 58%', icon: ListChecks },
};

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

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

/** Pause between one value lifting out of the text and the next. Slow on purpose. */
const LIFT_STEP = 900;
/** How long a value takes to lift out of the text before its widget bounces in. */
const LIFT_MS = 800;

/** The index of the word each detected value comes from, or -1 when the entry does not name it. */
function valueWordIndex(input: string, values: string[]): number[] {
  const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const words = input.split(' ');
  const claimed = new Set<number>();
  return values.map((value) => {
    const tokens = value.split(' ').map(norm).filter((x) => x.length > 0);
    const at = words.findIndex((w, wi) => !claimed.has(wi) && tokens.includes(norm(w)));
    if (at >= 0) claimed.add(at);
    return at;
  });
}

/**
 * The demo timeline for one persona, as a function of elapsed time. Typing, then the reading pass,
 * then one step per value: its word lifts out of the text, and its widget bounces in.
 */
function timeline(input: string, elapsed: number, count: number) {
  const words = input.split(' ').length;
  const typeEnd = input.length * TYPE_MS;
  const scanEnd = typeEnd + SCAN_MS;
  const typed = Math.min(input.length, Math.floor(elapsed / TYPE_MS));
  const phase: 'typing' | 'analyzing' | 'done' = elapsed < typeEnd ? 'typing' : elapsed < scanEnd ? 'analyzing' : 'done';
  const scanned = phase === 'analyzing' ? Math.floor(((elapsed - typeEnd) / SCAN_MS) * words) : phase === 'done' ? words : 0;
  const lifted = elapsed < scanEnd ? 0 : Math.min(count, Math.floor((elapsed - scanEnd) / LIFT_STEP) + 1);
  const chips = elapsed < scanEnd + LIFT_MS ? 0 : Math.min(count, Math.floor((elapsed - scanEnd - LIFT_MS) / LIFT_STEP) + 1);
  return { typed, phase, scanned, chips, lifted, words };
}

/**
 * Centred hero. A carousel of persona chips sits above the composer. The chips fade out at both
 * edges and the active one stays centred. Each chip fills left to right over STEP_MS, then the next
 * persona takes over. In the composer the entry types out, the logo turns into typing dots, the AI
 * reads the words left to right, and the results land as record, reminder, note and thought chips.
 * Hovering or focusing pauses the timer. Reduced motion turns auto-advance off.
 */
export function AdaptiveHero({ t, initial, telegramUrl, billingOpen }: Props) {
  const [active, setActive] = useState<PersonaSlug>(initial ?? 'fitness');
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const activeRef = useRef(active);
  const elapsedRef = useRef(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  // The persona being replaced, shown fading out while the next one fades in.
  const [leaving, setLeaving] = useState<PersonaSlug | null>(null);
  const shownRef = useRef(active);
  useEffect(() => {
    if (shownRef.current === active) return;
    const previous = shownRef.current;
    shownRef.current = active;
    setLeaving(previous);
    const id = window.setTimeout(() => setLeaving(null), 320);
    return () => window.clearTimeout(id);
  }, [active]);
  const chipRefs = useRef<Partial<Record<PersonaSlug, HTMLButtonElement | null>>>({});

  // Saved choice wins over the default, but a ?for= link always wins over the saved choice.
  useEffect(() => {
    if (initial) return;
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (isPersona(saved)) {
        activeRef.current = saved;
        setActive(saved);
      }
    } catch {
      /* storage blocked: keep the default */
    }
    setAutoplay(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, [initial]);

  // One clock drives the whole demo. It keeps its position while paused and rolls to the next persona when full.
  useEffect(() => {
    if (!autoplay || paused) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      elapsedRef.current += dt;
      if (elapsedRef.current >= STEP_MS) {
        const idx = PERSONAS.indexOf(activeRef.current);
        const next = PERSONAS[(idx + 1) % PERSONAS.length];
        elapsedRef.current = 0;
        activeRef.current = next;
        setActive(next);
      }
      setElapsed(elapsedRef.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [autoplay, paused]);

  // Keep the active chip centred in the row. Spacers at both ends let the first and last chips centre too.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const chip = chipRefs.current[active];
    if (!scroller || !chip) return;
    const left = chip.offsetLeft + chip.offsetWidth / 2 - scroller.clientWidth / 2;
    scroller.scrollTo({ left, behavior: 'smooth' });
  }, [active]);

  function pick(slug: PersonaSlug) {
    activeRef.current = slug;
    elapsedRef.current = 0;
    setActive(slug);
    setElapsed(0);
    try {
      localStorage.setItem(STORE_KEY, slug);
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    url.searchParams.set('for', slug);
    window.history.replaceState(null, '', url);
  }

  const persona = t.personas[active];
  const progress = Math.min(1, elapsed / STEP_MS);
  const cta = { href: '/login', label: t.hero.cta };

  return (
    <>
      <section className="relative isolate flex min-h-svh items-center overflow-hidden bg-day-bottom dark:bg-night-top" aria-labelledby="hero-title">
        <SkyCanvas />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-b from-transparent to-background" />

        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-10 px-4 pb-24 pt-32 text-center sm:px-6 lg:pt-36">
          <div className="flex flex-col items-center gap-6">
            <h1 id="hero-title" key={active} className="heading-1 hero-ink max-w-[680px] pb-1 motion-safe:animate-mk-in">
              {persona.h1.map((line, i) => (
                <span key={line} className="block">
                  {line}
                  {i < persona.h1.length - 1 ? ' ' : null}
                </span>
              ))}
            </h1>
            <p className="body-3 max-w-[680px] text-foreground/80 motion-safe:animate-mk-in sm:text-lg" style={{ animationDelay: '80ms' }}>
              {persona.sub}
            </p>
            <div className="flex flex-col items-center gap-3">
              <Link
                href={cta.href}
                className={cn(
                  'btn-shimmer button-md group inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-primary-foreground shadow-lg transition-transform duration-300 ease-base active:scale-[0.98] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5',
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

          <div className="flex w-full flex-col items-center gap-4">
            <p id="persona-label" className="caption-3 uppercase tracking-widest text-foreground/70">
              {t.hero.pickLabel}
            </p>
            <div
              ref={scrollerRef}
              onPointerEnter={() => setPaused(true)}
              onPointerLeave={() => setPaused(false)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              className="relative -mx-4 w-[calc(100%+2rem)] overflow-x-auto pb-1 [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)] [scrollbar-width:none] sm:mx-0 sm:w-full [&::-webkit-scrollbar]:hidden"
            >
              {/* Half the row of padding on each side, so the first and last chips can sit in the centre. */}
              <div role="group" aria-labelledby="persona-label" className="flex w-max items-center gap-2 px-[50%]">
                {PERSONAS.map((slug) => (
                  <PersonaChip
                    key={slug}
                    icon={ICONS[slug]}
                    label={t.personas[slug].chip}
                    on={slug === active}
                    progress={progress}
                    onPick={() => pick(slug)}
                    chipRef={(el) => {
                      chipRefs.current[slug] = el;
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="relative w-full max-w-md">
            {leaving ? (
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 motion-safe:animate-mk-fade-out">
                <Composer t={t} slug={leaving} elapsed={Infinity} />
              </div>
            ) : null}
            <div key={active} className="motion-safe:animate-mk-fade-in">
              <Composer t={t} slug={active} elapsed={elapsed} />
            </div>
          </div>
        </div>
      </section>

      <PersonaBand t={t} slug={active} telegramUrl={telegramUrl} />
    </>
  );
}

/** Chip label: icon and text. The aria copy is hidden from assistive tech, as it repeats the real label. */
function ChipLabel({
  icon: Icon,
  label,
  className,
  style,
  aria,
}: {
  icon: ElementType;
  label: string;
  className?: string;
  style?: CSSProperties;
  aria?: boolean;
}) {
  return (
    <span aria-hidden={aria || undefined} className={cn('flex items-center gap-2', className)} style={style}>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span>{label}</span>
    </span>
  );
}

/**
 * Liquid fill, left to right. The water is a solid layer that slides in from the left as progress
 * rises, with a rolling wave on its leading edge and a second, lighter crest for depth. The slide is
 * eased, so each update reads as a smooth fill rather than a jump.
 */
/** Solid white fill that slides in from the left with progress. No wave. */
function SolidFill({ progress }: { progress: number }) {
  return (
    <span aria-hidden className="absolute inset-0 overflow-hidden">
      <span className="absolute inset-0 bg-white" style={{ transform: `translateX(${(progress - 1) * 100}%)`, transition: 'transform 500ms ease-out' }} />
    </span>
  );
}

/** Particles for the Thanos dust: fixed offsets per particle, so every burst looks the same. */
const DUST = Array.from({ length: 22 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin((i + 1) * n * 127.1) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    left: `${4 + r(1) * 92}%`,
    top: `${10 + r(2) * 80}%`,
    dx: `${(r(3) - 0.3) * 80}px`,
    dy: `${-20 - r(4) * 50}px`,
    delay: `${r(5) * 180}ms`,
    size: `${2 + r(6) * 3}px`,
  };
});

/**
 * A persona chip. Its label is set in dark over the white fill and light outside it. When the chip
 * stops being active, its fill dissolves into dust particles, as a Thanos snap would.
 */
function PersonaChip({
  icon: Icon,
  label,
  on,
  progress,
  onPick,
  chipRef,
}: {
  icon: ElementType;
  label: string;
  on: boolean;
  progress: number;
  onPick: () => void;
  chipRef: (el: HTMLButtonElement | null) => void;
}) {
  const wasOn = useRef(on);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (wasOn.current && !on) setBurst((n) => n + 1);
    wasOn.current = on;
  }, [on]);

  return (
    <button
      ref={chipRef}
      type="button"
      aria-pressed={on}
      onClick={onPick}
      className={cn(
        'body-5 relative flex min-h-11 shrink-0 items-center gap-2 overflow-visible rounded-full border px-4 transition-[border-color,background-color] duration-500 ease-base active:scale-[0.98]',
        on ? 'border-transparent bg-background/50 text-foreground' : 'border-foreground/15 bg-background/40 text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground/10',
        FOCUS,
      )}
    >
      <span aria-hidden className="absolute inset-0 overflow-hidden rounded-full">
        {on ? <SolidFill progress={progress} /> : null}
      </span>
      <ChipLabel icon={Icon} label={label} className="text-foreground" />
      {on ? (
        <ChipLabel
          icon={Icon}
          label={label}
          aria
          className="absolute inset-0 px-4 text-slate-900 transition-[clip-path] duration-500 ease-out"
          style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}
        />
      ) : null}
      {burst > 0 ? (
        <span key={burst} aria-hidden className="pointer-events-none absolute inset-0">
          {DUST.map((d, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white motion-safe:animate-mk-dust"
              style={{
                left: d.left,
                top: d.top,
                width: d.size,
                height: d.size,
                animationDelay: d.delay,
                ['--dx' as string]: d.dx,
                ['--dy' as string]: d.dy,
              }}
            />
          ))}
        </span>
      ) : null}
    </button>
  );
}

/** Where the five dots start (a typing row) and where they land (the M, as in the logo). */
/** Five dots in a wide typing row, then on a ring around the centre (16, 16), then in the M of the logo. */
const DOT_ROW: [number, number][] = [[5, 16], [10.5, 16], [16, 16], [21.5, 16], [27, 16]];
const DOT_RING: [number, number][] = Array.from({ length: 5 }, (_, i) => {
  const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
  return [16 + 9 * Math.cos(a), 16 + 9 * Math.sin(a)];
});
const DOT_M: [number, number][] = [[15.89, 22.67], [7, 22.67], [11.44, 9.33], [20.33, 9.33], [24.78, 22.67]];
const M_PATH = 'M7 22.6666L11.4444 9.33325L15.8889 22.6666L20.3333 9.33325L24.7778 22.6666';

/**
 * Memo's loader, in three beats: five dots in a typing row, the dots turn on a ring and the ring
 * spins, then the dots settle into the M of the logo and the M draws itself.
 */
type MarkStage = 'row' | 'ring' | 'm';

function MemoMark({ stage, className }: { stage: MarkStage; className?: string }) {
  const target = stage === 'row' ? DOT_ROW : stage === 'ring' ? DOT_RING : DOT_M;
  return (
    <span className={cn('relative block', className)} aria-hidden>
      <svg viewBox="0 0 32 32" className="size-full overflow-visible">
        <path
          d={M_PATH}
          fill="none"
          strokeWidth="1.1"
          pathLength={1}
          className="stroke-foreground transition-[stroke-dashoffset,opacity] duration-700 ease-base"
          style={{ strokeDasharray: 1, strokeDashoffset: stage === 'm' ? 0 : 1, opacity: stage === 'm' ? 1 : 0 }}
        />
        <g className={stage === 'ring' ? 'animate-mk-orbit' : undefined} style={{ transformOrigin: '16px 16px' }}>
          {DOT_ROW.map(([x, y], i) => {
            const [tx, ty] = target[i];
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="1.7"
                className={cn('fill-foreground transition-transform duration-700 ease-base', stage === 'row' && 'motion-safe:animate-mk-bounce')}
                style={{
                  transform: `translate(${tx - x}px, ${ty - y}px)`,
                  animationDelay: stage === 'row' ? `${i * 110}ms` : undefined,
                }}
              />
            );
          })}
        </g>
      </svg>
    </span>
  );
}

/** Fixed tilts for the four widgets, in degrees. Fixed (not random per render), so the page is stable. */
const TILT = [-3.8, 2.6, -4.7, 4.2];

/** The visual inside a widget, by kind: bars for a chart, a ring for progress, a checklist for to-dos. */
function WidgetVisual({ kind, hue, value }: { kind: Kind; hue: string; value: string }) {
  if (kind === 'chart') {
    const bars = [38, 64, 46, 82, 58];
    return (
      <div className="flex h-10 items-end gap-1" aria-hidden>
        {bars.map((h, i) => (
          <span key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: `hsl(${hue} / ${0.35 + (i === 3 ? 0.5 : 0)})` }} />
        ))}
      </div>
    );
  }
  if (kind === 'ring') {
    const pct = Number((value.match(/(\d+)\s*%/) ?? value.match(/(\d+)\s*\/\s*10/) ?? [0, 60])[1]) / (value.includes('/ 10') || value.includes('/10') ? 10 : 100);
    const C = 2 * Math.PI * 14;
    return (
      <svg viewBox="0 0 36 36" className="size-10 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="14" fill="none" strokeWidth="4" className="stroke-foreground/10" />
        <circle cx="18" cy="18" r="14" fill="none" strokeWidth="4" strokeLinecap="round" style={{ stroke: `hsl(${hue})`, strokeDasharray: C, strokeDashoffset: C * (1 - Math.min(1, pct)) }} />
      </svg>
    );
  }
  if (kind === 'todo') {
    const done = Number((value.match(/^(\d+)/) ?? [0, 2])[1]);
    return (
      <ul className="flex flex-col gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span className="grid size-3 place-items-center rounded-full border" style={i < done ? { background: `hsl(${hue})`, borderColor: `hsl(${hue})` } : { borderColor: `hsl(${hue} / 0.5)` }} />
            <span className="h-1.5 flex-1 rounded-full" style={{ background: `hsl(${hue} / ${i < done ? 0.5 : 0.18})` }} />
          </li>
        ))}
      </ul>
    );
  }
  return null;
}

/** An Apple-style widget: a square card with an icon badge, a visual where the kind has one, and the value. Nothing is cut off. */
function WidgetCard({ kind, label, value, title, tilt }: { kind: Kind; label: string; value: string; title: string; tilt: number }) {
  const { hue, icon: Icon } = KIND_STYLE[kind];
  return (
    <div
      className="group flex aspect-square w-full min-w-0 cursor-default flex-col justify-between gap-2 rounded-3xl border border-foreground/10 bg-background/70 p-2.5 shadow-sm backdrop-blur-xl transition-transform duration-500 ease-base motion-safe:animate-mk-bounce-in sm:p-3 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1"
      style={{ rotate: `${tilt}deg` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-full" style={{ background: `hsl(${hue} / 0.16)` }}>
          <Icon className="size-3.5" style={{ color: `hsl(${hue})` }} aria-hidden />
        </span>
        <span className="caption-5 text-right text-muted-foreground">{title}</span>
      </div>
      <WidgetVisual kind={kind} hue={hue} value={value} />
      <div>
        <p className="title-2 break-words tabular-nums text-foreground">{value}</p>
        <p className="caption-5 break-words text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/**
 * Which kind each word of the entry belongs to. A word belongs to a detected value when it is that
 * value's number or word, so "150" in "150 UAH groceries" takes the colour of its record.
 */
function wordKinds(input: string, values: string[], kinds: Kind[]): (Kind | null)[] {
  const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const words = input.split(' ');
  const claimed = new Set<number>();
  const out: (Kind | null)[] = words.map(() => null);
  values.forEach((value, i) => {
    const tokens = value.split(' ').map(norm).filter((x) => x.length > 0);
    const at = words.findIndex((w, wi) => !claimed.has(wi) && tokens.includes(norm(w)));
    if (at >= 0) {
      claimed.add(at);
      out[at] = kinds[i];
    }
  });
  return out;
}

/**
 * The typed entry. Letters pop in with a springy overshoot. A word the AI has read takes its kind's
 * colour and a bold weight, a highlight sweeps in from the left, and the word gives one small pop.
 * A word that becomes a value lifts out of the text and fades, leaving its space behind.
 */
function TypedText({ text, lit, kinds, lifted }: { text: string; lit: number; kinds: (Kind | null)[]; lifted: Set<number> }) {
  const words = text.split(' ');
  let index = 0;
  return (
    <>
      {words.map((w, wi) => {
        const chars = Array.from(w).map((ch) => {
          const k = index++;
          return (
            <span key={k} className="inline-block whitespace-pre motion-safe:animate-mk-letter">
              {ch}
            </span>
          );
        });
        const read = wi < lit;
        const kind = kinds[wi];
        const hue = kind ? KIND_STYLE[kind].hue : '227 100% 60%';
        return (
          <span
            key={wi}
            style={{ ['--hl' as string]: hue }}
            className={cn(
              'relative inline-block rounded-md px-0.5 transition-[color,font-weight] duration-500 ease-base',
              'before:absolute before:inset-0 before:-z-10 before:origin-left before:scale-x-0 before:rounded-md before:transition-transform before:duration-500 before:ease-base before:content-[\'\']',
              'before:[background-color:hsl(var(--hl)/0.22)]',
              read && 'font-semibold before:scale-x-100 motion-safe:animate-mk-word-pop [color:hsl(var(--hl))]',
              lifted.has(wi) && 'motion-safe:animate-mk-lift',
            )}
          >
            {chars}
            {wi < words.length - 1 ? ' ' : null}
          </span>
        );
      })}
    </>
  );
}

/** The composer: the Memo reply and its widgets sit above; the entry is typed in the text area below. */
function Composer({ t, slug, elapsed }: { t: Props['t']; slug: PersonaSlug; elapsed: number }) {
  const p = t.personas[slug];
  const input = p.demoInput;
  const { typed, phase, scanned, chips, lifted } = timeline(input, elapsed, p.demoOut.length);
  const liftedWords = new Set(valueWordIndex(input, p.demoOut.map((d) => d[1])).slice(0, lifted).filter((w) => w >= 0));
  const sinceScan = elapsed - input.length * TYPE_MS;
  const stage: MarkStage = phase === 'analyzing' ? (sinceScan < 600 ? 'row' : sinceScan < 1800 ? 'ring' : 'm') : 'm';
  const sent = phase !== 'typing';

  return (
    <div className="w-full max-w-md text-left" aria-live="polite">
      {/* Memo's reply: above the text area, with its widgets. */}
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <MemoMark stage={stage} className="size-7 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="caption-4 text-muted-foreground">{t.hero.memo}</p>
            <p className="caption-3 flex items-center gap-1.5 text-foreground">
              {phase === 'done' ? <Check className="size-3" aria-hidden /> : null}
              {phase === 'done' ? t.hero.parsed : phase === 'analyzing' ? t.hero.analyzing : ' '}
            </p>
          </div>
        </div>
        {chips > 0 ? (
          <div className="mt-4 flex items-stretch px-3 py-4">
            {p.demoOut.map(([label, value], i) => {
              if (i >= chips) return null;
              const kind = KINDS[slug][i];
              return (
                <div key={label} className={cn('flex min-w-0 flex-1', i > 0 && '-ml-3')}>
                  <WidgetCard kind={kind} title={t.hero.kinds[kind]} label={label} value={value} tilt={TILT[i]} />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Composer: the text area where the entry is written. The newest value rises from it as a popover. */}
      <div className="relative rounded-3xl border border-foreground/10 bg-background/75 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
        {chips > 0 && phase === 'done' ? (
          <span
            key={chips}
            aria-hidden
            className="pointer-events-none absolute -top-3 left-1/2 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold motion-safe:animate-mk-pop-up"
            style={{
              background: `hsl(${KIND_STYLE[KINDS[slug][chips - 1]].hue} / 0.14)`,
              borderColor: `hsl(${KIND_STYLE[KINDS[slug][chips - 1]].hue} / 0.4)`,
              color: `hsl(${KIND_STYLE[KINDS[slug][chips - 1]].hue})`,
            }}
          >
            {p.demoOut[chips - 1][1]}
          </span>
        ) : null}
        <div className="min-h-[4rem] text-base leading-relaxed text-foreground" aria-label={t.hero.you}>
          {typed === 0 ? (
            <span className="text-muted-foreground">
              {t.hero.placeholder}
              <span className="ml-0.5 inline-block h-4 w-px animate-mk-caret bg-foreground align-middle" />
            </span>
          ) : (
            <TypedText text={input.slice(0, typed)} lit={phase === 'typing' ? 0 : scanned} kinds={wordKinds(input, p.demoOut.map((d) => d[1]), KINDS[slug])} lifted={liftedWords} />
          )}
          {phase === 'typing' && typed > 0 ? <span className="ml-0.5 inline-block h-4 w-px animate-mk-caret bg-foreground align-middle" /> : null}
        </div>
        <div className="mt-3 flex justify-end">
          {/* Send: presses, flies up and right, and settles as the entry is sent. */}
          <span
            className={cn(
              'relative flex size-9 items-center justify-center rounded-full transition-colors duration-500',
              sent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            {/* Ripple: rings spread out from the button, like a stone dropped in still water. */}
            {phase === 'analyzing' ? (
              <>
                <span aria-hidden className="absolute inset-0 rounded-full border-2 border-primary motion-safe:animate-mk-ripple" />
                <span aria-hidden className="absolute inset-0 rounded-full border-2 border-primary motion-safe:animate-mk-ripple [animation-delay:500ms]" />
              </>
            ) : null}
            <ArrowUp className="relative size-4" aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
}

function PersonaBand({ t, slug, telegramUrl }: { t: Props['t']; slug: PersonaSlug; telegramUrl: string | null }) {
  const p = t.personas[slug];
  const magnetHref = resolveHref(p.magnet.href, telegramUrl);
  const external = magnetHref.startsWith('http');
  return (
    <section key={slug} className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6" aria-labelledby="band-title">
      <p className="caption-3 uppercase tracking-widest text-muted-foreground">{t.band.eyebrow}</p>
      <h2 id="band-title" className="heading-4 mt-2">{p.chip}</h2>
      <div className="mt-8 grid gap-4 text-left lg:grid-cols-4">
        {p.benefits.map(([title, body], i) => (
          <div key={title} className="rounded-2xl border bg-card p-6 motion-safe:animate-mk-in" style={{ animationDelay: `${i * 60}ms` }}>
            <h3 className="title-2">{title}</h3>
            <p className="body-6 mt-2 text-muted-foreground">{body}</p>
          </div>
        ))}
        <div className="flex flex-col rounded-2xl bg-primary p-6 text-left text-primary-foreground motion-safe:animate-mk-in" style={{ animationDelay: '180ms' }}>
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
