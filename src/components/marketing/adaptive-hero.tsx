'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties, type ElementType } from 'react';
import { ArrowRight, ArrowUp, BedDouble, CalendarDays, Check, Clock, Dumbbell, Gauge, NotebookPen, Send, ShieldCheck, Tag, Target, Wallet } from 'lucide-react';
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
/** Gap between result chips appearing one after another. */
const CHIP_MS = 220;

type Kind = 'record' | 'reminder' | 'note' | 'thought';

const ICONS: Record<PersonaSlug, ElementType> = {
  fitness: Dumbbell,
  reflect: NotebookPen,
  money: Wallet,
  sleep: BedDouble,
  goals: Target,
  privacy: ShieldCheck,
  telegram: Send,
};

/**
 * What the AI turns each detected value into, in the order of the persona's demo output.
 * Numbers and goals become records, times become reminders, dates become notes, and categories become thoughts.
 */
const KINDS: Record<PersonaSlug, Kind[]> = {
  fitness: ['record', 'record', 'record', 'record'],
  reflect: ['thought', 'record', 'record', 'note'],
  money: ['record', 'record', 'note', 'thought'],
  sleep: ['record', 'record', 'record', 'reminder'],
  goals: ['record', 'record', 'record', 'record'],
  privacy: ['thought', 'record', 'record', 'record'],
  telegram: ['record', 'record', 'thought', 'record'],
};

/** One hue per kind. Chips use it at 10% fill, with the hue on the border and icon. */
const KIND_STYLE: Record<Kind, { hue: string; icon: ElementType }> = {
  record: { hue: '227 100% 60%', icon: Gauge },
  reminder: { hue: '38 95% 55%', icon: Clock },
  note: { hue: '160 70% 42%', icon: CalendarDays },
  thought: { hue: '262 70% 64%', icon: Tag },
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

/** The demo timeline for one persona, as a function of elapsed time. */
function timeline(input: string, elapsed: number) {
  const words = input.split(' ').length;
  const typeEnd = input.length * TYPE_MS;
  const scanEnd = typeEnd + SCAN_MS;
  const typed = Math.min(input.length, Math.floor(elapsed / TYPE_MS));
  const phase: 'typing' | 'analyzing' | 'done' = elapsed < typeEnd ? 'typing' : elapsed < scanEnd ? 'analyzing' : 'done';
  const scanned = phase === 'analyzing' ? Math.floor(((elapsed - typeEnd) / SCAN_MS) * words) : phase === 'done' ? words : 0;
  const chips = phase === 'done' ? Math.min(4, Math.floor((elapsed - scanEnd) / CHIP_MS) + 1) : 0;
  return { typed, phase, scanned, chips, words };
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
  const isTelegram = active === 'telegram' && telegramUrl;
  const cta = isTelegram ? { href: telegramUrl, label: t.hero.telegramCta } : { href: '/login', label: t.hero.cta };

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
                {PERSONAS.map((slug) => {
                  const Icon = ICONS[slug];
                  const on = slug === active;
                  return (
                    <button
                      key={slug}
                      ref={(el) => {
                        chipRefs.current[slug] = el;
                      }}
                      type="button"
                      aria-pressed={on}
                      onClick={() => pick(slug)}
                      className={cn(
                        'body-5 relative flex min-h-11 shrink-0 items-center gap-2 overflow-hidden rounded-full border px-4 transition-[border-color] duration-500 ease-base active:scale-[0.98]',
                        on ? 'border-primary text-primary-foreground' : 'border-foreground/15 text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground/10',
                        FOCUS,
                      )}
                    >
                      {on ? <LiquidFill progress={progress} /> : null}
                      <ChipLabel icon={Icon} label={t.personas[slug].chip} className="text-foreground" />
                      {on ? (
                        <ChipLabel
                          icon={Icon}
                          label={t.personas[slug].chip}
                          aria
                          className="absolute inset-0 px-4 text-primary-foreground transition-[clip-path] duration-500 ease-base"
                          style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}
                        />
                      ) : null}
                    </button>
                  );
                })}
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
/**
 * The leading edge of the fill: a gentle sine, 2.5 units deep in a 10-unit strip. It repeats every
 * 50 units, so the strip can scroll by two periods and loop with no seam.
 */
const WAVE_EDGE = (() => {
  const pts: string[] = [];
  for (let y = 0; y <= 200; y += 2) {
    const x = 5 + 2.5 * Math.sin((y / 50) * 2 * Math.PI);
    pts.push(`${y === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y}`);
  }
  return `${pts.join(' ')} L0 200 L0 0 Z`;
})();

/** Left-to-right fill. The water eases in as progress rises and its edge rolls gently. */
function LiquidFill({ progress }: { progress: number }) {
  return (
    <span aria-hidden className="absolute inset-0 overflow-hidden">
      <span
        className="absolute inset-y-0 left-0 w-full bg-primary transition-transform duration-500 ease-out"
        style={{ transform: `translateX(${(progress - 1) * 100}%)` }}
      >
        <span className="absolute left-full top-[-50%] block h-[200%] w-2.5 animate-mk-wave-y">
          <svg viewBox="0 0 10 200" preserveAspectRatio="none" className="size-full">
            <path className="fill-primary" d={WAVE_EDGE} />
          </svg>
        </span>
      </span>
    </span>
  );
}

/** Words for the typed text: each letter rises in as it is typed, so the entry feels written, not pasted. */
function TypedText({ text, lit }: { text: string; lit: number }) {
  const words = text.split(' ');
  let index = 0;
  return (
    <>
      {words.map((w, wi) => {
        const wordIndex = wi;
        const chars = Array.from(w).map((ch) => {
          const k = index++;
          return (
            <span key={k} className="inline-block motion-safe:animate-mk-char" style={{ animationDelay: '0ms' }}>
              {ch}
            </span>
          );
        });
        return (
          <span
            key={wordIndex}
            className={cn(
              'inline-block rounded-md px-0.5 transition-[background-color,transform] duration-500 ease-base',
              wordIndex < lit && 'bg-primary/15 text-foreground -translate-y-0.5',
            )}
          >
            {chars}
            {wi < words.length - 1 ? ' ' : null}
          </span>
        );
      })}
    </>
  );
}

/** Five dots in a typing row, then evenly spaced on a circle around the centre (16, 16). */
const DOT_ROW: [number, number][] = [[7, 16], [11.5, 16], [16, 16], [20.5, 16], [25, 16]];
const DOT_RING: [number, number][] = Array.from({ length: 5 }, (_, i) => {
  const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
  return [16 + 9 * Math.cos(a), 16 + 9 * Math.sin(a)];
});

/**
 * Memo's mark. Five dots bounce in a typing row, glide into a ring, and the ring turns.
 * Rotation is a plain CSS spin on the group, so it stays smooth.
 */
type MarkStage = 'row' | 'ring';

function MemoMark({ stage, className }: { stage: MarkStage; className?: string }) {
  const ring = stage === 'ring';
  return (
    <span className={cn('relative block', className)} aria-hidden>
      <svg viewBox="0 0 32 32" className="size-full overflow-visible">
        <g className={ring ? 'animate-mk-orbit' : undefined} style={{ transformOrigin: '16px 16px' }}>
          {DOT_ROW.map(([x, y], i) => {
            const [rx, ry] = DOT_RING[i];
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="1.9"
                className={cn('fill-foreground transition-transform duration-700 ease-base', !ring && 'motion-safe:animate-mk-bounce')}
                style={{
                  transform: ring ? `translate(${rx - x}px, ${ry - y}px)` : 'translate(0px, 0px)',
                  animationDelay: !ring ? `${i * 90}ms` : undefined,
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

/** An Apple-style widget: a rounded card with an icon badge, the value large, and its label below. */
function WidgetCard({ kind, label, value, title, tilt }: { kind: Kind; label: string; value: string; title: string; tilt: number }) {
  const { hue, icon: Icon } = KIND_STYLE[kind];
  return (
    <div
      className="group flex min-h-[7.5rem] cursor-default flex-col justify-between rounded-3xl border border-foreground/10 bg-background/70 p-3 shadow-sm backdrop-blur-xl transition-transform duration-500 ease-base motion-safe:animate-mk-rise [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1"
      style={{ rotate: `${tilt}deg` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="grid size-7 place-items-center rounded-full" style={{ background: `hsl(${hue} / 0.14)` }}>
          <Icon className="size-3.5" style={{ color: `hsl(${hue})` }} aria-hidden />
        </span>
        <span className="caption-5 truncate text-muted-foreground">{title}</span>
      </div>
      <div className="mt-2">
        <p className="title-1 truncate tabular-nums text-foreground">{value}</p>
        <p className="caption-5 truncate text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** The composer: the Memo reply and its widgets sit above; the entry is typed in the text area below. */
function Composer({ t, slug, elapsed }: { t: Props['t']; slug: PersonaSlug; elapsed: number }) {
  const p = t.personas[slug];
  const input = p.demoInput;
  const { typed, phase, scanned, chips } = timeline(input, elapsed);
  const sinceScan = elapsed - input.length * TYPE_MS;
  const stage: MarkStage = phase === 'analyzing' && sinceScan < 700 ? 'row' : 'ring';
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
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {p.demoOut.map(([label, value], i) => {
              if (i >= chips) return null;
              const kind = KINDS[slug][i];
              return <WidgetCard key={label} kind={kind} title={t.hero.kinds[kind]} label={label} value={value} tilt={TILT[i]} />;
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
            <TypedText text={input.slice(0, typed)} lit={phase === 'typing' ? 0 : scanned} />
          )}
          {phase === 'typing' && typed > 0 ? <span className="ml-0.5 inline-block h-4 w-px animate-mk-caret bg-foreground align-middle" /> : null}
        </div>
        <div className="mt-3 flex justify-end">
          {/* Send: presses, flies up and right, and settles as the entry is sent. */}
          <span
            key={sent ? 'sent' : 'idle'}
            className={cn(
              'flex size-9 items-center justify-center rounded-full transition-colors duration-500',
              sent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              phase === 'analyzing' && 'motion-safe:animate-mk-send',
            )}
          >
            <ArrowUp className="size-4" aria-hidden />
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
