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
import { Chip } from '@/components/ui/chip';
import { ErrorBanner } from '@/components/ui/error-banner';
import { SkeletonMetricCard } from '@/components/ui/skeleton';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { PaywallModal } from '@/components/ui/paywall-modal';
import { useUsageCounts } from '@/lib/hooks/use-usage-counts';
import type { SubscriptionTier } from '@/lib/stars/paywall';

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
  color?: string;
  aggregate: 'sum' | 'avg' | 'last';
  category?: string;
  created_at: string;
}

// ── CreateWidgetSheet — 3-step chip-based widget creation ────────────────────

interface WidgetCategory {
  id: string;
  label: string;
  icon: string;
}

const WIDGET_CATEGORIES: WidgetCategory[] = [
  { id: 'food', label: 'Харчування', icon: 'restaurant' },
  { id: 'activity', label: 'Активність', icon: 'fitness_center' },
  { id: 'sleep', label: 'Сон', icon: 'bedtime' },
  { id: 'water', label: 'Вода', icon: 'water_drop' },
  { id: 'weight', label: 'Вага', icon: 'scale' },
  { id: 'expenses', label: 'Витрати', icon: 'account_balance_wallet' },
  { id: 'mood', label: 'Настрій', icon: 'sentiment_satisfied' },
  { id: 'custom', label: 'Кастомний', icon: 'add_circle' },
];

const CATEGORY_QUESTIONS: Record<string, string[]> = {
  food: ['Калорії за день', 'Білки / жири / вуглеводи', 'Конкретний продукт'],
  activity: ['Кроки за день', 'Хвилини тренування', 'Дистанція (км)'],
  sleep: ['Годин сну', 'Якість сну (1–10)', 'Час підйому'],
  water: ['Мл води за день', 'Склянки води', 'Відсоток норми'],
  weight: ['Поточна вага (кг)', 'Зміна ваги за тиждень', 'ІМТ'],
  expenses: ['Витрати за день (грн)', 'Витрати за категорією', 'Залишок бюджету'],
  mood: ['Оцінка настрою (1–10)', 'Рівень стресу (1–10)', 'Рівень енергії (1–10)'],
  custom: [],
};

// Direct widget definitions — no AI needed for predefined questions
type DirectWidget = Omit<CustomWidget, 'created_at'>;
const DIRECT_WIDGETS: Record<string, Record<string, DirectWidget>> = {
  food: {
    'Калорії за день':            { id: 'kcal_intake',  title: 'Калорії',       metric_key: 'kcal_intake',  unit: 'ккал', icon: 'flame',    color: 'orange',  aggregate: 'sum', category: 'calories' },
    'Білки / жири / вуглеводи':   { id: 'protein_g',   title: 'Білки',         metric_key: 'protein_g',    unit: 'г',    icon: 'utensils', color: 'red',     aggregate: 'sum', category: 'calories' },
    'Конкретний продукт':         { id: 'food_custom',  title: 'Продукт',       metric_key: 'food_custom',  unit: 'г',    icon: 'utensils', color: 'amber',   aggregate: 'sum', category: 'calories' },
  },
  activity: {
    'Кроки за день':              { id: 'steps_count',  title: 'Кроки',         metric_key: 'steps_count',  unit: 'кроків', icon: 'activity', color: 'green',  aggregate: 'sum', category: 'workout' },
    'Хвилини тренування':         { id: 'active_min',   title: 'Тренування',    metric_key: 'active_min',   unit: 'хв',   icon: 'dumbbell', color: 'blue',    aggregate: 'sum', category: 'workout' },
    'Дистанція (км)':             { id: 'distance_km',  title: 'Дистанція',     metric_key: 'distance_km',  unit: 'км',   icon: 'map-pin',  color: 'cyan',    aggregate: 'sum', category: 'workout' },
  },
  sleep: {
    'Годин сну':                  { id: 'sleep_hours',  title: 'Сон',           metric_key: 'sleep_hours',  unit: 'год',  icon: 'moon',     color: 'indigo',  aggregate: 'avg', category: 'sleep' },
    'Якість сну (1–10)':          { id: 'sleep_quality',title: 'Якість сну',    metric_key: 'sleep_quality',unit: '/10',  icon: 'moon',     color: 'violet',  aggregate: 'avg', category: 'sleep' },
    'Час підйому':                { id: 'wake_time',    title: 'Підйом',        metric_key: 'wake_time',    unit: 'год',  icon: 'clock',    color: 'purple',  aggregate: 'last',category: 'sleep' },
  },
  water: {
    'Мл води за день':            { id: 'water_ml',     title: 'Вода',          metric_key: 'water_ml',     unit: 'мл',   icon: 'droplets', color: 'cyan',    aggregate: 'sum', category: 'health' },
    'Склянки води':               { id: 'water_glasses',title: 'Склянки',       metric_key: 'water_glasses',unit: 'скл',  icon: 'droplets', color: 'sky',     aggregate: 'sum', category: 'health' },
    'Відсоток норми':             { id: 'water_pct',    title: 'Норма води',    metric_key: 'water_pct',    unit: '%',    icon: 'droplets', color: 'teal',    aggregate: 'last',category: 'health' },
  },
  weight: {
    'Поточна вага (кг)':          { id: 'weight_kg',    title: 'Вага',          metric_key: 'weight_kg',    unit: 'кг',   icon: 'scale',    color: 'teal',    aggregate: 'last',category: 'health' },
    'Зміна ваги за тиждень':      { id: 'weight_delta', title: 'Зміна ваги',    metric_key: 'weight_delta', unit: 'кг',   icon: 'trending-up','color': 'lime', aggregate: 'last',category: 'health' },
    'ІМТ':                        { id: 'bmi',          title: 'ІМТ',           metric_key: 'bmi',          unit: '',     icon: 'scale',    color: 'green',   aggregate: 'last',category: 'health' },
  },
  expenses: {
    'Витрати за день (грн)':      { id: 'expenses_day', title: 'Витрати',       metric_key: 'expenses_day', unit: 'грн',  icon: 'wallet',   color: 'emerald', aggregate: 'sum', category: 'expenses' },
    'Витрати за категорією':      { id: 'expenses_cat', title: 'Витрати (кат)', metric_key: 'expenses_cat', unit: 'грн',  icon: 'wallet',   color: 'green',   aggregate: 'sum', category: 'expenses' },
    'Залишок бюджету':            { id: 'budget_left',  title: 'Бюджет',        metric_key: 'budget_left',  unit: 'грн',  icon: 'wallet',   color: 'lime',    aggregate: 'last',category: 'expenses' },
  },
  mood: {
    'Оцінка настрою (1–10)':      { id: 'mood_score',   title: 'Настрій',       metric_key: 'mood_score',   unit: '/10',  icon: 'smile',    color: 'pink',    aggregate: 'avg', category: 'feelings' },
    'Рівень стресу (1–10)':       { id: 'stress_level', title: 'Стрес',         metric_key: 'stress_level', unit: '/10',  icon: 'zap',      color: 'rose',    aggregate: 'avg', category: 'feelings' },
    'Рівень енергії (1–10)':      { id: 'energy_level', title: 'Енергія',       metric_key: 'energy_level', unit: '/10',  icon: 'zap',      color: 'yellow',  aggregate: 'avg', category: 'feelings' },
  },
};

function CreateWidgetSheet({ onClose, onCreated, onPaywall, accessToken }: {
  onClose: () => void;
  onCreated: (widget: CustomWidget) => void;
  onPaywall: (feature: string, current: number | undefined, limit: number | undefined, requiredTier: SubscriptionTier) => void;
  accessToken?: string | null;
}) {
  const [step, setStep] = useState(0); // 0, 1, 2
  const [selectedCategory, setSelectedCategory] = useState<WidgetCategory | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const { play } = useSound();

  // Auto-focus custom input when revealed
  useEffect(() => {
    if (showCustomInput) {
      setTimeout(() => customInputRef.current?.focus(), 50);
    }
  }, [showCustomInput]);

  const handleCategorySelect = (cat: WidgetCategory) => {
    play('SELECT');
    setSelectedCategory(cat);
    setSelectedQuestion(null);
    setShowCustomInput(cat.id === 'custom');
    setCustomText('');
    setError(null);
    setStep(1);
  };

  const handleQuestionSelect = (q: string) => {
    play('SELECT');
    setSelectedQuestion(q);
    setShowCustomInput(false);
    setCustomText('');
  };

  const handleCustomChipTap = () => {
    play('OPEN');
    setSelectedQuestion(null);
    setShowCustomInput(true);
    setTimeout(() => customInputRef.current?.focus(), 50);
  };

  const canProceedStep1 = selectedQuestion !== null || (showCustomInput && customText.trim().length > 0);

  const handleNextFromStep1 = () => {
    if (!canProceedStep1) return;
    play('SLIDE');
    setError(null);
    setStep(2);
  };

  const handleCreate = async () => {
    if (!accessToken || !selectedCategory) return;
    const prompt = selectedQuestion ?? customText.trim();
    if (!prompt) return;

    setCreating(true);
    setError(null);
    try {
      // Use direct widget definition for predefined questions (no AI, instant)
      const directDef = selectedCategory.id !== 'custom'
        ? DIRECT_WIDGETS[selectedCategory.id]?.[prompt]
        : null;

      const body = directDef
        ? { prompt: `${selectedCategory.label}: ${prompt}`, direct: directDef }
        : { prompt: `${selectedCategory.label}: ${prompt}`, answers: { question: prompt } };

      const res = await fetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 402) {
        onClose();
        onPaywall(
          data.feature ?? 'widgets',
          data.current,
          data.limit,
          (data.required_tier as SubscriptionTier) ?? 'stars_basic',
        );
      } else if (!res.ok) {
        setError('Не вдалося створити віджет. Спробуй ще раз.');
      } else {
        onCreated(data.widget);
        play('CELEBRATION');
        setTimeout(onClose, 800);
      }
    } catch {
      setError('Не вдалося створити віджет. Спробуй ще раз.');
    } finally {
      setCreating(false);
    }
  };

  const questions = selectedCategory ? CATEGORY_QUESTIONS[selectedCategory.id] ?? [] : [];
  const displayQuestion = selectedQuestion ?? (showCustomInput && customText.trim() ? customText.trim() : null);

  return (
    <BottomSheet open onClose={onClose} className="px-4 pt-4 pb-6 max-h-[85vh] overflow-y-auto">
      {/* Step indicator — pill style */}
      <div className="flex gap-1.5 justify-center mb-5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={cn(
              'h-1.5 rounded-full transition-all duration-200',
              i === step ? 'w-5 bg-primary' : i < step ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-muted'
            )}
          />
        ))}
      </div>

      {/* ── Step 0: Category selection ── */}
      {step === 0 && (
        <div>
          <h3 className="text-[17px] font-semibold mb-4">Що хочеш відстежувати?</h3>
          <div className="flex flex-wrap gap-2 pb-2">
            {WIDGET_CATEGORIES.map(cat => (
              <Chip
                key={cat.id}
                label={cat.label}
                icon={cat.icon}
                selected={selectedCategory?.id === cat.id}
                onClick={() => handleCategorySelect(cat)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Step 1: Question selection ── */}
      {step === 1 && (
        <div>
          <button
            onClick={() => { play('SLIDE'); setStep(0); setError(null); }}
            className="text-[13px] text-muted-foreground min-h-[44px] flex items-center mb-1"
          >
            ← Назад
          </button>
          <h3 className="text-[17px] font-semibold mb-4">{selectedCategory?.label ?? ''}</h3>

          {selectedCategory?.id !== 'custom' && (
            <div className="flex flex-wrap gap-2 mb-3">
              {questions.map(q => (
                <Chip
                  key={q}
                  label={q}
                  selected={selectedQuestion === q}
                  onClick={() => handleQuestionSelect(q)}
                />
              ))}
              <Chip
                label="Свій варіант"
                icon="add_circle"
                selected={showCustomInput}
                onClick={handleCustomChipTap}
              />
            </div>
          )}

          {showCustomInput && (
            <input
              ref={customInputRef}
              type="text"
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canProceedStep1) handleNextFromStep1(); }}
              placeholder="Введи свій варіант..."
              className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring mb-3"
            />
          )}

          <Button
            className="w-full min-h-[44px]"
            disabled={!canProceedStep1}
            onClick={handleNextFromStep1}
          >
            Далі
          </Button>
        </div>
      )}

      {/* ── Step 2: Confirmation ── */}
      {step === 2 && (
        <div>
          <button
            onClick={() => { play('SLIDE'); setStep(1); setError(null); }}
            className="text-[13px] text-muted-foreground min-h-[44px] flex items-center mb-1"
          >
            ← Змінити
          </button>

          {selectedCategory && (
            <div className="bg-muted/40 rounded-2xl p-4 flex items-center gap-3 mb-4">
              <Icon name={selectedCategory.icon} size={32} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold truncate">{selectedCategory.label}</p>
                {displayQuestion && (
                  <p className="text-sm text-muted-foreground truncate">{displayQuestion}</p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4">
              <ErrorBanner message={error} onRetry={handleCreate} onDismiss={() => setError(null)} />
            </div>
          )}

          <Button
            className="w-full min-h-[44px]"
            disabled={creating}
            onClick={handleCreate}
          >
            {creating ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                {DIRECT_WIDGETS[selectedCategory?.id ?? '']?.[displayQuestion ?? ''] ? 'Створюємо...' : 'AI створює...'}
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
  accessToken?: string | null;
}

function LogEntrySheet({ open, onClose, widget, onSaved, onViewEntries, onDelete, accessToken }: LogEntrySheetProps) {
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
        <div className="flex-1 min-w-0">
          <h2 className="text-[17px] font-semibold truncate">{widget.title}</h2>
          <p className="text-[13px] text-muted-foreground">{widget.unit}</p>
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
  const { bg, text } = metricColor(metric.key);
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
      className="flex cursor-pointer flex-col gap-1 p-4 transition-colors hover:bg-muted/30 active:bg-muted/50 select-none"
      onClick={() => onEntryClick(sourceEntries, metric.label)}
      onPointerDown={handlePointerDown}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
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
  const { counts: usageCounts } = useUsageCounts(accessToken);

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
    // Count only AI widgets against the limit — preset widgets are always free
    const aiWidgetCount = customWidgets.filter((w: CustomWidget & { is_ai?: boolean }) => w.is_ai !== false).length;
    if (userTier === 'free' && usageCounts !== null && aiWidgetCount >= 3) {
      openPaywall('ai_widgets', aiWidgetCount, 3, 'stars_basic');
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
            {/* Lock badge for Free tier when AI widget count >= 3 */}
            {userTier === 'free' && customWidgets.filter((w: CustomWidget & { is_ai?: boolean }) => w.is_ai !== false).length >= 3 && (
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
          {status === 'ready' && entries.length === 0 && (
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

              {/* ── Custom widgets ────────────────────────────────────────────── */}
              {customWidgets.length > 0 && (
                <Section title="Мої віджети" count={customWidgets.length}>
                  <div className="grid grid-cols-2 gap-3">
                    {customWidgets.map(w => {
                      const colorObj = { bg: 'bg-primary/10', text: 'text-primary' };
                      const matchedMetric = metricByKey.get(w.metric_key);
                      const srcEntries = metricSourceEntries.get(w.metric_key) ?? [];
                      if (matchedMetric) {
                        // Custom widget with data — tap opens LogEntrySheet (has delete inside)
                        return (
                          <Card
                            key={w.id}
                            className="flex flex-col gap-1 p-4 cursor-pointer transition-colors hover:bg-muted/30 active:bg-muted/50 select-none"
                            onClick={() => { play('OPEN'); setLogEntry({ widget: w, drillEntries: srcEntries }); }}
                          >
                            {(() => { const { bg, text } = metricColor(matchedMetric.key); return (
                              <div className={cn('mb-1 flex h-8 w-8 items-center justify-center rounded-xl', bg)}>
                                <MetricIcon name={w.icon ?? matchedMetric.icon} size={16} className={text} />
                              </div>
                            ); })()}
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-bold tracking-tight">{matchedMetric.value.toLocaleString()}</span>
                              <span className="text-sm text-muted-foreground">{matchedMetric.unit}</span>
                            </div>
                            <p className="text-xs font-medium">{w.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {matchedMetric.aggregate === 'avg' ? `середнє · ${matchedMetric.count}` : matchedMetric.aggregate === 'last' ? 'останнє' : `${matchedMetric.count} записів`}
                            </p>
                          </Card>
                        );
                      }
                      // Widget defined but no data yet — show empty placeholder
                      return (
                        <Card
                          key={w.id}
                          className="flex flex-col gap-1 p-4 cursor-pointer transition-colors hover:bg-muted/30 active:bg-muted/50"
                          onClick={() => { play('OPEN'); setLogEntry({ widget: w, drillEntries: [] }); }}
                        >
                          <div className={cn('mb-1 flex h-8 w-8 items-center justify-center rounded-xl', colorObj.bg)}>
                            <MetricIcon name={w.icon} size={16} className={colorObj.text} />
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold tracking-tight text-muted-foreground">—</span>
                            <span className="text-sm text-muted-foreground">{w.unit}</span>
                          </div>
                          <p className="text-xs font-medium">{w.title}</p>
                          <p className="text-[10px] text-muted-foreground">Немає даних</p>
                        </Card>
                      );
                    })}
                    {/* Add widget button — matches retro circle style */}
                    <button
                      onClick={handleAddWidgetTap}
                      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 p-4 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary active:bg-muted/20 min-h-[80px]"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <Icon name="add" size={18} className="text-primary" />
                      </div>
                      <span className="text-xs font-medium">Новий</span>
                    </button>
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
