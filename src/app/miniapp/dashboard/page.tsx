'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { DashboardMetric } from '@/lib/classifier';
import { EditDrawer, getCategoryLabel, getCategoryColor } from '@/components/ui/edit-drawer';
import { useSound } from '@/lib/sound/use-sound';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ErrorBanner } from '@/components/ui/error-banner';
import { SkeletonMetricCard } from '@/components/ui/skeleton';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { PaywallModal } from '@/components/ui/paywall-modal';
import { useUsageCounts } from '@/lib/hooks/use-usage-counts';
import type { SubscriptionTier } from '@/lib/stars/paywall';

// ── Full emoji library (10 categories × ~10 each) ────────────────────────────
const EMOJI_LIBRARY = [
  // Health & Body
  '💪','🏃','🧘','🚴','🏋️','🤸','🧗','🏊','⚽','🎾',
  // Food & Drink
  '🍎','🥗','🍕','☕','🧃','🍷','🥤','🍜','🥑','🍳',
  // Mind & Mood
  '🧠','💭','😊','😴','🎯','⚡','🔥','💡','✨','🌟',
  // Nature
  '🌿','🌸','🌊','☀️','🌙','🍀','🌺','🦋','🌈','❄️',
  // Finance
  '💰','💳','📈','💸','🏦','🛒','🎁','💎','🪙','📊',
  // Work & Learning
  '💻','📚','✏️','🎓','🔬','📝','🗂️','🏆','🎨','🎵',
  // Travel & Places
  '✈️','🏠','🗺️','🚗','🚂','⛵','🏔️','🌍','🏖️','🗼',
  // People & Social
  '❤️','🤝','👶','🐾','👥','🙏','🎉','🥂','💌','🫂',
  // Tracking & Metrics
  '⏱️','📏','🔢','📉','🎲','🔐','🧪','⚗️','🔭','🧬',
  // Misc
  '⭐','🏅','🎖️','🔑','💫','🌀','🎭','🎪','🎬','🎤',
];

// ── Apple-inspired color palette (solid bg for icon circles) ─────────────────
const ICON_COLORS = [
  { id: 'blue',    bg: 'bg-blue-500',    hex: '#3b82f6', text: 'text-white' },
  { id: 'indigo',  bg: 'bg-indigo-500',  hex: '#6366f1', text: 'text-white' },
  { id: 'violet',  bg: 'bg-violet-500',  hex: '#8b5cf6', text: 'text-white' },
  { id: 'purple',  bg: 'bg-purple-500',  hex: '#a855f7', text: 'text-white' },
  { id: 'pink',    bg: 'bg-pink-500',    hex: '#ec4899', text: 'text-white' },
  { id: 'rose',    bg: 'bg-rose-500',    hex: '#f43f5e', text: 'text-white' },
  { id: 'red',     bg: 'bg-red-500',     hex: '#ef4444', text: 'text-white' },
  { id: 'orange',  bg: 'bg-orange-500',  hex: '#f97316', text: 'text-white' },
  { id: 'amber',   bg: 'bg-amber-500',   hex: '#f59e0b', text: 'text-white' },
  { id: 'yellow',  bg: 'bg-yellow-400',  hex: '#facc15', text: 'text-gray-900' },
  { id: 'lime',    bg: 'bg-lime-500',    hex: '#84cc16', text: 'text-white' },
  { id: 'green',   bg: 'bg-green-500',   hex: '#22c55e', text: 'text-white' },
  { id: 'emerald', bg: 'bg-emerald-500', hex: '#10b981', text: 'text-white' },
  { id: 'teal',    bg: 'bg-teal-500',    hex: '#14b8a6', text: 'text-white' },
  { id: 'cyan',    bg: 'bg-cyan-500',    hex: '#06b6d4', text: 'text-white' },
  { id: 'sky',     bg: 'bg-sky-500',     hex: '#0ea5e9', text: 'text-white' },
  { id: 'slate',   bg: 'bg-slate-500',   hex: '#64748b', text: 'text-white' },
  { id: 'gray',    bg: 'bg-gray-600',    hex: '#4b5563', text: 'text-white' },
] as const;


function getIconColor(id?: string) {
  return ICON_COLORS.find(c => c.id === id) ?? ICON_COLORS[0];
}

// ── Widget icon builder component ─────────────────────────────────────────────

function IconBuilder({
  emoji, colorId, onEmojiChange, onColorChange,
}: {
  emoji: string; colorId: string;
  onEmojiChange: (e: string) => void; onColorChange: (c: string) => void;
}) {
  const color = getIconColor(colorId);

  return (
    <div>
      {/* Preview */}
      <div className="flex items-center gap-3 mb-4">
        <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shrink-0', color.bg)}>
          {emoji}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Іконка віджету</p>
          <p className="text-xs text-muted-foreground">Оберіть емодзі та колір</p>
        </div>
      </div>

      {/* Color row */}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Колір</p>
      <div className="flex gap-2 flex-wrap mb-4">
        {ICON_COLORS.map(c => (
          <button
            key={c.id}
            onClick={() => onColorChange(c.id)}
            className={cn(
              'h-7 w-7 rounded-full transition-all',
              colorId === c.id && 'ring-2 ring-offset-2 ring-white/60 scale-110'
            )}
            style={{ backgroundColor: c.hex }}
            aria-label={c.id}
          />
        ))}
      </div>

      {/* Emoji grid */}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Емодзі</p>
      <div className="grid grid-cols-10 gap-1 max-h-40 overflow-y-auto">
        {EMOJI_LIBRARY.map(e => (
          <button
            key={e}
            onClick={() => onEmojiChange(e)}
            className={cn(
              'flex h-9 w-full items-center justify-center rounded-xl text-xl transition-all',
              emoji === e
                ? cn(color.bg, 'ring-2 ring-offset-1 ring-white/40')
                : 'hover:bg-muted/60'
            )}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Data types ────────────────────────────────────────────────────────────────

interface Entry {
  id: string;
  content: string;
  category: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

type DateRange = 'today' | 'week' | 'month' | 'custom';
interface DateFilter { range: DateRange; from: Date; to: Date; }

// UTC+3 aware helpers — all boundaries computed in user's local timezone
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  const local = new Date(d.getTime() + TZ_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - TZ_OFFSET_MS);
}
function endOfDay(d: Date) {
  const local = new Date(d.getTime() + TZ_OFFSET_MS);
  local.setUTCHours(23, 59, 59, 999);
  return new Date(local.getTime() - TZ_OFFSET_MS);
}
function rangeFor(r: DateRange): { from: Date; to: Date } {
  const now = new Date();
  if (r === 'today') return { from: startOfDay(now), to: endOfDay(now) };
  if (r === 'week') { const f = new Date(now); f.setDate(now.getDate() - 6); return { from: startOfDay(f), to: endOfDay(now) }; }
  if (r === 'month') { const f = new Date(now); f.setDate(now.getDate() - 29); return { from: startOfDay(f), to: endOfDay(now) }; }
  return { from: startOfDay(now), to: endOfDay(now) };
}
function fmtDate(d: Date) { return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }); }
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

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

    if (Array.isArray(metrics) && metrics.length > 0) {
      for (const m of metrics) {
        if (!map.has(m.key)) map.set(m.key, { metric: m, values: [] });
        map.get(m.key)!.values.push(m.value);
        map.get(m.key)!.metric = m;
      }
    } else if (entry.category === 'sleep') {
      // Fallback: parse sleep hours from content when dashboard_metrics is missing
      // Handles: "8 годин", "8 hours", "8h", time ranges like "00:30→08:30"
      const content = entry.content.toLowerCase();
      let hours: number | null = null;

      // Direct mention: "8 годин", "7.5 hours", "8h"
      const directMatch = content.match(/(\d+(?:[.,]\d+)?)\s*(?:год(?:ин)?|hours?|h\b)/);
      if (directMatch) {
        hours = parseFloat(directMatch[1].replace(',', '.'));
      }

      // Time range: "00:30" to "08:30" — calculate difference
      if (!hours) {
        const times = content.match(/(\d{1,2}):(\d{2})/g);
        if (times && times.length >= 2) {
          const [h1, m1] = times[0].split(':').map(Number);
          const [h2, m2] = times[times.length - 1].split(':').map(Number);
          let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (diff < 0) diff += 24 * 60; // crossed midnight
          hours = Math.round((diff / 60) * 10) / 10;
        }
      }

      if (hours && hours > 0 && hours <= 24) {
        const key = 'sleep_hours';
        if (!map.has(key)) map.set(key, { metric: { key, label: 'Сон', value: hours, unit: 'год', icon: 'moon', aggregate: 'avg' }, values: [] });
        map.get(key)!.values.push(hours);
      }
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

// Lucide icon name → Material Symbols name mapping for metric icons
const METRIC_ICON_MAP: Record<string, string> = {
  flame: 'local_fire_department',
  wallet: 'account_balance_wallet',
  dumbbell: 'fitness_center',
  lightbulb: 'lightbulb',
  brain: 'neurology',
  droplets: 'water_drop',
  moon: 'bedtime',
  'book-open': 'menu_book',
  scale: 'scale',
  smile: 'sentiment_satisfied',
  zap: 'bolt',
  wind: 'air',
  'map-pin': 'location_on',
  utensils: 'restaurant',
  heart: 'favorite',
  activity: 'monitor_heart',
  'trending-up': 'trending_up',
  'trending-down': 'trending_down',
  coffee: 'coffee',
  leaf: 'eco',
  pill: 'medication',
  award: 'emoji_events',
  star: 'star',
  target: 'my_location',
  clock: 'schedule',
  tag: 'tag',
};

function MetricIcon({ name, size = 16, className }: { name?: string; size?: number; className?: string }) {
  const iconName = (name && METRIC_ICON_MAP[name]) ? METRIC_ICON_MAP[name] : 'tag';
  return <Icon name={iconName} size={size} className={className} />;
}

// ── Custom widget type ────────────────────────────────────────────────────────

interface CustomWidget {
  id: string;
  title: string;
  description?: string;
  metric_key: string;
  unit: string;
  icon?: string;
  emoji?: string;
  iconColor?: string;
  color?: string;
  aggregate: 'sum' | 'avg' | 'last';
  category?: string;
  goal?: number;
  created_at: string;
}

// ── New 2-step CreateWidgetSheet ─────────────────────────────────────────────
// Step 0: Choose what to measure (cards with emoji)
// Step 1: Name, unit, goal (optional) + icon builder

interface MeasureOption {
  id: string;
  emoji: string;
  label: string;
  sublabel: string;
  defaultUnit: string;
  defaultAggregate: 'sum' | 'avg' | 'last';
  defaultEmoji: string;
  defaultColor: string;
  category: string;
  metricKey: string;
  directWidget?: Omit<CustomWidget, 'created_at'>;
}

const MEASURE_OPTIONS: MeasureOption[] = [
  { id: 'water',    emoji: '💧', label: 'Вода',        sublabel: 'мл, склянки',      defaultUnit: 'мл',    defaultAggregate: 'sum',  defaultEmoji: '💧', defaultColor: 'cyan',    category: 'health',    metricKey: 'water_ml',
    directWidget: { id: 'water_ml', title: 'Вода', metric_key: 'water_ml', unit: 'мл', emoji: '💧', iconColor: 'cyan', aggregate: 'sum', category: 'health' } },
  { id: 'calories', emoji: '🔥', label: 'Калорії',     sublabel: 'ккал, кДж',        defaultUnit: 'ккал',  defaultAggregate: 'sum',  defaultEmoji: '🔥', defaultColor: 'orange',  category: 'calories',  metricKey: 'kcal_intake',
    directWidget: { id: 'kcal_intake', title: 'Калорії', metric_key: 'kcal_intake', unit: 'ккал', emoji: '🔥', iconColor: 'orange', aggregate: 'sum', category: 'calories' } },
  { id: 'sleep',    emoji: '😴', label: 'Сон',         sublabel: 'год, якість',      defaultUnit: 'год',   defaultAggregate: 'avg',  defaultEmoji: '😴', defaultColor: 'indigo',  category: 'sleep',     metricKey: 'sleep_hours',
    directWidget: { id: 'sleep_hours', title: 'Сон', metric_key: 'sleep_hours', unit: 'год', emoji: '😴', iconColor: 'indigo', aggregate: 'avg', category: 'sleep' } },
  { id: 'steps',    emoji: '🏃', label: 'Кроки',       sublabel: 'кроків на день',   defaultUnit: 'кроків',defaultAggregate: 'sum',  defaultEmoji: '🏃', defaultColor: 'green',   category: 'workout',   metricKey: 'steps_count',
    directWidget: { id: 'steps_count', title: 'Кроки', metric_key: 'steps_count', unit: 'кроків', emoji: '🏃', iconColor: 'green', aggregate: 'sum', category: 'workout' } },
  { id: 'workout',  emoji: '💪', label: 'Тренування',  sublabel: 'хв, км, підходи',  defaultUnit: 'хв',    defaultAggregate: 'sum',  defaultEmoji: '💪', defaultColor: 'blue',    category: 'workout',   metricKey: 'active_min',
    directWidget: { id: 'active_min', title: 'Тренування', metric_key: 'active_min', unit: 'хв', emoji: '💪', iconColor: 'blue', aggregate: 'sum', category: 'workout' } },
  { id: 'weight',   emoji: '⚖️', label: 'Вага',        sublabel: 'кг, фунти',        defaultUnit: 'кг',    defaultAggregate: 'last', defaultEmoji: '⚖️', defaultColor: 'teal',    category: 'health',    metricKey: 'weight_kg',
    directWidget: { id: 'weight_kg', title: 'Вага', metric_key: 'weight_kg', unit: 'кг', emoji: '⚖️', iconColor: 'teal', aggregate: 'last', category: 'health' } },
  { id: 'mood',     emoji: '😊', label: 'Настрій',     sublabel: 'оцінка 1–10',      defaultUnit: '/10',   defaultAggregate: 'avg',  defaultEmoji: '😊', defaultColor: 'pink',    category: 'feelings',  metricKey: 'mood_score',
    directWidget: { id: 'mood_score', title: 'Настрій', metric_key: 'mood_score', unit: '/10', emoji: '😊', iconColor: 'pink', aggregate: 'avg', category: 'feelings' } },
  { id: 'expenses', emoji: '💸', label: 'Витрати',     sublabel: 'грн, $, €',        defaultUnit: 'грн',   defaultAggregate: 'sum',  defaultEmoji: '💸', defaultColor: 'emerald', category: 'expenses',  metricKey: 'expenses_day',
    directWidget: { id: 'expenses_day', title: 'Витрати', metric_key: 'expenses_day', unit: 'грн', emoji: '💸', iconColor: 'emerald', aggregate: 'sum', category: 'expenses' } },
  { id: 'protein',  emoji: '🥩', label: 'Білок',       sublabel: 'грам на день',     defaultUnit: 'г',     defaultAggregate: 'sum',  defaultEmoji: '🥩', defaultColor: 'red',     category: 'calories',  metricKey: 'protein_g',
    directWidget: { id: 'protein_g', title: 'Білок', metric_key: 'protein_g', unit: 'г', emoji: '🥩', iconColor: 'red', aggregate: 'sum', category: 'calories' } },
  { id: 'energy',   emoji: '⚡', label: 'Енергія',     sublabel: 'рівень 1–10',      defaultUnit: '/10',   defaultAggregate: 'avg',  defaultEmoji: '⚡', defaultColor: 'yellow',  category: 'feelings',  metricKey: 'energy_level',
    directWidget: { id: 'energy_level', title: 'Енергія', metric_key: 'energy_level', unit: '/10', emoji: '⚡', iconColor: 'yellow', aggregate: 'avg', category: 'feelings' } },
  { id: 'reading',  emoji: '📚', label: 'Читання',     sublabel: 'сторінок, хвилин', defaultUnit: 'стор',  defaultAggregate: 'sum',  defaultEmoji: '📚', defaultColor: 'amber',   category: 'books',     metricKey: 'pages_read',
    directWidget: { id: 'pages_read', title: 'Читання', metric_key: 'pages_read', unit: 'стор', emoji: '📚', iconColor: 'amber', aggregate: 'sum', category: 'books' } },
  { id: 'custom',   emoji: '✨', label: 'Своє',        sublabel: 'будь-яка метрика', defaultUnit: '',      defaultAggregate: 'sum',  defaultEmoji: '✨', defaultColor: 'violet',  category: 'health',    metricKey: 'custom' },
];

function CreateWidgetSheet({ onClose, onCreated, onPaywall, accessToken, hasEntries }: {
  onClose: () => void;
  onCreated: (widget: CustomWidget) => void;
  onPaywall: (feature: string, current: number | undefined, limit: number | undefined, requiredTier: SubscriptionTier) => void;
  accessToken?: string | null;
  hasEntries: boolean;
}) {
  const [step, setStep] = useState(0); // 0 = choose, 1 = configure
  const [selected, setSelected] = useState<MeasureOption | null>(null);
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState('');
  const [goal, setGoal] = useState('');
  const [emoji, setEmoji] = useState('✨');
  const [iconColor, setIconColor] = useState('blue');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { play } = useSound();

  const handleSelect = (opt: MeasureOption) => {
    play('SELECT');
    setSelected(opt);
    setTitle(opt.label);
    setUnit(opt.defaultUnit);
    setEmoji(opt.defaultEmoji);
    setIconColor(opt.defaultColor);
    setGoal('');
    setError(null);
    setStep(1);
  };

  const handleCreate = async () => {
    if (!accessToken || !selected || !title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const goalNum = goal.trim() ? parseFloat(goal.replace(',', '.')) : undefined;
      const directDef = selected.directWidget
        ? {
            ...selected.directWidget,
            title: title.trim(),
            unit: unit.trim() || selected.defaultUnit,
            emoji,
            iconColor,
            ...(goalNum ? { goal: goalNum } : {}),
          }
        : null;

      const body = directDef
        ? { prompt: `${selected.label}: ${title}`, direct: directDef }
        : {
            prompt: `${selected.label}: ${title.trim()}`,
            answers: { question: title.trim(), unit: unit.trim(), goal: goalNum },
            emoji,
            iconColor,
          };

      const res = await fetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 402) {
        onClose();
        onPaywall(data.feature ?? 'widgets', data.current, data.limit, (data.required_tier as SubscriptionTier) ?? 'stars_basic');
      } else if (!res.ok) {
        setError('Не вдалося створити віджет. Спробуй ще раз.');
      } else {
        onCreated(data.widget);
        play('CELEBRATION');
        setTimeout(onClose, 600);
      }
    } catch {
      setError('Не вдалося створити віджет. Спробуй ще раз.');
    } finally {
      setCreating(false);
    }
  };

  const color = getIconColor(iconColor);

  return (
    <BottomSheet open onClose={onClose} className="px-4 pt-2 pb-6 max-h-[90vh] overflow-y-auto">
      {/* Step 0 — choose what to measure */}
      {step === 0 && (
        <div>
          <h3 className="text-[19px] font-bold mb-1">Що відстежувати?</h3>
          <p className="text-sm text-muted-foreground mb-5">Оберіть метрику або створіть свою</p>
          <div className="grid grid-cols-2 gap-2.5">
            {MEASURE_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => handleSelect(opt)}
                className="flex items-center gap-3 rounded-2xl bg-muted/40 border border-border/40 px-4 py-3.5 text-left transition-all active:scale-95 hover:bg-muted/60"
              >
                <span className="text-2xl shrink-0">{opt.emoji}</span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-tight">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{opt.sublabel}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1 — configure */}
      {step === 1 && selected && (
        <div>
          {/* Back */}
          <button
            onClick={() => { play('SLIDE'); setStep(0); setError(null); }}
            className="text-[13px] text-muted-foreground flex items-center gap-1 mb-4 min-h-[36px]"
          >
            <Icon name="arrow_back_ios" size={13} /> Назад
          </button>

          {/* Icon builder */}
          <IconBuilder
            emoji={emoji}
            colorId={iconColor}
            onEmojiChange={setEmoji}
            onColorChange={setIconColor}
          />

          <div className="h-px bg-border/40 my-4" />

          {/* Name */}
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Назва</p>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Назва віджету"
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-[15px] font-medium focus:outline-none focus:ring-1 focus:ring-ring mb-3"
          />

          {/* Unit */}
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Одиниця виміру</p>
          <input
            type="text"
            value={unit}
            onChange={e => setUnit(e.target.value)}
            placeholder={selected.defaultUnit || 'мл, кг, хв...'}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-[15px] focus:outline-none focus:ring-1 focus:ring-ring mb-3"
          />

          {/* Goal (optional) */}
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Ціль <span className="normal-case font-normal text-muted-foreground/60">(необов&apos;язково)</span>
          </p>
          <input
            type="number"
            inputMode="decimal"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder={`напр. ${selected.id === 'water' ? '2000' : selected.id === 'steps' ? '10000' : '100'}`}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-[15px] focus:outline-none focus:ring-1 focus:ring-ring mb-4"
          />

          {/* Preview card */}
          <div className="rounded-2xl bg-muted/30 border border-border/40 p-4 flex items-center gap-3 mb-4">
            <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl text-2xl shrink-0', color.bg)}>
              {emoji}
            </div>
            <div>
              <p className="font-semibold">{title || selected.label}</p>
              <p className="text-sm text-muted-foreground">{unit || selected.defaultUnit}{goal ? ` · ціль ${goal}` : ''}</p>
            </div>
          </div>

          {/* AI warning */}
          {!hasEntries && !selected.directWidget && (
            <div className="mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex items-start gap-2.5">
              <span className="text-base shrink-0 mt-0.5">⚠️</span>
              <p className="text-[13px] text-amber-300 leading-snug">
                AI-віджет потребує записів у боті. Спочатку зроби кілька записів.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4">
              <ErrorBanner message={error} onRetry={handleCreate} onDismiss={() => setError(null)} />
            </div>
          )}

          <Button
            className="w-full min-h-[48px] rounded-full text-[15px] font-semibold"
            disabled={creating || !title.trim()}
            onClick={handleCreate}
          >
            {creating ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                {selected.directWidget ? 'Створюємо...' : 'AI створює...'}
              </span>
            ) : (
              'Створити віджет'
            )}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}

// ── Color for metric key ──────────────────────────────────────────────────────

const METRIC_COLORS: Record<string, { bg: string; text: string }> = {
  // Dark mode optimized: translucent backgrounds, vibrant text
  kcal_intake: { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  kcal_burned: { bg: 'bg-red-500/15', text: 'text-red-400' },
  activity_kcal: { bg: 'bg-red-500/15', text: 'text-red-400' },
  distance_km: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  distance_m: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  water_ml: { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  sleep_hours: { bg: 'bg-indigo-500/15', text: 'text-indigo-400' },
  sleep_quality: { bg: 'bg-indigo-500/15', text: 'text-indigo-400' },
  pages_read: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  reading_min: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  weight_kg: { bg: 'bg-teal-500/15', text: 'text-teal-400' },
  mood_score: { bg: 'bg-pink-500/15', text: 'text-pink-400' },
  stress_level: { bg: 'bg-rose-500/15', text: 'text-rose-400' },
  energy_level: { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  meditation_min: { bg: 'bg-violet-500/15', text: 'text-violet-400' },
  mindfulness_min: { bg: 'bg-violet-500/15', text: 'text-violet-400' },
  steps_count: { bg: 'bg-green-500/15', text: 'text-green-400' },
  active_min: { bg: 'bg-lime-500/15', text: 'text-lime-400' },
  protein_g: { bg: 'bg-red-500/15', text: 'text-red-400' },
  carbs_g: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  fat_g: { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  alcohol_units: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  sex_sessions: { bg: 'bg-pink-500/15', text: 'text-pink-400' },
  sex_partners: { bg: 'bg-pink-500/15', text: 'text-pink-400' },
  cold_shower_min: { bg: 'bg-sky-500/15', text: 'text-sky-400' },
  fasting_hours: { bg: 'bg-teal-500/15', text: 'text-teal-400' },
  squats_count: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  pushups_count: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
};

function metricColor(key: string) {
  return METRIC_COLORS[key] ?? { bg: 'bg-muted', text: 'text-muted-foreground' };
}

// ── MetricEditSheet — long-press a metric widget to correct its value ─────────

function MetricEditSheet({ metric, sourceEntries, onSave, onDelete, onClose }: {
  metric: AggregatedMetric;
  sourceEntries: Entry[];
  onSave: (targetEntryId: string, metricKey: string, newValue: number, allSourceEntryIds: string[]) => Promise<void>;
  onDelete: (entryIds: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(String(metric.value));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { bg, text } = metricColor(metric.key);

  useEffect(() => {
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 80);
  }, []);

  const save = async () => {
    const num = parseFloat(value.replace(',', '.'));
    if (isNaN(num)) return;
    // Most recent entry gets the new value; all others get zeroed out
    const targetEntry = sourceEntries[sourceEntries.length - 1];
    if (!targetEntry) return;
    setSaving(true);
    try {
      await onSave(targetEntry.id, metric.key, num, sourceEntries.map(e => e.id));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(sourceEntries.map(e => e.id));
      onClose();
    } finally {
    }
  };

  return (
    <BottomSheet open onClose={onClose} className="px-4 pt-4">
      {/* Header row: delete — metric info — close */}
      <div className="mb-4 mt-3 flex items-center gap-3">
        {/* Delete button */}
        <button
          onClick={() => setConfirmDelete(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-red-100 hover:text-red-600 transition-colors"
          aria-label="Видалити"
        >
          <Icon name="delete" size={16} />
        </button>

        {/* Metric info */}
        <>
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', bg)}>
            <MetricIcon name={metric.icon} size={18} className={text} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{metric.label}</p>
            <p className="text-xs text-muted-foreground">Зараз: {metric.value} {metric.unit}</p>
          </div>
        </>

        {/* Close */}
        <button
          onClick={onClose}
          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); }}
          className="flex-1 rounded-2xl border border-input bg-background px-4 py-3 text-2xl font-bold focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="text-lg text-muted-foreground">{metric.unit}</span>
      </div>

      <Button className="w-full min-h-[44px] rounded-full" disabled={saving || !value.trim()} onClick={save}>
        {saving
          ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
          : 'Зберегти'}
      </Button>
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Видалити метрику?"
        subtitle="Цю дію не можна скасувати."
        confirmLabel="Видалити"
      />
    </BottomSheet>
  );
}

// ── LogEntrySheet — quick log entry from a custom widget card ────────────────

interface LogEntrySheetProps {
  open: boolean;
  onClose: () => void;
  widget: CustomWidget;
  onSaved: () => void;
  onViewEntries: () => void;
  onDelete: (widgetId: string) => void;
  onPaywall: (feature: string, current: number | undefined, limit: number | undefined, requiredTier: SubscriptionTier) => void;
  accessToken?: string | null;
}

function LogEntrySheet({ open, onClose, widget, onSaved, onViewEntries, onDelete, onPaywall, accessToken }: LogEntrySheetProps) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { play } = useSound();

  // Reset state when sheet opens
  useEffect(() => {
    if (open) {
      setValue('');
      setError(null);
      setSaving(false);
    }
  }, [open]);

  const handleSave = async () => {
    const numericValue = parseFloat(value.replace(',', '.'));
    if (isNaN(numericValue) || !accessToken) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          content: `${widget.title}: ${numericValue} ${widget.unit}`,
          category: widget.category ?? 'health',
          metadata: {
            dashboard_metrics: [
              {
                key: widget.metric_key,
                value: numericValue,
                unit: widget.unit,
                label: widget.title,
                aggregate: widget.aggregate,
              },
            ],
          },
        }),
      });
      if (res.status === 402) {
        const data = await res.json();
        onClose();
        onPaywall(
          data.feature ?? 'entries',
          data.current,
          data.limit,
          (data.required_tier as SubscriptionTier) ?? 'stars_basic',
        );
        return;
      }
      if (!res.ok) throw new Error('Failed');
      play('CELEBRATION');
      onSaved();
      onClose();
    } catch {
      setError('Не вдалося зберегти запис. Спробуй ще раз.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} className="px-4 pt-4">
      {/* Widget header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => { play('CAUTION'); setConfirmDelete(true); }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          aria-label="Видалити віджет"
        >
          <Icon name="delete" size={16} />
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {widget.emoji ? (
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl text-xl shrink-0', getIconColor(widget.iconColor ?? widget.color).bg)}>
              {widget.emoji}
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 shrink-0">
              <Icon name="tag" size={18} className="text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold truncate">{widget.title}</h2>
            <p className="text-[13px] text-muted-foreground">{widget.unit}</p>
          </div>
        </div>
      </div>

      {/* Value input */}
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
        placeholder="0"
        autoFocus
        className="text-[24px] font-semibold text-center bg-muted/40 rounded-xl px-4 py-4 w-full focus:outline-none focus:ring-1 focus:ring-ring mb-4"
      />

      {/* Error banner */}
      {error && (
        <div className="mb-4">
          <ErrorBanner
            message={error}
            onRetry={handleSave}
            onDismiss={() => setError(null)}
          />
        </div>
      )}

      {/* Save button */}
      <Button
        className="w-full min-h-[44px] mb-2"
        disabled={saving || !value.trim()}
        onClick={handleSave}
      >
        {saving ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            Збереження...
          </span>
        ) : (
          'Зберегти'
        )}
      </Button>

      {/* View entries link */}
      <button
        type="button"
        onClick={onViewEntries}
        className="text-[13px] text-muted-foreground text-center min-h-[44px] w-full"
      >
        Переглянути записи
      </button>
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); onClose(); onDelete(widget.id); }}
        title="Видалити віджет?"
        subtitle="Цю дію не можна скасувати."
        confirmLabel="Видалити"
      />
    </BottomSheet>
  );
}

// ── DrillDownDrawer — shows source entries for a widget ──────────────────────

function DrillDownDrawer({ title, entries, onClose, onUpdate, onDelete, accessToken }: {
  title: string;
  entries: Entry[];
  onClose: () => void;
  onUpdate: (id: string, content: string, category: string) => Promise<void>;
  onDelete: (ids: string[]) => Promise<void>;
  accessToken?: string | null;
}) {
  const [editEntry, setEditEntry] = useState<Entry | null>(null);

  return (
    <>
      <BottomSheet open onClose={onClose} className="flex flex-col" style={{ maxHeight: '75vh', paddingBottom: 'calc(var(--tab-bar-h, 84px) + var(--bottom-inset, 0px))' }}>
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 pb-3 pt-3">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon name="close" size={14} />
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
      </BottomSheet>

      {editEntry && (
        <EditDrawer
          entry={editEntry}
          onSave={onUpdate}
          onDelete={async (id) => { await onDelete([id]); setEditEntry(null); }}
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
  const [selected, setSelected] = useState<DateRange>(filter.range);

  const PRESET_OPTIONS: { range: DateRange; label: string; icon: string }[] = [
    { range: 'today', label: RANGE_LABELS.today, icon: 'today' },
    { range: 'week',  label: RANGE_LABELS.week,  icon: 'date_range' },
    { range: 'month', label: RANGE_LABELS.month, icon: 'calendar_month' },
    { range: 'custom', label: RANGE_LABELS.custom, icon: 'tune' },
  ];

  const handleSelectPreset = (r: DateRange) => {
    setSelected(r);
    if (r !== 'custom') {
      onChange({ range: r, ...rangeFor(r) });
      onClose();
    }
  };

  const handleFromChange = (val: string) => {
    setFromStr(val);
  };

  const handleToChange = (val: string) => {
    setToStr(val);
  };

  const applyCustom = () => {
    const from = startOfDay(new Date(fromStr)), to = endOfDay(new Date(toStr));
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return;
    onChange({ range: 'custom', from, to });
    onClose();
  };

  return (
    <BottomSheet open onClose={onClose}>
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <h3 className="text-[17px] font-semibold">Оберіть період</h3>
      </div>

      {/* Preset rows */}
      <div className="px-4">
        {PRESET_OPTIONS.map(opt => {
          const isSelected = selected === opt.range;
          return (
            <button
              key={opt.range}
              onClick={() => handleSelectPreset(opt.range)}
              className="min-h-[44px] flex items-center gap-3 px-0 w-full"
            >
              <Icon name={opt.icon} size={20} className="text-primary/60 shrink-0" />
              <span className="flex-1 text-left text-[15px]">{opt.label}</span>
              {isSelected
                ? <Icon name="check" size={18} className="text-primary shrink-0" />
                : <Icon name="chevron_right" size={18} className="text-muted-foreground shrink-0" />
              }
            </button>
          );
        })}
      </div>

      {/* Inline custom date range */}
      <div className={cn('overflow-hidden transition-all duration-300', selected === 'custom' ? 'max-h-56' : 'max-h-0')}>
        <div className="mx-4 h-px bg-border/40" />
        <div className="px-4 pt-3 pb-1 flex items-center gap-2">
          <input
            type="date"
            value={fromStr}
            onChange={e => handleFromChange(e.target.value)}
            className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="date"
            value={toStr}
            onChange={e => handleToChange(e.target.value)}
            className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="px-4 pt-2 pb-1">
          <Button className="w-full min-h-[44px]" onClick={applyCustom}>Застосувати</Button>
        </div>
      </div>
    </BottomSheet>
  );
}

// ── Goals tab ─────────────────────────────────────────────────────────────────

function GoalsTab({ entries }: { entries: Entry[] }) {
  const goals = aggregateGoals(entries);
  const metrics = aggregateMetrics(entries);
  const metricByKey = new Map(metrics.map(m => [m.key, m]));

  if (goals.length === 0) {
    return (
      <EmptyState
        icon="🎯"
        title="Цілей ще немає"
        subtitle="Скажи боту про свою ціль, і вона з'явиться тут"
        features={[
          { emoji: '🏃', text: 'Пробігти 100 км цього місяця' },
          { emoji: '💧', text: 'Пити 2 л води щодня' },
          { emoji: '📚', text: 'Читати 20 сторінок на день' },
          { emoji: '💪', text: 'Тренуватись 3 рази на тиждень' },
          { emoji: '📈', text: 'Прогрес відстежується автоматично' },
        ]}
      />
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

function MetricCard({ metric, sourceEntries, onEntryClick, onLongPress, goal }: {
  metric: AggregatedMetric;
  sourceEntries: Entry[];
  onEntryClick: (entries: Entry[], title: string) => void;
  onLongPress: (metric: AggregatedMetric, sourceEntries: Entry[]) => void;
  goal?: { target: number; period?: string };
}) {
  const { text } = metricColor(metric.key);
  const aggLabel = metric.aggregate === 'avg' ? `середнє · ${metric.count}` : metric.aggregate === 'last' ? 'останнє' : `${metric.count} записів`;
  const pct = goal ? Math.min(100, Math.round((metric.value / goal.target) * 100)) : null;

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = () => {
    longPressTimer.current = setTimeout(() => {
      onLongPress(metric, sourceEntries);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  return (
    <Card
      className="flex cursor-pointer flex-col gap-1 p-4 active:opacity-70 select-none"
      onClick={() => onEntryClick(sourceEntries, metric.label)}
      onPointerDown={handlePointerDown}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
    >
      <MetricIcon name={metric.icon} size={20} className={cn('mb-1', text)} />
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
          <Icon name="monitor_heart" size={16} className="text-orange-600" />
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
          {count !== undefined && (
            <span className="text-[11px] text-muted-foreground/60">{count}</span>
          )}
        </div>
        <Icon name="expand_more" size={15} className={cn('text-muted-foreground transition-transform duration-200', !open && '-rotate-90')} />
      </button>
      {open && children}
    </div>
  );
}

// ── Mood helpers ──────────────────────────────────────────────────────────────

const MOOD_KW: Record<string, number> = {
  радіс: 2, щасл: 2, чудов: 2, добр: 1, спокій: 1, задоволен: 1, енергій: 1,
  сумн: -1, втомл: -1, погано: -2, жахл: -2, злий: -2, тривог: -2, стрес: -2, паршив: -2,
};
function scoreMood(t: string) { const l = t.toLowerCase(); let s = 0; for (const [k, v] of Object.entries(MOOD_KW)) if (l.includes(k)) s += v; return s; }

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
  const [allEntries, setAllEntries] = useState<Entry[]>([]); // for goals tab — no date filter
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [filter, setFilter] = useState<DateFilter>({ range: 'today', ...rangeFor('today') });
  const [drillDown, setDrillDown] = useState<{ title: string; entries: Entry[] } | null>(null);
  const [metricEdit, setMetricEdit] = useState<{ metric: AggregatedMetric; sourceEntries: Entry[] } | null>(null);
  const [view, setView] = useState('actual');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showCreateWidget, setShowCreateWidget] = useState(false);
  const [customWidgets, setCustomWidgets] = useState<CustomWidget[]>([]);
  const [logEntry, setLogEntry] = useState<{ widget: CustomWidget; drillEntries: Entry[] } | null>(null);

  // ── Paywall state ──────────────────────────────────────────────────────────
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallProps, setPaywallProps] = useState<{
    feature: string;
    current?: number;
    limit?: number;
    requiredTier: SubscriptionTier;
  }>({ feature: 'custom_widgets', requiredTier: 'stars_basic' });

  // ── User tier (for "+" button intercept) ──────────────────────────────────
  const [userTier, setUserTier] = useState<SubscriptionTier | null>(null);

  // ── Usage counts ───────────────────────────────────────────────────────────
  useUsageCounts(accessToken);

  const { play } = useSound();

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

  // Fetch all entries once for goals (goals can be from any date)
  const fetchAllEntries = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/entries?limit=500', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return;
      const { entries: data } = await res.json();
      setAllEntries(data ?? []);
    } catch { /* non-critical */ }
  }, [accessToken]);

  const fetchCustomWidgets = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/widgets', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return;
      const { widgets } = await res.json();
      setCustomWidgets(widgets ?? []);
    } catch { /* non-critical */ }
  }, [accessToken]);

  const fetchUserTier = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return;
      const { profile } = await res.json();
      setUserTier((profile?.subscription_tier as SubscriptionTier) ?? 'free');
    } catch { /* non-critical */ }
  }, [accessToken]);

  useEffect(() => { fetchEntries(filter.from, filter.to); }, [fetchEntries, filter]);
  useEffect(() => { fetchAllEntries(); fetchCustomWidgets(); fetchUserTier(); }, [fetchAllEntries, fetchCustomWidgets, fetchUserTier]);

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
    play('OPEN');
    setDrillDown({ title, entries: sourceEntries });
  };

  const handleMetricOverride = async (targetEntryId: string, metricKey: string, newValue: number, allSourceEntryIds: string[]) => {
    if (!accessToken) return;
    // Patch all source entries: set new value on the target, zero out the metric on all others.
    // This ensures the aggregated total reflects exactly what the user typed.
    const patches = allSourceEntryIds.map(id =>
      fetch('/api/entries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id, metric_override: { key: metricKey, value: id === targetEntryId ? newValue : 0 } }),
      }).then(r => r.ok ? r.json() : null)
    );
    const results = await Promise.all(patches);
    setEntries(prev => prev.map(e => {
      const result = results[allSourceEntryIds.indexOf(e.id)];
      return result?.entry ? { ...e, ...result.entry } : e;
    }));
  };

  const handleDelete = async (ids: string[]) => {
    if (!accessToken) return;
    const res = await fetch('/api/entries', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) return;
    setEntries(prev => prev.filter(e => !ids.includes(e.id)));
    setDrillDown(prev => prev ? { ...prev, entries: prev.entries.filter(e => !ids.includes(e.id)) } : null);
  };

  const deleteWidget = async (id: string) => {
    if (!accessToken) return;
    try {
      await fetch('/api/widgets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id }),
      });
      setCustomWidgets(prev => prev.filter(w => w.id !== id));
    } catch { /* non-critical */ }
  };
  // ── Derived ─────────────────────────────────────────────────────────────────

  const metrics = aggregateMetrics(entries);
  const metricByKey = new Map(metrics.map(m => [m.key, m]));

  const expEntries = entries.filter(e => e.category === 'expenses');
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
  const mainCurrency = Object.entries(byCur).sort((a, b) => b[1] - a[1])[0];
  const totalSpend = mainCurrency?.[1] ?? 0;
  const spendCats = Object.entries(byCat).sort((a, b) => b[1].total - a[1].total).slice(0, 5);

  const moodScores = feelEntries.map(e => scoreMood(e.content));
  const moodAvg = moodScores.length ? moodScores.reduce((a, b) => a + b, 0) / moodScores.length : null;
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
  const intakeMetric = metricByKey.get('kcal_intake');
  const burnedMetric = metricByKey.get('kcal_burned');
  const showEnergyBalance = !!(intakeMetric && burnedMetric);
  // Metrics to show in the generic grid (exclude ones handled specially)
  const specialKeys = new Set(['kcal_intake', 'kcal_burned']);
  const genericMetrics = metrics.filter(m => !specialKeys.has(m.key));

  const openPaywall = (feature: string, current: number | undefined, limit: number | undefined, requiredTier: SubscriptionTier) => {
    setPaywallProps({ feature, current, limit, requiredTier });
    setPaywallOpen(true);
  };

  const handleAddWidgetTap = () => {
    // Count all custom widgets against the limit
    const widgetCount = customWidgets.length;
    // Treat null (still loading) as 'free' — safe default
    const effectiveTier = userTier ?? 'free';
    if (effectiveTier === 'free' && widgetCount >= 3) {
      openPaywall('ai_widgets', widgetCount, 3, 'stars_basic');
      return;
    }
    play('OPEN');
    setShowCreateWidget(true);
  };

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-[28px] font-bold leading-tight">Віджети</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Date picker */}
          <button
            onClick={() => { play('OPEN'); setShowCalendar(true); }}
            className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground min-h-[44px]"
          >
            <Icon name="calendar_today" size={13} />
            {filter.range === 'custom' ? `${fmtDate(filter.from)} – ${fmtDate(filter.to)}` : RANGE_LABELS[filter.range]}
          </button>
          {/* Add widget */}
          <div className="relative">
            <button
              onClick={handleAddWidgetTap}
              className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity active:opacity-80"
              aria-label="Додати віджет"
            >
              <Icon name="add" size={20} />
            </button>
            {/* Lock badge for Free tier when widget count >= 3 */}
            {(userTier === 'free' || userTier === null) && customWidgets.length >= 3 && (
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center pointer-events-none">
                <Icon name="lock" size={10} className="text-slate-900" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View tabs */}
      <Tabs value={view} onValueChange={setView}>
        <TabsList className="w-full">
          <TabsTrigger value="actual">Лог</TabsTrigger>
          <TabsTrigger value="goals">Цілі</TabsTrigger>
        </TabsList>

        <TabsContent value="goals">
          {status === 'loading' && (
            <div className="grid grid-cols-2 gap-3 mt-4" role="status" aria-label="Завантаження...">
              <SkeletonMetricCard />
              <SkeletonMetricCard />
              <SkeletonMetricCard />
              <SkeletonMetricCard />
            </div>
          )}
          {status === 'ready' && <GoalsTab entries={allEntries} />}
        </TabsContent>

        <TabsContent value="actual">
          {status === 'loading' && (
            <div className="grid grid-cols-2 gap-3 mt-4" role="status" aria-label="Завантаження...">
              <SkeletonMetricCard />
              <SkeletonMetricCard />
              <SkeletonMetricCard />
              <SkeletonMetricCard />
            </div>
          )}
          {status === 'error' && (
            <ErrorBanner
              message="Не вдалося завантажити дані"
              onRetry={() => fetchEntries(filter.from, filter.to)}
              onDismiss={() => setStatus('ready')}
            />
          )}
          {status === 'ready' && entries.length === 0 && customWidgets.length === 0 && (
            <EmptyState
              icon="📊"
              title="Немає даних за цей період"
              subtitle="Записуй активність у боті — вона з'явиться тут"
              features={[
                { emoji: '🔥', text: 'Калорії, кроки, тренування' },
                { emoji: '😴', text: 'Сон, настрій, рівень енергії' },
                { emoji: '💸', text: 'Витрати по категоріях' },
                { emoji: '💡', text: 'Ідеї та нотатки' },
                { emoji: '➕', text: 'Створи власний AI-віджет' },
              ]}
              ctaLabel="Новий віджет"
              onCta={handleAddWidgetTap}
            />
          )}

          {/* Custom widgets — always visible when ready, regardless of date filter */}
          {status === 'ready' && customWidgets.length > 0 && (
            <div className="flex flex-col gap-6 mt-4">
              <Section title="Мої віджети" count={customWidgets.length}>
                <div className="grid grid-cols-2 gap-3">
                  {customWidgets.map(w => {
                    const matchedMetric = metricByKey.get(w.metric_key);
                    const srcEntries = metricSourceEntries.get(w.metric_key) ?? [];
                    const wColor = getIconColor(w.iconColor ?? w.color);
                    const wEmoji = w.emoji ?? '📊';
                    const aggLabel = matchedMetric
                      ? matchedMetric.aggregate === 'avg'
                        ? `середнє · ${matchedMetric.count}`
                        : matchedMetric.aggregate === 'last'
                          ? 'останнє'
                          : `${matchedMetric.count} записів`
                      : 'Немає даних';
                    const goalPct = (w.goal && matchedMetric)
                      ? Math.min(100, Math.round((matchedMetric.value / w.goal) * 100))
                      : null;

                    return (
                      <Card
                        key={w.id}
                        className="flex flex-col gap-0 p-4 cursor-pointer active:opacity-70 select-none overflow-hidden"
                        onClick={() => { play('OPEN'); setLogEntry({ widget: w, drillEntries: srcEntries }); }}
                      >
                        {/* Icon circle + title row */}
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl text-xl shrink-0', wColor.bg)}>
                            {wEmoji}
                          </div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight line-clamp-2">{w.title}</p>
                        </div>

                        {/* Value */}
                        <div className="flex items-baseline gap-1 mb-0.5">
                          <span className="text-[26px] font-bold tracking-tight leading-none">
                            {matchedMetric ? matchedMetric.value.toLocaleString() : '—'}
                          </span>
                          <span className="text-[13px] text-muted-foreground">{w.unit}</span>
                        </div>

                        {/* Sub-label */}
                        <p className="text-[11px] text-muted-foreground">{aggLabel}</p>

                        {/* Goal progress bar */}
                        {goalPct !== null && (
                          <div className="mt-2">
                            <div className="h-1 w-full overflow-hidden rounded-full bg-muted/60">
                              <div
                                className={cn('h-full rounded-full transition-all', goalPct >= 100 ? 'bg-green-400' : wColor.bg)}
                                style={{ width: `${goalPct}%` }}
                              />
                            </div>
                            <p className="mt-0.5 text-right text-[10px] text-muted-foreground">{goalPct}%</p>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                  {/* Add widget button */}
                  <button
                    onClick={handleAddWidgetTap}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 p-4 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary active:bg-muted/20 min-h-[120px]"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                      <Icon name="add" size={20} className="text-primary" />
                    </div>
                    <span className="text-xs font-medium">Додати</span>
                  </button>
                </div>
              </Section>
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
                    {intakeMetric && !burnedMetric && <MetricCard metric={intakeMetric} sourceEntries={metricSourceEntries.get('kcal_intake') ?? []} onEntryClick={openDrillDown} onLongPress={(m, s) => { play('OPEN'); setMetricEdit({ metric: m, sourceEntries: s }); }} />}
                    {burnedMetric && !intakeMetric && <MetricCard metric={burnedMetric} sourceEntries={metricSourceEntries.get('kcal_burned') ?? []} onEntryClick={openDrillDown} onLongPress={(m, s) => { play('OPEN'); setMetricEdit({ metric: m, sourceEntries: s }); }} />}
                    {genericMetrics.map(m => <MetricCard key={m.key} metric={m} sourceEntries={metricSourceEntries.get(m.key) ?? []} onEntryClick={openDrillDown} onLongPress={(metric, src) => { play('OPEN'); setMetricEdit({ metric, sourceEntries: src }); }} />)}
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
                          <Icon name="account_balance_wallet" size={16} className="text-emerald-600" />
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
                          <SpendBar key={cat} label={cat} pct={totalSpend > 0 ? Math.round((total / totalSpend) * 100) : 0} amount={total} currency={currency} />
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
                        <Icon name={moodAvg === null ? 'remove' : moodAvg > 0.5 ? 'trending_up' : moodAvg < -0.5 ? 'trending_down' : 'remove'} size={20} />
                      </div>
                      <div>
                        <p className="font-semibold">{moodLabel}</p>
                        <p className="text-xs text-muted-foreground">{feelEntries.length} записів про почуття</p>
                      </div>
                    </div>
                    {recentMood.length > 1 && (
                      <div className="flex items-end gap-1" style={{ height: 36 }}>
                        {recentMood.map((s, i) => {
                          const h = Math.max(4, Math.round((Math.abs(s) / maxMoodAbs) * 32));
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
                          <Icon name="lightbulb" size={13} className="text-amber-600" />
                        </div>
                        <p className="text-sm leading-relaxed line-clamp-2">{e.content}</p>
                      </Card>
                    ))}
                    {ideaEntries.length > 5 && (
                      <button className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground">
                        <Icon name="chevron_right" size={13} /> Ще {ideaEntries.length - 5} ідей
                      </button>
                    )}
                  </div>
                </Section>
              )}

            </div>
          )}
        </TabsContent>
      </Tabs>
      {/* Metric edit sheet (long-press) */}
      {metricEdit && (
        <MetricEditSheet
          metric={metricEdit.metric}
          sourceEntries={metricEdit.sourceEntries}
          onSave={handleMetricOverride}
          onDelete={handleDelete}
          onClose={() => { play('CLOSE'); setMetricEdit(null); }}
        />
      )}

      {/* Drill-down drawer */}
      {drillDown && (
        <DrillDownDrawer
          title={drillDown.title}
          entries={drillDown.entries}
          onClose={() => { play('CLOSE'); setDrillDown(null); }}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          accessToken={accessToken}
        />
      )}

      {/* Calendar sheet */}
      {showCalendar && (
        <CalendarSheet filter={filter} onChange={setFilter} onClose={() => { play('CLOSE'); setShowCalendar(false); }} />
      )}

      {/* Create widget sheet */}
      {showCreateWidget && (
        <CreateWidgetSheet
          onClose={() => { play('CLOSE'); setShowCreateWidget(false); }}
          onCreated={(widget) => {
            setCustomWidgets(prev => [...prev.filter(w => w.id !== widget.id), widget]);
            fetchCustomWidgets(); // re-sync from server to ensure consistency
          }}
          onPaywall={openPaywall}
          accessToken={accessToken}
          hasEntries={allEntries.length > 0}
        />
      )}

      {/* Log entry sheet */}
      {logEntry && (
        <LogEntrySheet
          open={!!logEntry}
          onClose={() => { play('CLOSE'); setLogEntry(null); }}
          widget={logEntry.widget}
          onSaved={() => { fetchEntries(filter.from, filter.to); }}
          onViewEntries={() => { setLogEntry(null); openDrillDown(logEntry.drillEntries, logEntry.widget.title); }}
          onDelete={(widgetId) => { deleteWidget(widgetId); setLogEntry(null); }}
          onPaywall={openPaywall}
          accessToken={accessToken}
        />
      )}

      {/* Paywall Modal */}
      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        {...paywallProps}
      />
    </div>
  );
}
