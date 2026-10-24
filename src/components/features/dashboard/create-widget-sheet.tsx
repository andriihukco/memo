'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/legacy/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ErrorBanner } from '@/components/ui/error-banner';
import { useSound } from '@/lib/sound/use-sound';
import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import type { SubscriptionTier } from '@/lib/billing/plans';
import { ICON_COLORS, EMOJI_LIBRARY } from './dashboard-constants';
import { getIconColor } from './dashboard-helpers';
import type { MeasureOption, CustomWidget } from './dashboard-types';

interface CreateWidgetSheetProps {
  onClose: () => void;
  onCreated: (widget: CustomWidget) => void;
  onPaywall: (feature: string, current: number | undefined, limit: number | undefined, requiredTier: SubscriptionTier) => void;
  accessToken?: string | null;
  hasEntries: boolean;
}

export function CreateWidgetSheet({ onClose, onCreated, onPaywall, accessToken, hasEntries }: CreateWidgetSheetProps) {
  const [step, setStep] = useState(0); // 0 = pick metric, 1 = icon, 2 = details
  const [selected, setSelected] = useState<MeasureOption | null>(null);
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState('');
  const [goal, setGoal] = useState('');
  const [goalPeriod, setGoalPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [emoji, setEmoji] = useState('✨');
  const [iconColor, setIconColor] = useState('blue');
  const [iconTab, setIconTab] = useState<'color' | 'emoji'>('color');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const { play } = useSound();
  const { t } = useI18n();

  // Build translated measure options
  const MEASURE_OPTIONS_T: MeasureOption[] = [
    { id: 'water',    emoji: '💧', label: t('miniapp.dashboard.measure.water'),    sublabel: t('miniapp.dashboard.measure.water_sub'),    defaultUnit: 'ml',   defaultAggregate: 'sum',  defaultEmoji: '💧', defaultColor: 'cyan',    category: 'health',    metricKey: 'water_ml',
      directWidget: { id: 'water_ml',     title: t('miniapp.dashboard.measure.water'),    metric_key: 'water_ml',     unit: 'ml',   emoji: '💧', iconColor: 'cyan',    aggregate: 'sum',  category: 'health' } },
    { id: 'calories', emoji: '🔥', label: t('miniapp.dashboard.measure.calories'), sublabel: t('miniapp.dashboard.measure.calories_sub'), defaultUnit: 'kcal', defaultAggregate: 'sum',  defaultEmoji: '🔥', defaultColor: 'orange',  category: 'calories',  metricKey: 'kcal_intake',
      directWidget: { id: 'kcal_intake',  title: t('miniapp.dashboard.measure.calories'), metric_key: 'kcal_intake',  unit: 'kcal', emoji: '🔥', iconColor: 'orange',  aggregate: 'sum',  category: 'calories' } },
    { id: 'sleep',    emoji: '😴', label: t('miniapp.dashboard.measure.sleep'),    sublabel: t('miniapp.dashboard.measure.sleep_sub'),    defaultUnit: 'h',    defaultAggregate: 'avg',  defaultEmoji: '😴', defaultColor: 'indigo',  category: 'sleep',     metricKey: 'sleep_hours',
      directWidget: { id: 'sleep_hours',  title: t('miniapp.dashboard.measure.sleep'),    metric_key: 'sleep_hours',  unit: 'h',    emoji: '😴', iconColor: 'indigo',  aggregate: 'avg',  category: 'sleep' } },
    { id: 'steps',    emoji: '🏃', label: t('miniapp.dashboard.measure.steps'),    sublabel: t('miniapp.dashboard.measure.steps_sub'),    defaultUnit: '',     defaultAggregate: 'sum',  defaultEmoji: '🏃', defaultColor: 'green',   category: 'workout',   metricKey: 'steps_count',
      directWidget: { id: 'steps_count',  title: t('miniapp.dashboard.measure.steps'),    metric_key: 'steps_count',  unit: '',     emoji: '🏃', iconColor: 'green',   aggregate: 'sum',  category: 'workout' } },
    { id: 'workout',  emoji: '💪', label: t('miniapp.dashboard.measure.workout'),  sublabel: t('miniapp.dashboard.measure.workout_sub'),  defaultUnit: 'min',  defaultAggregate: 'sum',  defaultEmoji: '💪', defaultColor: 'blue',    category: 'workout',   metricKey: 'active_min',
      directWidget: { id: 'active_min',   title: t('miniapp.dashboard.measure.workout'),  metric_key: 'active_min',   unit: 'min',  emoji: '💪', iconColor: 'blue',    aggregate: 'sum',  category: 'workout' } },
    { id: 'weight',   emoji: '⚖️', label: t('miniapp.dashboard.measure.weight'),   sublabel: t('miniapp.dashboard.measure.weight_sub'),   defaultUnit: 'kg',   defaultAggregate: 'last', defaultEmoji: '⚖️', defaultColor: 'teal',    category: 'health',    metricKey: 'weight_kg',
      directWidget: { id: 'weight_kg',    title: t('miniapp.dashboard.measure.weight'),   metric_key: 'weight_kg',    unit: 'kg',   emoji: '⚖️', iconColor: 'teal',    aggregate: 'last', category: 'health' } },
    { id: 'mood',     emoji: '😊', label: t('miniapp.dashboard.measure.mood'),     sublabel: t('miniapp.dashboard.measure.mood_sub'),     defaultUnit: '/10',  defaultAggregate: 'avg',  defaultEmoji: '😊', defaultColor: 'pink',    category: 'feelings',  metricKey: 'mood_score',
      directWidget: { id: 'mood_score',   title: t('miniapp.dashboard.measure.mood'),     metric_key: 'mood_score',   unit: '/10',  emoji: '😊', iconColor: 'pink',    aggregate: 'avg',  category: 'feelings' } },
    { id: 'expenses', emoji: '💸', label: t('miniapp.dashboard.measure.expenses'), sublabel: t('miniapp.dashboard.measure.expenses_sub'), defaultUnit: '',     defaultAggregate: 'sum',  defaultEmoji: '💸', defaultColor: 'emerald', category: 'expenses',  metricKey: 'expenses_day',
      directWidget: { id: 'expenses_day', title: t('miniapp.dashboard.measure.expenses'), metric_key: 'expenses_day', unit: '',     emoji: '💸', iconColor: 'emerald', aggregate: 'sum',  category: 'expenses' } },
    { id: 'protein',  emoji: '🥩', label: t('miniapp.dashboard.measure.protein'),  sublabel: t('miniapp.dashboard.measure.protein_sub'),  defaultUnit: 'g',    defaultAggregate: 'sum',  defaultEmoji: '🥩', defaultColor: 'red',     category: 'calories',  metricKey: 'protein_g',
      directWidget: { id: 'protein_g',    title: t('miniapp.dashboard.measure.protein'),  metric_key: 'protein_g',    unit: 'g',    emoji: '🥩', iconColor: 'red',     aggregate: 'sum',  category: 'calories' } },
    { id: 'energy',   emoji: '⚡', label: t('miniapp.dashboard.measure.energy'),   sublabel: t('miniapp.dashboard.measure.energy_sub'),   defaultUnit: '/10',  defaultAggregate: 'avg',  defaultEmoji: '⚡', defaultColor: 'yellow', category: 'feelings',  metricKey: 'energy_level',
      directWidget: { id: 'energy_level', title: t('miniapp.dashboard.measure.energy'),   metric_key: 'energy_level', unit: '/10',  emoji: '⚡', iconColor: 'yellow',  aggregate: 'avg',  category: 'feelings' } },
    { id: 'reading',  emoji: '📚', label: t('miniapp.dashboard.measure.reading'),  sublabel: t('miniapp.dashboard.measure.reading_sub'),  defaultUnit: '',     defaultAggregate: 'sum',  defaultEmoji: '📚', defaultColor: 'amber',   category: 'books',     metricKey: 'pages_read',
      directWidget: { id: 'pages_read',   title: t('miniapp.dashboard.measure.reading'),  metric_key: 'pages_read',   unit: '',     emoji: '📚', iconColor: 'amber',   aggregate: 'sum',  category: 'books' } },
    { id: 'custom',   emoji: '✨', label: t('miniapp.dashboard.measure.custom'),   sublabel: t('miniapp.dashboard.measure.custom_sub'),   defaultUnit: '',     defaultAggregate: 'sum',  defaultEmoji: '✨', defaultColor: 'violet',  category: 'health',    metricKey: 'custom' },
  ];

  const goTo = (s: number) => { play('SLIDE'); setStep(s); setError(null); };

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

  // Auto-focus title when reaching step 2
  useEffect(() => {
    if (step === 2) setTimeout(() => titleRef.current?.focus(), 80);
  }, [step]);

  const handleCreate = async () => {
    if (!accessToken || !selected || !title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const goalNum = goal.trim() ? parseFloat(goal.replace(',', '.')) : undefined;
      const hasGoalVal = goalNum !== undefined && goalNum > 0;
      const directDef = selected.directWidget
        ? { ...selected.directWidget, title: title.trim(), unit: unit.trim() || selected.defaultUnit, emoji, iconColor, ...(goalNum ? { goal: goalNum, ...(hasGoalVal ? { period: goalPeriod } : {}) } : {}) }
        : null;
      const body = directDef
        ? { prompt: `${selected.label}: ${title}`, direct: directDef }
        : { prompt: `${selected.label}: ${title.trim()}`, answers: { question: title.trim(), unit: unit.trim(), goal: goalNum, period: hasGoalVal ? goalPeriod : undefined }, emoji, iconColor };
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
        setError(t('miniapp.dashboard.widget.error'));
      } else {
        onCreated(data.widget);
        play('CELEBRATION');
        setTimeout(onClose, 600);
      }
    } catch {
      setError(t('miniapp.dashboard.widget.error'));
    } finally {
      setCreating(false);
    }
  };

  const color = getIconColor(iconColor);

  // ── Step dots ──────────────────────────────────────────────────────────────
  const StepDots = () => (
    <div className="flex gap-1.5 justify-center mb-5">
      {[0, 1, 2].map(i => (
        <div key={i} className={cn('h-1.5 rounded-full transition-all duration-300',
          i === step ? 'w-6 bg-primary' : i < step ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-muted'
        )} />
      ))}
    </div>
  );

  // ── Step 0: pick what to measure ──────────────────────────────────────────
  if (step === 0) return (
    <BottomSheet open onClose={onClose} className="px-4 pb-6">
      <StepDots />
      <h3 className="text-[19px] font-bold mb-1">{t('miniapp.dashboard.widget.what_to_track')}</h3>
      <p className="text-[13px] text-muted-foreground mb-4">{t('miniapp.dashboard.widget.pick_metric')}</p>
      <div className="grid grid-cols-2 gap-2">
        {MEASURE_OPTIONS_T.map(opt => (
          <button
            key={opt.id}
            onClick={() => handleSelect(opt)}
            className="flex items-center gap-3 rounded-2xl bg-muted/40 border border-border/40 px-3.5 py-3 text-left transition-all active:scale-[0.97] active:bg-muted/70"
          >
            <span className="text-[22px] shrink-0 leading-none">{opt.emoji}</span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-tight">{opt.label}</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{opt.sublabel}</p>
            </div>
          </button>
        ))}
      </div>
    </BottomSheet>
  );

  // ── Step 1: icon builder ──────────────────────────────────────────────────
  if (step === 1 && selected) return (
    <BottomSheet open onClose={onClose} className="pb-6">
      <StepDots />

      {/* Header: circle back btn + centered title */}
      <div className="relative flex items-center justify-center px-4 py-1 mb-3">
        <button
          onClick={() => goTo(0)}
          className="absolute left-4 flex h-8 w-8 items-center justify-center rounded-full bg-muted/70 text-muted-foreground hover:bg-muted transition-colors"
          aria-label="Назад"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="text-center">
          <p className="text-[15px] font-semibold leading-tight">{t('miniapp.dashboard.widget.icon_title')}</p>
          <p className="text-[12px] text-muted-foreground leading-tight">{t('miniapp.dashboard.widget.icon_subtitle')}</p>
        </div>
      </div>

      {/* Big preview */}
      <div className="flex justify-center mb-5 px-4">
        <div className={cn('flex h-20 w-20 items-center justify-center rounded-3xl text-4xl shadow-lg', color.bg)}>
          {emoji}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-3">
        <div className="flex rounded-xl bg-muted/40 p-1 gap-1">
          <button
            onClick={() => setIconTab('color')}
            className={cn(
              'flex-1 rounded-lg py-2 text-[13px] font-medium transition-all',
              iconTab === 'color' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            {t('miniapp.dashboard.widget.color_tab')}
          </button>
          <button
            onClick={() => setIconTab('emoji')}
            className={cn(
              'flex-1 rounded-lg py-2 text-[13px] font-medium transition-all',
              iconTab === 'emoji' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            {t('miniapp.dashboard.widget.emoji_tab')}
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 overflow-y-auto" style={{ maxHeight: '38vh' }}>
        {iconTab === 'color' && (
          <div className="grid grid-cols-9 gap-2 py-1 pb-4">
            {ICON_COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => setIconColor(c.id)}
                className={cn('h-8 w-8 rounded-full transition-all active:scale-90', iconColor === c.id && 'ring-2 ring-offset-2 ring-white/70 scale-110')}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        )}
        {iconTab === 'emoji' && (
          <div className="grid grid-cols-10 gap-1 pb-4">
            {EMOJI_LIBRARY.map(e => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={cn('flex h-9 w-full items-center justify-center rounded-xl text-xl transition-all active:scale-90',
                  emoji === e ? cn(color.bg, 'ring-2 ring-offset-1 ring-white/40') : 'hover:bg-muted/60'
                )}
              >{e}</button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pt-2">
        <Button className="w-full min-h-[48px] rounded-full text-[15px] font-semibold" onClick={() => goTo(2)}>
          {t('miniapp.dashboard.widget.next')}
        </Button>
      </div>
    </BottomSheet>
  );

  // ── Step 2: name / unit / goal ────────────────────────────────────────────
  if (step === 2 && selected) {
    const goalNum = goal.trim() ? parseFloat(goal.replace(',', '.')) : null;
    const hasGoal = goalNum !== null && goalNum > 0;
    const PERIOD_OPTIONS: { key: 'day' | 'week' | 'month'; label: string }[] = [
      { key: 'day',   label: t('miniapp.dashboard.widget.period_day') },
      { key: 'week',  label: t('miniapp.dashboard.widget.period_week') },
      { key: 'month', label: t('miniapp.dashboard.widget.period_month') },
    ];

    return (
      <BottomSheet open onClose={onClose} className="px-4 pb-6">
        <StepDots />
        {/* Back */}
        <div className="relative flex items-center justify-center py-1 mb-4">
          <button
            onClick={() => goTo(1)}
            className="absolute left-0 flex h-8 w-8 items-center justify-center rounded-full bg-muted/70 text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Назад"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* ── Live widget preview ── */}
        <div className="flex justify-center mb-5">
          <div className="w-[160px] rounded-2xl bg-card border border-border/40 p-4 flex flex-col shadow-sm">
            {/* Icon */}
            <div className={cn('mb-3 flex h-10 w-10 items-center justify-center rounded-2xl text-xl shrink-0', color.bg)}>
              {emoji}
            </div>
            {/* Value placeholder */}
            <div className="flex items-baseline gap-1 mb-0.5">
              <span className="text-[28px] font-bold tracking-tight leading-none text-foreground/30">—</span>
              <span className="text-[13px] text-muted-foreground">{unit || selected.defaultUnit}</span>
            </div>
            {/* Title */}
            <p className="text-[13px] font-medium text-foreground/80 mt-0.5 truncate">{title || selected.label}</p>
            {/* Goal bar — only when goal is set */}
            {hasGoal ? (
              <div className="mt-2.5">
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted/60">
                  <div className={cn('h-full rounded-full w-0', color.bg)} />
                </div>
                <p className="mt-1 text-right text-[10px] text-muted-foreground">
                  0% · {t('miniapp.dashboard.widget.goal_label').toLowerCase()} {goalNum} {unit || selected.defaultUnit}
                  {goalPeriod ? ` / ${PERIOD_OPTIONS.find(p => p.key === goalPeriod)?.label.toLowerCase()}` : ''}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground/50">{t('miniapp.dashboard.widget.no_data')}</p>
            )}
          </div>
        </div>

        {/* Name */}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('miniapp.dashboard.widget.name_label')}</p>
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t('miniapp.dashboard.widget.name_placeholder')}
          className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-[15px] font-medium focus:outline-none focus:ring-1 focus:ring-ring mb-3"
        />

        {/* Unit + Goal side by side */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('miniapp.dashboard.widget.unit_label')}</p>
            <input
              type="text"
              value={unit}
              onChange={e => setUnit(e.target.value)}
              placeholder={selected.defaultUnit || 'ml, kg...'}
              className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-[15px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              {t('miniapp.dashboard.widget.goal_label')} <span className="normal-case font-normal opacity-50">{t('miniapp.dashboard.widget.goal_optional')}</span>
            </p>
            <input
              type="number"
              inputMode="decimal"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder={selected.id === 'water' ? '2000' : selected.id === 'steps' ? '10000' : '100'}
              className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-[15px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Goal period — only shown when goal is entered */}
        {hasGoal && (
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('miniapp.dashboard.widget.goal_period_label')}</p>
            <div className="flex gap-2">
              {PERIOD_OPTIONS.map(p => (
                <button
                  key={p.key}
                  onClick={() => setGoalPeriod(p.key)}
                  className={cn(
                    'flex-1 rounded-xl border py-2.5 text-[13px] font-medium transition-all',
                    goalPeriod === p.key
                      ? cn(color.bg, color.text, 'border-transparent')
                      : 'bg-muted/30 border-border/40 text-muted-foreground'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground/60">
              Ціль з&apos;явиться на сторінці Цілі. Трекінг-віджет залишиться на Віджетах.
            </p>
          </div>
        )}

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
              {selected.directWidget ? t('miniapp.dashboard.widget.creating_btn') : t('miniapp.dashboard.widget.creating_ai_btn')}
            </span>
          ) : hasGoal ? t('miniapp.dashboard.widget.create_with_goal') : t('miniapp.dashboard.widget.create_simple')}
        </Button>
      </BottomSheet>
    );
  }

  return null;
}
