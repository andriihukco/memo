'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import {
  Flame, Wallet, Dumbbell, Lightbulb, Brain, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronRight, Droplets, Moon, BookOpen, Scale, Smile, Zap,
  Wind, MapPin, Utensils, Tag, Heart, Activity, X, Calendar,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { DashboardMetric } from '@/lib/classifier';
import { EditDrawer, getCategoryLabel, getCategoryColor } from '@/components/ui/edit-drawer';

interface Entry {
  id: string;
  content: string;
  category: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

type DateRange = 'today' | 'week' | 'month' | 'custom';
interface DateFilter { range: DateRange; from: Date; to: Date; }

function startOfDay(d: Date) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function endOfDay(d: Date)   { const r = new Date(d); r.setHours(23,59,59,999); return r; }
function rangeFor(r: DateRange): { from: Date; to: Date } {
  const now = new Date();
  if (r === 'today') return { from: startOfDay(now), to: endOfDay(now) };
  if (r === 'week')  { const f = new Date(now); f.setDate(now.getDate()-6); return { from: startOfDay(f), to: endOfDay(now) }; }
  if (r === 'month') { const f = new Date(now); f.setDate(now.getDate()-29); return { from: startOfDay(f), to: endOfDay(now) }; }
  return { from: startOfDay(now), to: endOfDay(now) };
}
function fmtDate(d: Date) { return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }); }
function isoDate(d: Date) { return d.toISOString().slice(0,10); }

const RANGE_LABELS: Record<DateRange, string> = { today: 'Сьогодні', week: '7 днів', month: '30 днів', custom: 'Свій' };

// ── Metric aggregation ────────────────────────────────────────────────────────

interface AggregatedMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  icon?: string;
  aggregate: 'sum' | 'avg' | 'last';
  count: number;
}

function aggregateMetrics(entries: Entry[]): AggregatedMetric[] {
  const map = new Map<string, { metric: DashboardMetric; values: number[] }>();

  for (const entry of entries) {
    const metrics = entry.metadata.dashboard_metrics as DashboardMetric[] | undefined;
    if (!Array.isArray(metrics)) continue;
    for (const m of metrics) {
      if (!map.has(m.key)) map.set(m.key, { metric: m, values: [] });
      map.get(m.key)!.values.push(m.value);
      map.get(m.key)!.metric = m;
    }
  }

  const result: AggregatedMetric[] = [];
  for (const [key, { metric, values }] of map) {
    let value: number;
    if (metric.aggregate === 'sum') value = values.reduce((a, b) => a + b, 0);
    else if (metric.aggregate === 'avg') value = values.reduce((a, b) => a + b, 0) / values.length;
    else value = values[values.length - 1];
    result.push({ key, label: metric.label, value: Math.round(value * 10) / 10, unit: metric.unit, icon: metric.icon, aggregate: metric.aggregate, count: values.length });
  }

  const order = { sum: 0, avg: 1, last: 2 };
  return result.sort((a, b) => order[a.aggregate] - order[b.aggregate]);
}

interface GoalMetricAgg {
  key: string;
  label: string;
  target: number;
  unit: string;
  icon?: string;
  period?: string;
}

function aggregateGoals(entries: Entry[]): GoalMetricAgg[] {
  // Latest goal per key wins
  const map = new Map<string, GoalMetricAgg>();
  for (const entry of [...entries].reverse()) {
    const goals = entry.metadata.goal_metrics as GoalMetricAgg[] | undefined;
    if (!Array.isArray(goals)) continue;
    for (const g of goals) {
      map.set(g.key, g);
    }
  }
  return [...map.values()];
}

// ── Icon resolver ─────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  flame: Flame, wallet: Wallet, dumbbell: Dumbbell, lightbulb: Lightbulb,
  brain: Brain, droplets: Droplets, moon: Moon, 'book-open': BookOpen,
  scale: Scale, smile: Smile, zap: Zap, wind: Wind, 'map-pin': MapPin,
  utensils: Utensils, heart: Heart, activity: Activity,
  'trending-up': TrendingUp, 'trending-down': TrendingDown,
};

function MetricIcon({ name, size = 16, className }: { name?: string; size?: number; className?: string }) {
  const Icon = (name && ICON_MAP[name]) ? ICON_MAP[name] : Tag;
  return <Icon size={size} className={className} />;
}

// ── Color for metric key ──────────────────────────────────────────────────────

const METRIC_COLORS: Record<string, { bg: string; text: string }> = {
  kcal_intake:      { bg: 'bg-orange-100', text: 'text-orange-600' },
  kcal_burned:      { bg: 'bg-red-100',    text: 'text-red-600' },
  activity_kcal:    { bg: 'bg-red-100',    text: 'text-red-600' },
  distance_km:      { bg: 'bg-blue-100',   text: 'text-blue-600' },
  distance_m:       { bg: 'bg-blue-100',   text: 'text-blue-600' },
  water_ml:         { bg: 'bg-cyan-100',   text: 'text-cyan-600' },
  sleep_hours:      { bg: 'bg-indigo-100', text: 'text-indigo-600' },
  sleep_quality:    { bg: 'bg-indigo-100', text: 'text-indigo-600' },
  pages_read:       { bg: 'bg-amber-100',  text: 'text-amber-600' },
  reading_min:      { bg: 'bg-amber-100',  text: 'text-amber-600' },
  weight_kg:        { bg: 'bg-teal-100',   text: 'text-teal-600' },
  mood_score:       { bg: 'bg-pink-100',   text: 'text-pink-600' },
  stress_level:     { bg: 'bg-rose-100',   text: 'text-rose-600' },
  energy_level:     { bg: 'bg-yellow-100', text: 'text-yellow-600' },
  meditation_min:   { bg: 'bg-violet-100', text: 'text-violet-600' },
  mindfulness_min:  { bg: 'bg-violet-100', text: 'text-violet-600' },
  steps_count:      { bg: 'bg-green-100',  text: 'text-green-600' },
  active_min:       { bg: 'bg-lime-100',   text: 'text-lime-600' },
  protein_g:        { bg: 'bg-red-100',    text: 'text-red-600' },
  carbs_g:          { bg: 'bg-amber-100',  text: 'text-amber-600' },
  fat_g:            { bg: 'bg-yellow-100', text: 'text-yellow-600' },
  alcohol_units:    { bg: 'bg-purple-100', text: 'text-purple-600' },
  sex_sessions:     { bg: 'bg-pink-100',   text: 'text-pink-600' },
  sex_partners:     { bg: 'bg-pink-100',   text: 'text-pink-600' },
  cold_shower_min:  { bg: 'bg-sky-100',    text: 'text-sky-600' },
  fasting_hours:    { bg: 'bg-teal-100',   text: 'text-teal-600' },
  squats_count:     { bg: 'bg-blue-100',   text: 'text-blue-600' },
  pushups_count:    { bg: 'bg-blue-100',   text: 'text-blue-600' },
};

function metricColor(key: string) {
  return METRIC_COLORS[key] ?? { bg: 'bg-muted', text: 'text-muted-foreground' };
}

// ── DrillDownDrawer — shows source entries for a widget ──────────────────────

function DrillDownDrawer({ title, entries, onClose, onUpdate, accessToken }: {
  title: string;
  entries: Entry[];
  onClose: () => void;
  onUpdate: (id: string, content: string, category: string) => Promise<void>;
  accessToken?: string | null;
}) {
  const [editEntry, setEditEntry] = useState<Entry | null>(null);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-background shadow-2xl"
        style={{ maxHeight: '75vh', display: 'flex', flexDirection: 'column',
          paddingBottom: 'calc(var(--tab-bar-h, 84px) + var(--bottom-inset, 0px))' }}
      >
        {/* Handle */}
        <div className="flex-shrink-0 pt-3 pb-2 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-muted" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 pb-3">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <X size={14} />
          </button>
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {entries.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Немає записів</p>
          )}
          <div className="flex flex-col gap-2">
            {entries.map((e) => (
              <Card
                key={e.id}
                className="cursor-pointer p-3 transition-colors hover:bg-muted/30"
                onClick={() => setEditEntry(e)}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Badge className={cn('border text-[10px] font-medium', getCategoryColor(e.category))} variant="outline">
                    {getCategoryLabel(e.category)}
                  </Badge>
                  <time className="text-[10px] text-muted-foreground">
                    {new Date(e.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </time>
                </div>
                <p className="text-sm leading-relaxed line-clamp-3">{e.content}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {editEntry && (
        <EditDrawer
          entry={editEntry}
          onSave={onUpdate}
          onClose={() => setEditEntry(null)}
          accessToken={accessToken}
        />
      )}
    </>
  );
}

// ── Calendar bottom sheet ─────────────────────────────────────────────────────

function CalendarSheet({ filter, onChange, onClose }: { filter: DateFilter; onChange: (f: DateFilter) => void; onClose: () => void }) {
  const [fromStr, setFromStr] = useState(isoDate(filter.from));
  const [toStr, setToStr] = useState(isoDate(filter.to));

  const apply = (r: DateRange) => {
    onChange({ range: r, ...rangeFor(r) });
    onClose();
  };

  const applyCustom = () => {
    const from = startOfDay(new Date(fromStr)), to = endOfDay(new Date(toStr));
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return;
    onChange({ range: 'custom', from, to });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative w-full rounded-t-2xl bg-background px-4 pt-4 shadow-2xl"
        style={{ paddingBottom: 'calc(var(--tab-bar-h, 84px) + var(--bottom-inset, 0px) + 1rem)' }}
      >
        <div className="mb-4 flex justify-center"><div className="h-1 w-10 rounded-full bg-muted" /></div>
        <h3 className="mb-4 text-sm font-semibold">Оберіть період</h3>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {(['today','week','month'] as DateRange[]).map(r => (
            <button key={r} onClick={() => apply(r)}
              className={cn('rounded-xl border py-3 text-sm font-medium transition-colors',
                filter.range === r ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/30 text-foreground')}>
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        <div className="mb-3 flex items-center gap-2">
          <input type="date" value={fromStr} onChange={e => setFromStr(e.target.value)}
            className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          <span className="text-muted-foreground">–</span>
          <input type="date" value={toStr} onChange={e => setToStr(e.target.value)}
            className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <Button className="w-full" onClick={applyCustom}>Застосувати</Button>
      </div>
    </div>
  );
}

// ── Goals tab ─────────────────────────────────────────────────────────────────

function GoalsTab({ entries }: { entries: Entry[] }) {
  const goals = aggregateGoals(entries);
  const metrics = aggregateMetrics(entries);
  const metricByKey = new Map(metrics.map(m => [m.key, m]));

  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">Цілей ще немає</p>
        <p className="mt-1 text-xs text-muted-foreground">Скажи боту: &ldquo;Хочу пробігти 100км цього місяця&rdquo;</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {goals.map(g => {
        const actual = metricByKey.get(g.key);
        const pct = actual ? Math.min(100, Math.round((actual.value / g.target) * 100)) : 0;
        const { bg, text } = metricColor(g.key);
        return (
          <Card key={g.key} className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', bg)}>
                <MetricIcon name={g.icon} size={18} className={text} />
              </div>
              <div className="flex-1">
                <p className="font-medium">{g.label}</p>
                <p className="text-xs text-muted-foreground">Ціль: {g.target} {g.unit}{g.period ? ` / ${g.period}` : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{actual?.value ?? 0}</p>
                <p className="text-xs text-muted-foreground">з {g.target} {g.unit}</p>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-green-400' : 'bg-primary/70')} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-right text-[10px] text-muted-foreground">{pct}%</p>
          </Card>
        );
      })}
    </div>
  );
}

// ── Generic metric card ───────────────────────────────────────────────────────

function MetricCard({ metric, sourceEntries, onEntryClick, goal }: {
  metric: AggregatedMetric;
  sourceEntries: Entry[];
  onEntryClick: (entries: Entry[], title: string) => void;
  goal?: { target: number; period?: string };
}) {
  const { bg, text } = metricColor(metric.key);
  const aggLabel = metric.aggregate === 'avg' ? `середнє · ${metric.count}` : metric.aggregate === 'last' ? 'останнє' : `${metric.count} записів`;
  const pct = goal ? Math.min(100, Math.round((metric.value / goal.target) * 100)) : null;

  return (
    <Card
      className="flex cursor-pointer flex-col gap-1 p-4 transition-colors hover:bg-muted/30 active:bg-muted/50"
      onClick={() => onEntryClick(sourceEntries, metric.label)}
    >
      <div className={cn('mb-1 flex h-8 w-8 items-center justify-center rounded-xl', bg)}>
        <MetricIcon name={metric.icon} size={16} className={text} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight">{metric.value.toLocaleString()}</span>
        {goal && <span className="text-sm text-muted-foreground">/ {goal.target}</span>}
        <span className="text-sm text-muted-foreground">{metric.unit}</span>
      </div>
      <p className="text-xs font-medium">{metric.label}</p>
      {pct !== null ? (
        <div className="mt-1">
          <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
            <span>Ціль {goal?.period ? `(${goal.period})` : ''}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-green-400' : 'bg-primary/60')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">{aggLabel}</p>
      )}
    </Card>
  );
}

// ── Energy balance card (shown when both kcal_intake and kcal_burned exist) ───

function EnergyBalanceCard({ intake, burned }: { intake: number; burned: number }) {
  const net = intake - burned;
  const isDeficit = net < 0;
  return (
    <Card className="col-span-2 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100">
          <Activity size={16} className="text-orange-600" />
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Енергетичний баланс</p>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="text-center">
          <p className="text-lg font-bold text-orange-500">{intake.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">з&apos;їдено ккал</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-blue-500">{burned.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">спалено ккал</p>
        </div>
        <div className="text-center">
          <p className={cn('text-lg font-bold', isDeficit ? 'text-green-600' : 'text-red-500')}>
            {isDeficit ? '' : '+'}{net.toLocaleString()}
          </p>
          <p className="text-[10px] text-muted-foreground">{isDeficit ? 'дефіцит' : 'профіцит'}</p>
        </div>
      </div>
      {/* Visual bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', isDeficit ? 'bg-green-400' : 'bg-red-400')}
          style={{ width: `${Math.min(100, Math.abs(net) / Math.max(intake, burned, 1) * 100)}%` }}
        />
      </div>
    </Card>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, count, children, defaultOpen = true }: { title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} className="mb-3 flex w-full items-center justify-between py-0.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          {count !== undefined && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{count}</span>}
        </div>
        <ChevronDown size={15} className={cn('text-muted-foreground transition-transform duration-200', !open && '-rotate-90')} />
      </button>
      {open && children}
    </div>
  );
}

// ── Mood helpers ──────────────────────────────────────────────────────────────

const MOOD_KW: Record<string, number> = {
  радіс:2, щасл:2, чудов:2, добр:1, спокій:1, задоволен:1, енергій:1,
  сумн:-1, втомл:-1, погано:-2, жахл:-2, злий:-2, тривог:-2, стрес:-2, паршив:-2,
};
function scoreMood(t: string) { const l = t.toLowerCase(); let s = 0; for (const [k,v] of Object.entries(MOOD_KW)) if (l.includes(k)) s += v; return s; }

// ── Spending bar ──────────────────────────────────────────────────────────────

function SpendBar({ label, pct, amount, currency }: { label: string; pct: number; amount: number; currency: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 truncate text-xs capitalize text-muted-foreground">{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-muted" style={{ height: 6 }}>
        <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right text-xs font-medium">{amount.toLocaleString()} {currency}</span>
    </div>
  );
}
// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { accessToken } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [filter, setFilter] = useState<DateFilter>({ range: 'today', ...rangeFor('today') });
  const [drillDown, setDrillDown] = useState<{ title: string; entries: Entry[] } | null>(null);
  const [view, setView] = useState('actual');
  const [showCalendar, setShowCalendar] = useState(false);

  const fetchEntries = useCallback(async (from: Date, to: Date) => {
    if (!accessToken) return;
    setStatus('loading');
    try {
      const params = new URLSearchParams({ limit: '500', from: from.toISOString(), to: to.toISOString() });
      const res = await fetch(`/api/entries?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error('Failed');
      const { entries: data } = await res.json();
      setEntries(data ?? []); setStatus('ready');
    } catch { setStatus('error'); }
  }, [accessToken]);

  useEffect(() => { fetchEntries(filter.from, filter.to); }, [fetchEntries, filter]);

  const handleUpdate = async (id: string, content: string, category: string) => {
    if (!accessToken) return;
    const res = await fetch('/api/entries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ id, content, category }),
    });
    if (!res.ok) return;
    const { entry: updated } = await res.json();
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e));
    // Also update drill-down if open
    setDrillDown(prev => prev ? { ...prev, entries: prev.entries.map(e => e.id === id ? { ...e, ...updated } : e) } : null);
  };

  const openDrillDown = (sourceEntries: Entry[], title: string) => {
    setDrillDown({ title, entries: sourceEntries });
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const metrics = aggregateMetrics(entries);
  const metricByKey = new Map(metrics.map(m => [m.key, m]));

  const expEntries  = entries.filter(e => e.category === 'expenses');
  const feelEntries = entries.filter(e => e.category === 'feelings');
  const ideaEntries = entries.filter(e => e.category === 'ideas');

  const byCur: Record<string, number> = {};
  const byCat: Record<string, { total: number; currency: string }> = {};
  for (const e of expEntries) {
    const amt = (e.metadata.amount as number) ?? 0;
    const cur = (e.metadata.currency as string) ?? '?';
    const cat = (e.metadata.category as string) ?? 'інше';
    byCur[cur] = (byCur[cur] ?? 0) + amt;
    if (!byCat[cat]) byCat[cat] = { total: 0, currency: cur };
    byCat[cat].total += amt;
  }
  const mainCurrency = Object.entries(byCur).sort((a,b) => b[1]-a[1])[0];
  const totalSpend = mainCurrency?.[1] ?? 0;
  const spendCats = Object.entries(byCat).sort((a,b) => b[1].total - a[1].total).slice(0, 5);

  const moodScores = feelEntries.map(e => scoreMood(e.content));
  const moodAvg = moodScores.length ? moodScores.reduce((a,b) => a+b, 0) / moodScores.length : null;
  const MoodIcon = moodAvg === null ? Minus : moodAvg > 0.5 ? TrendingUp : moodAvg < -0.5 ? TrendingDown : Minus;
  const moodLabel = moodAvg === null ? '—' : moodAvg > 0.5 ? 'Позитивний' : moodAvg < -0.5 ? 'Негативний' : 'Нейтральний';
  const moodColor = moodAvg === null ? 'bg-muted text-muted-foreground' : moodAvg > 0.5 ? 'bg-green-100 text-green-700' : moodAvg < -0.5 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';
  const recentMood = feelEntries.slice(0, 7).reverse().map(e => scoreMood(e.content));
  const maxMoodAbs = Math.max(1, ...recentMood.map(Math.abs));

  // Build metric key → source entries map
  const metricSourceEntries = new Map<string, Entry[]>();
  for (const entry of entries) {
    const metrics = entry.metadata.dashboard_metrics as DashboardMetric[] | undefined;
    if (!Array.isArray(metrics)) continue;
    for (const m of metrics) {
      if (!metricSourceEntries.has(m.key)) metricSourceEntries.set(m.key, []);
      metricSourceEntries.get(m.key)!.push(entry);
    }
  }

  // Separate energy metrics from the rest for special treatment
  const intakeMetric  = metricByKey.get('kcal_intake');
  const burnedMetric  = metricByKey.get('kcal_burned');
  const showEnergyBalance = !!(intakeMetric && burnedMetric);
  // Metrics to show in the generic grid (exclude ones handled specially)
  const specialKeys = new Set(['kcal_intake', 'kcal_burned']);
  const genericMetrics = metrics.filter(m => !specialKeys.has(m.key));

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Дашборд</h1>
        <button
          onClick={() => setShowCalendar(true)}
          className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <Calendar size={13} />
          {filter.range === 'custom' ? `${fmtDate(filter.from)} – ${fmtDate(filter.to)}` : RANGE_LABELS[filter.range]}
        </button>
      </div>

      {/* View tabs */}
      <Tabs value={view} onValueChange={setView}>
        <TabsList className="w-full">
          <TabsTrigger value="actual">Лог</TabsTrigger>
          <TabsTrigger value="goals">Цілі</TabsTrigger>
        </TabsList>

        <TabsContent value="goals">
          {status === 'ready' && <GoalsTab entries={entries} />}
        </TabsContent>

        <TabsContent value="actual">
          {status === 'loading' && <div className="flex items-center justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-2 border-muted border-t-foreground" /></div>}
          {status === 'error' && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">Не вдалося завантажити дані</p>
              <Button size="sm" className="mt-3" onClick={() => fetchEntries(filter.from, filter.to)}>Повторити</Button>
            </div>
          )}
          {status === 'ready' && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">Немає записів за цей період</p>
            </div>
          )}

          {status === 'ready' && entries.length > 0 && (
            <div className="flex flex-col gap-6">

              {/* ── Dynamic metrics grid ──────────────────────────────────────── */}
              {metrics.length > 0 && (
                <Section title="Метрики" count={metrics.length}>
                  <div className="grid grid-cols-2 gap-3">
                    {showEnergyBalance && (
                      <EnergyBalanceCard intake={intakeMetric!.value} burned={burnedMetric!.value} />
                    )}
                    {intakeMetric && !burnedMetric && <MetricCard metric={intakeMetric} sourceEntries={metricSourceEntries.get('kcal_intake') ?? []} onEntryClick={openDrillDown} />}
                    {burnedMetric && !intakeMetric && <MetricCard metric={burnedMetric} sourceEntries={metricSourceEntries.get('kcal_burned') ?? []} onEntryClick={openDrillDown} />}
                    {genericMetrics.map(m => <MetricCard key={m.key} metric={m} sourceEntries={metricSourceEntries.get(m.key) ?? []} onEntryClick={openDrillDown} />)}
                  </div>
                </Section>
              )}

              {/* ── Finance ──────────────────────────────────────────────────── */}
              {expEntries.length > 0 && (
                <Section title="Фінанси" count={expEntries.length}>
                  <Card className="cursor-pointer p-4 transition-colors hover:bg-muted/30" onClick={() => openDrillDown(expEntries, 'Фінанси')}>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100">
                          <Wallet size={16} className="text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Всього витрат</p>
                          <p className="text-xl font-bold">{totalSpend.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{mainCurrency?.[0]}</span></p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{expEntries.length} транзакцій</span>
                    </div>
                    {spendCats.length > 0 && (
                      <div className="flex flex-col gap-2.5">
                        {spendCats.map(([cat, { total, currency }]) => (
                          <SpendBar key={cat} label={cat} pct={totalSpend > 0 ? Math.round((total/totalSpend)*100) : 0} amount={total} currency={currency} />
                        ))}
                      </div>
                    )}
                  </Card>
                </Section>
              )}

              {/* ── Mood ─────────────────────────────────────────────────────── */}
              {feelEntries.length > 0 && (
                <Section title="Настрій" count={feelEntries.length}>
                  <Card className="cursor-pointer p-4 transition-colors hover:bg-muted/30" onClick={() => openDrillDown(feelEntries, 'Настрій')}>
                    <div className="mb-3 flex items-center gap-3">
                      <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', moodColor)}>
                        <MoodIcon size={20} />
                      </div>
                      <div>
                        <p className="font-semibold">{moodLabel}</p>
                        <p className="text-xs text-muted-foreground">{feelEntries.length} записів про почуття</p>
                      </div>
                    </div>
                    {recentMood.length > 1 && (
                      <div className="flex items-end gap-1" style={{ height: 36 }}>
                        {recentMood.map((s, i) => {
                          const h = Math.max(4, Math.round((Math.abs(s)/maxMoodAbs)*32));
                          return <div key={i} className={cn('flex-1 rounded-sm', s > 0 ? 'bg-green-400' : s < 0 ? 'bg-red-400' : 'bg-muted')} style={{ height: h }} />;
                        })}
                      </div>
                    )}
                    {feelEntries[0] && <p className="mt-3 border-l-2 border-pink-200 pl-2 text-xs text-muted-foreground line-clamp-2">{feelEntries[0].content}</p>}
                  </Card>
                </Section>
              )}

              {/* ── Ideas ────────────────────────────────────────────────────── */}
              {ideaEntries.length > 0 && (
                <Section title="Ідеї" count={ideaEntries.length} defaultOpen={false}>
                  <div className="flex flex-col gap-2">
                    {ideaEntries.slice(0, 5).map((e) => (
                      <Card key={e.id} className="flex items-start gap-3 p-3">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                          <Lightbulb size={13} className="text-amber-600" />
                        </div>
                        <p className="text-sm leading-relaxed line-clamp-2">{e.content}</p>
                      </Card>
                    ))}
                    {ideaEntries.length > 5 && (
                      <button className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground">
                        <ChevronRight size={13} /> Ще {ideaEntries.length - 5} ідей
                      </button>
                    )}
                  </div>
                </Section>
              )}

            </div>
          )}
        </TabsContent>
      </Tabs>
      {/* Drill-down drawer */}
      {drillDown && (
        <DrillDownDrawer
          title={drillDown.title}
          entries={drillDown.entries}
          onClose={() => setDrillDown(null)}
          onUpdate={handleUpdate}
          accessToken={accessToken}
        />
      )}

      {/* Calendar sheet */}
      {showCalendar && (
        <CalendarSheet filter={filter} onChange={setFilter} onClose={() => setShowCalendar(false)} />
      )}
    </div>
  );
}
