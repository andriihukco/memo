'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Activity, Beef, ChevronRight, Coffee, Droplets, Flame, Footprints, MapPin, Moon, PenLine, Scale, Smile, Timer,
  Utensils, Wheat, Zap, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ENTRIES_CHANGED_EVENT, useCompose } from '@/components/features/compose/compose-drawer';
import { useAuth } from '@/lib/supabase/auth-context';
import { useI18n } from '@/lib/i18n/context';
import { buildToday, type TodayEntry, type TodayTile } from '@/lib/today';
import { entryTime, unitLabel } from '@/lib/metrics';
import type { Goal } from '@/lib/goals';
import { hapticNotification } from '@/lib/haptics';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  droplets: Droplets, utensils: Utensils, moon: Moon, smile: Smile, footprints: Footprints, 'map-pin': MapPin,
  timer: Timer, flame: Flame, scale: Scale, coffee: Coffee, zap: Zap, activity: Activity, beef: Beef, wheat: Wheat,
};

type Status = 'loading' | 'ready' | 'error';

/** A ring that fills toward the day goal. Decorative: the value and goal are in the text beside it. */
function Ring({ ratio, met }: { ratio: number; met: boolean }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="size-11 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="5" className="stroke-muted" />
      <circle
        cx="22" cy="22" r={r} fill="none" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - ratio)}
        className={cn('transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none', met ? 'stroke-primary' : 'stroke-primary/70')}
      />
    </svg>
  );
}

function Tile({ tile, locale, t }: { tile: TodayTile; locale: string; t: (k: string, p?: Record<string, string | number>) => string }) {
  const Icon = ICONS[tile.icon ?? ''] ?? Activity;
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const unit = unitLabel(tile.unit, locale);
  return (
    <li className="flex min-h-24 flex-col justify-between gap-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/60">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
        <Icon className="size-4" aria-hidden="true" />
        <span className="truncate">{tile.label}</span>
      </p>
      <div className="flex items-end justify-between gap-2">
        <p className="leading-none">
          <span className="text-2xl font-bold tabular-nums tracking-tight">{fmt.format(tile.value)}</span>{' '}
          <span className="text-sm text-muted-foreground">{unit}</span>
          {tile.goal ? (
            <span className="mt-1 block text-xs text-muted-foreground">
              {t('today.goal_of', { target: fmt.format(tile.goal.target), unit })}
            </span>
          ) : null}
        </p>
        {tile.goal ? <Ring ratio={tile.goal.ratio} met={tile.goal.met} /> : null}
      </div>
    </li>
  );
}

/**
 * Today: Apple Health's Summary for a journal. Totals for today (with day goals as rings),
 * one-tap logging, and what was written today. Everything older lives in Journal and Trends.
 */
export function TodayContent() {
  const { accessToken } = useAuth();
  const { t, locale } = useI18n();
  const { open } = useCompose();
  const [entries, setEntries] = useState<TodayEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [now, setNow] = useState(() => new Date());
  const [logging, setLogging] = useState(false);

  const headers = useMemo(() => (accessToken ? { Authorization: `Bearer ${accessToken}` } : null), [accessToken]);

  const load = useCallback(async () => {
    if (!headers) return;
    try {
      const [entriesRes, goalsRes] = await Promise.all([
        fetch('/api/entries?limit=50', { headers, cache: 'no-store' }),
        fetch('/api/goals', { headers, cache: 'no-store' }),
      ]);
      if (!entriesRes.ok) throw new Error('entries');
      const body = (await entriesRes.json()) as { entries: TodayEntry[] };
      const goalsBody = goalsRes.ok ? ((await goalsRes.json()) as { goals: Goal[] }) : { goals: [] };
      setEntries(body.entries ?? []);
      setGoals(goalsBody.goals ?? []);
      setNow(new Date());
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, [headers]);

  useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener(ENTRIES_CHANGED_EVENT, reload);
    return () => window.removeEventListener(ENTRIES_CHANGED_EVENT, reload);
  }, [load]);

  const view = useMemo(() => buildToday(entries, goals, now, locale), [entries, goals, now, locale]);

  /** One tap, one glass. The server reads it like any other entry, so it adds 250 ml. */
  const logWater = async () => {
    if (!headers || logging) return;
    setLogging(true);
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: t('today.quick.water_text') }),
      });
      if (!res.ok) throw new Error('save');
      const { entry } = (await res.json()) as { entry: { id: string } };
      hapticNotification('success');
      window.dispatchEvent(new Event(ENTRIES_CHANGED_EVENT));
      toast(t('today.quick.water_added'), {
        duration: 6000,
        action: {
          label: t('shell.undo'),
          onClick: async () => {
            await fetch('/api/entries', {
              method: 'DELETE',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: [entry.id] }),
            });
            window.dispatchEvent(new Event(ENTRIES_CHANGED_EVENT));
          },
        },
      });
    } catch {
      hapticNotification('error');
      toast.error(t('compose.error_save'));
    } finally {
      setLogging(false);
    }
  };

  const dateLabel = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });

  const quick = [
    { id: 'water', label: t('today.quick.water'), icon: Droplets, onClick: () => void logWater(), busy: logging },
    { id: 'mood', label: t('today.quick.mood'), icon: Smile, onClick: () => open(t('today.quick.mood_seed')) },
    { id: 'sleep', label: t('today.quick.sleep'), icon: Moon, onClick: () => open(t('today.quick.sleep_seed')) },
    { id: 'note', label: t('today.quick.note'), icon: PenLine, onClick: () => open() },
  ];

  return (
    <div className="flex flex-col gap-8 px-4 pb-6">
      <p className="-mt-1 text-base capitalize text-muted-foreground">{dateLabel}</p>

      <section aria-labelledby="today-quick" className="flex flex-col gap-3">
        <h2 id="today-quick" className="text-xl font-bold tracking-tight">{t('today.quick')}</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [touch-action:pan-x]">
          {quick.map((q) => (
            <Button
              key={q.id}
              variant="secondary"
              className="min-h-11 shrink-0 gap-2 rounded-full px-4 text-base"
              onClick={q.onClick}
              disabled={q.busy || status === 'loading'}
            >
              <q.icon className="size-4 text-primary" aria-hidden="true" />
              {q.label}
            </Button>
          ))}
        </div>
      </section>

      <section aria-labelledby="today-summary" className="flex flex-col gap-3">
        <h2 id="today-summary" className="text-xl font-bold tracking-tight">{t('today.summary')}</h2>
        {status === 'loading' ? (
          <ul className="grid grid-cols-2 gap-3" aria-busy="true">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </ul>
        ) : status === 'error' ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl bg-card p-4 ring-1 ring-border/60">
            <p className="text-base">{t('today.error')}</p>
            <Button variant="secondary" className="min-h-11" onClick={() => { setStatus('loading'); void load(); }}>
              {t('today.retry')}
            </Button>
          </div>
        ) : view.tiles.length === 0 ? (
          <p className="rounded-2xl bg-card p-4 text-base text-muted-foreground ring-1 ring-border/60">{t('today.no_numbers')}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {view.tiles.map((tile) => <Tile key={tile.key} tile={tile} locale={locale} t={t} />)}
          </ul>
        )}
      </section>

      <section aria-labelledby="today-entries" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="today-entries" className="text-xl font-bold tracking-tight">{t('today.entries')}</h2>
          <Link
            href="/miniapp/journal"
            className="inline-flex min-h-11 items-center gap-0.5 rounded-full px-2 text-base text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('today.see_all')}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        {status === 'loading' ? (
          <Skeleton className="h-28 rounded-2xl" />
        ) : view.entries.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl bg-card p-4 ring-1 ring-border/60">
            <p className="text-base font-semibold">{t('today.empty_title')}</p>
            <p className="text-sm text-muted-foreground">{t('today.empty_body')}</p>
            <Button className="min-h-11 gap-2 rounded-full" onClick={() => open()}>
              <PenLine className="size-4" aria-hidden="true" />
              {t('today.write')}
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
            {view.entries.slice(0, 6).map((e) => (
              <li key={e.id}>
                <Link
                  href={`/miniapp/entry/${e.id}`}
                  className="flex min-h-12 items-center gap-3 px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/50"
                >
                  <time className="min-w-12 shrink-0 whitespace-nowrap text-sm tabular-nums text-muted-foreground" dateTime={entryTime(e).toISOString()}>
                    {timeFmt.format(entryTime(e))}
                  </time>
                  <span className="line-clamp-2 flex-1 text-base">{e.content}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
