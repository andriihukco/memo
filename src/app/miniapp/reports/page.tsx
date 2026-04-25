'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReportInsight } from '@/lib/bot/retrospective';
import { useSound } from '@/lib/sound/use-sound';
import { SkeletonReportCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PaywallModal } from '@/components/ui/paywall-modal';
import { UsageCounterChip } from '@/components/ui/usage-counter-chip';
import { useUsageCounts } from '@/lib/hooks/use-usage-counts';
import type { SubscriptionTier } from '@/lib/stars/paywall';

interface ReportSummary {
  id: string;
  period_type: string;
  period_from: string;
  period_to: string;
  summary: string;
  went_well?: string;
  didnt_go_well?: string;
  start_stop_continue?: string;
  experiment?: string;
  lesson?: string;
  insights: ReportInsight[];
  created_at: string;
}

// ── Retro section config ──────────────────────────────────────────────────────

const RETRO_SECTIONS = [
  {
    key: 'went_well' as const,
    emoji: '✅',
    label: 'Що пройшло добре',
    sublabel: 'Успіхи, які варто повторювати',
    color: 'border-l-emerald-400 bg-emerald-50/50',
    labelColor: 'text-emerald-700',
  },
  {
    key: 'didnt_go_well' as const,
    emoji: '❌',
    label: 'Що не вийшло',
    sublabel: 'Затики та проблеми',
    color: 'border-l-rose-400 bg-rose-50/50',
    labelColor: 'text-rose-700',
  },
  {
    key: 'start_stop_continue' as const,
    emoji: '🔄',
    label: 'Почати / Зупинити / Продовжити',
    sublabel: 'Конкретні дії на наступний спринт',
    color: 'border-l-blue-400 bg-blue-50/50',
    labelColor: 'text-blue-700',
  },
  {
    key: 'experiment' as const,
    emoji: '🧪',
    label: 'Експеримент',
    sublabel: 'Гіпотеза для наступного спринту',
    color: 'border-l-violet-400 bg-violet-50/50',
    labelColor: 'text-violet-700',
  },
  {
    key: 'lesson' as const,
    emoji: '💡',
    label: 'Урок',
    sublabel: 'Найважливіший інсайт цього періоду',
    color: 'border-l-amber-400 bg-amber-50/50',
    labelColor: 'text-amber-700',
  },
] as const;

// iOS-style section label map (Caption, uppercase, tracking-wide)
const RETRO_SECTION_LABELS: Record<string, string> = {
  went_well:           'Що пройшло добре',
  didnt_go_well:       'Що не вийшло',
  start_stop_continue: 'Почати / Зупинити / Продовжити',
  experiment:          'Експеримент',
  lesson:              'Урок',
};

const INSIGHT_COLORS: Record<string, string> = {
  went_well:           'bg-emerald-50 border-emerald-200 text-emerald-800',
  didnt_go_well:       'bg-rose-50 border-rose-200 text-rose-800',
  start_stop_continue: 'bg-blue-50 border-blue-200 text-blue-800',
  experiment:          'bg-violet-50 border-violet-200 text-violet-800',
  lesson:              'bg-amber-50 border-amber-200 text-amber-800',
  // legacy fallbacks
  celebration: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  strength:    'bg-blue-50 border-blue-200 text-blue-800',
  pattern:     'bg-amber-50 border-amber-200 text-amber-800',
  concern:     'bg-rose-50 border-rose-200 text-rose-800',
  action:      'bg-violet-50 border-violet-200 text-violet-800',
};

const PERIOD_LABELS: Record<string, string> = {
  daily: 'Сьогодні', weekly: '7 днів', monthly: 'Місяць', custom: 'Звіт',
};

// ── Rotating progress labels ──────────────────────────────────────────────────

const PROGRESS_LABELS = [
  'Збираю записи...',
  'Аналізую патерни...',
  'Оцінюю прогрес...',
  'Шукаю інсайти...',
  'Формую ретроспективу...',
  'Майже готово...',
];

function useProgressLabel(active: boolean) {
  const [idx, setIdx] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (active) {
      setIdx(0);
      timer.current = setInterval(() => setIdx(i => (i + 1) % PROGRESS_LABELS.length), 1800);
    } else {
      if (timer.current) clearInterval(timer.current);
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [active]);
  return PROGRESS_LABELS[idx];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfDay(d: Date) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function endOfDay(d: Date)   { const r = new Date(d); r.setHours(23,59,59,999); return r; }
function isoDate(d: Date)    { return d.toISOString().slice(0,10); }

/** Group reports by month label (uk-UA locale), sorted newest-first */
function groupReportsByMonth(reports: ReportSummary[]): Array<{ label: string; reports: ReportSummary[] }> {
  const map: Record<string, ReportSummary[]> = {};
  const sorted = [...reports].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  for (const r of sorted) {
    const raw = new Date(r.created_at).toLocaleDateString('uk-UA', {
      month: 'long',
      year: 'numeric',
    });
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    (map[label] ??= []).push(r);
  }
  // Preserve insertion order (already newest-first due to sorted input)
  return Object.entries(map).map(([label, reports]) => ({ label, reports }));
}

// ── New Report Sheet ──────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { type: 'daily',   label: 'Сьогодні',      icon: 'today',          fn: () => { const n = new Date(); return { from: startOfDay(n), to: endOfDay(n) }; } },
  { type: 'weekly',  label: '7 днів',         icon: 'date_range',     fn: () => { const n = new Date(); const f = new Date(n); f.setDate(n.getDate()-6); return { from: startOfDay(f), to: endOfDay(n) }; } },
  { type: 'monthly', label: 'Місяць',         icon: 'calendar_month', fn: () => { const n = new Date(); const f = new Date(n); f.setDate(1); return { from: startOfDay(f), to: endOfDay(n) }; } },
  { type: 'custom',  label: 'Свій діапазон',  icon: 'tune',           fn: null },
] as const;

function NewReportSheet({ open, onClose, onGenerate }: {
  open: boolean;
  onClose: () => void;
  onGenerate: (periodType: string, from?: Date, to?: Date) => void;
}) {
  const [fromStr, setFromStr] = useState(isoDate(startOfDay(new Date())));
  const [toStr, setToStr] = useState(isoDate(new Date()));
  const [selected, setSelected] = useState<{ type: string; from: Date; to: Date } | null>(null);

  // Whether the custom date range section is expanded
  const customExpanded = selected?.type === 'custom';

  const handleSelectPreset = (opt: typeof PERIOD_OPTIONS[number]) => {
    if (opt.fn) {
      const r = opt.fn();
      setSelected({ type: opt.type, from: r.from, to: r.to });
    } else {
      // Custom — expand inline, mark selected with current date inputs
      const from = startOfDay(new Date(fromStr));
      const to = endOfDay(new Date(toStr));
      const valid = !isNaN(from.getTime()) && !isNaN(to.getTime()) && from <= to;
      setSelected(valid ? { type: 'custom', from, to } : { type: 'custom', from: startOfDay(new Date()), to: endOfDay(new Date()) });
    }
  };

  // Keep custom selection in sync when date inputs change
  const handleFromChange = (val: string) => {
    setFromStr(val);
    if (selected?.type === 'custom') {
      const from = startOfDay(new Date(val));
      const to = endOfDay(new Date(toStr));
      if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && from <= to) {
        setSelected({ type: 'custom', from, to });
      }
    }
  };

  const handleToChange = (val: string) => {
    setToStr(val);
    if (selected?.type === 'custom') {
      const from = startOfDay(new Date(fromStr));
      const to = endOfDay(new Date(val));
      if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && from <= to) {
        setSelected({ type: 'custom', from, to });
      }
    }
  };

  const handleGenerate = () => {
    if (!selected) return;
    onGenerate(selected.type, selected.from, selected.to);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <h3 className="text-[17px] font-semibold">Нова ретроспектива</h3>
        <p className="text-[13px] text-muted-foreground">Оберіть період для аналізу</p>
      </div>

      {/* Period option rows */}
      <div className="px-4">
        {PERIOD_OPTIONS.map((opt) => {
          const isSelected = selected?.type === opt.type;
          return (
            <button
              key={opt.type}
              onClick={() => handleSelectPreset(opt)}
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

      {/* Inline date-range expansion */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          customExpanded ? 'max-h-40' : 'max-h-0'
        )}
      >
        {/* Hairline divider */}
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
      </div>

      {/* CTA */}
      <div className="px-4 pt-3">
        <Button
          className="w-full min-h-[44px]"
          disabled={!selected}
          onClick={handleGenerate}
        >
          Згенерувати ретроспективу
        </Button>
      </div>
    </BottomSheet>
  );
}

// ── Report card ───────────────────────────────────────────────────────────────

function ReportCard({ report, onDelete }: { report: ReportSummary; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const from = new Date(report.period_from).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  const to   = new Date(report.period_to).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });

  // Check if we have structured retro sections
  const hasRetroSections = !!(
    report.went_well ||
    report.didnt_go_well ||
    report.start_stop_continue ||
    report.experiment ||
    report.lesson
  );

  // Retro sections that have content
  const filledSections = RETRO_SECTIONS.filter(s => !!report[s.key]);

  return (
    <>
      <div className={cn('bg-surface-elevated rounded-2xl border border-border/50 px-4 py-3.5 flex flex-col gap-0 transition-all duration-200', deleting ? 'opacity-0 -translate-x-5' : 'opacity-100')}>
        {/* Collapsed header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-semibold">
                {PERIOD_LABELS[report.period_type] ?? 'Ретроспектива'}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {from} — {to}
              </span>
            </div>
            <p className="mt-1 text-[15px] text-muted-foreground line-clamp-2 leading-snug">
              {report.summary}
            </p>
          </div>

          {/* Action buttons — 44×44 tap areas */}
          <div className="flex items-center gap-0 shrink-0 -mr-2">
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Видалити ретроспективу"
            >
              <Icon name="delete" size={18} />
            </button>
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-muted-foreground transition-colors"
              aria-label={expanded ? 'Згорнути' : 'Розгорнути'}
              aria-expanded={expanded}
            >
              <Icon
                name="expand_more"
                size={20}
                className={cn('transition-transform duration-200', expanded && 'rotate-180')}
              />
            </button>
          </div>
        </div>

        {/* Expanded: retro sections */}
        {expanded && (
          <div className="mt-2 flex flex-col">
            {/* Hairline divider */}
            <div className="h-px bg-border/30 mb-0" />

            {hasRetroSections ? (
              filledSections.map((s, idx) => {
                const text = report[s.key];
                if (!text) return null;
                const isLast = idx === filledSections.length - 1;
                return (
                  <div key={s.key}>
                    {/* iOS_Section_Header label */}
                    <p className="text-[13px] uppercase tracking-wide text-muted-foreground pt-3 pb-1">
                      {RETRO_SECTION_LABELS[s.key]}
                    </p>
                    {/* Section body */}
                    <p className="text-[15px] text-foreground leading-relaxed whitespace-pre-line pb-2">
                      {text}
                    </p>
                    {/* Hairline divider between sections (not after last) */}
                    {!isLast && <div className="h-px bg-border/30" />}
                  </div>
                );
              })
            ) : (
              /* Legacy insights fallback */
              <div className="pt-3 flex flex-col gap-2">
                {report.insights.map((ins, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-2 rounded-xl border px-3 py-2 text-xs',
                      INSIGHT_COLORS[ins.type] ?? 'bg-muted'
                    )}
                  >
                    <span className="shrink-0 text-base leading-none">{ins.emoji}</span>
                    <p className="leading-relaxed">{ins.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmSheet
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => { setConfirmDelete(false); setDeleting(true); setTimeout(() => onDelete(), 200); }}
          title="Видалити ретроспективу?"
          subtitle="Цю дію не можна скасувати."
          confirmLabel="Видалити"
        />
      )}
    </>
  );
}

// ── Reports page ──────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { accessToken } = useAuth();
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [showNewReport, setShowNewReport] = useState(false);
  const lastGenParams = useRef<{ periodType: string; from?: Date; to?: Date } | null>(null);
  const progressLabel = useProgressLabel(generating);
  const { play } = useSound();

  // ── Paywall state ──────────────────────────────────────────────────────────
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallProps, setPaywallProps] = useState<{
    feature: string;
    current?: number;
    limit?: number;
    requiredTier: SubscriptionTier;
  }>({ feature: 'ai_reports', requiredTier: 'stars_basic' });

  // ── User tier ──────────────────────────────────────────────────────────────
  const [userTier, setUserTier] = useState<SubscriptionTier | null>(null);

  const fetchUserTier = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return;
      const { profile } = await res.json();
      setUserTier((profile?.subscription_tier as SubscriptionTier) ?? 'free');
    } catch { /* non-critical */ }
  }, [accessToken]);

  // ── Usage counts ───────────────────────────────────────────────────────────
  const { counts } = useUsageCounts(accessToken);

  const loadReports = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/reports', { headers: { Authorization: `Bearer ${accessToken}` } });
      const d = await res.json();
      setReports(d.reports ?? []);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { loadReports(); fetchUserTier(); }, [loadReports, fetchUserTier]);

  const generateReport = async (periodType: string, from?: Date, to?: Date) => {
    if (!accessToken || generating) return;
    lastGenParams.current = { periodType, from, to };
    setGenerating(true);
    play('PROCESSING');
    setGenError(null);
    try {
      const body: Record<string, unknown> = { period_type: periodType };
      if (from) body.from = from.toISOString();
      if (to) body.to = to.toISOString();
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 402) {
        // Limit exceeded — open paywall instead of error banner
        setPaywallProps({
          feature: data.feature ?? 'reports',
          current: data.current,
          limit: data.limit,
          requiredTier: (data.required_tier as SubscriptionTier) ?? 'stars_basic',
        });
        setPaywallOpen(true);
        play('CAUTION');
      } else if (!res.ok) {
        setGenError(data.error ?? `Помилка ${res.status}`);
        play('CAUTION');
      } else {
        await loadReports();
        play('CELEBRATION');
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Невідома помилка');
      play('CAUTION');
    } finally {
      setGenerating(false);
    }
  };

  const deleteReport = async (id: string) => {
    if (!accessToken) return;
    await fetch('/api/reports', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ id }),
    });
    setReports(prev => prev.filter(r => r.id !== id));
  };

  const monthGroups = groupReportsByMonth(reports);

  return (
    <div className="flex flex-col gap-3 px-4 pt-5 pb-6">
      {/* ── iOS Large Title Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight">Інсайти</h1>
          <p className="text-[13px] text-muted-foreground">Ретроспектива та аналіз</p>
          {/* Usage counter chip — shown when usage ≥ 3 (60% of 5) */}
          {userTier === 'free' && counts !== null && counts.reports >= 3 && (
            <div className="mt-2">
              <UsageCounterChip
                label={`${counts.reports} / 5 звітів`}
                onClick={() => {
                  setPaywallProps({
                    feature: 'reports',
                    current: counts.reports,
                    limit: 5,
                    requiredTier: 'stars_basic',
                  });
                  setPaywallOpen(true);
                }}
              />
            </div>
          )}
        </div>
        {/* 40×40 circular + button */}
        <div className="relative shrink-0 mt-1">
          <button
            onClick={() => {
              if (generating) return;
              play('OPEN');
              setShowNewReport(true);
            }}
            disabled={generating}
            className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm disabled:opacity-50 transition-opacity"
            aria-label="Нова ретроспектива"
          >
            {generating
              ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              : <Icon name="add" size={20} />}
          </button>
        </div>
      </div>

      {/* ── Generating indicator (existing rotating labels) ── */}
      {generating && (
        <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-3">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          <p className="text-sm text-muted-foreground transition-all">{progressLabel}</p>
        </div>
      )}

      {/* ── Error banner ── */}
      {genError && (
        <ErrorBanner
          message={genError}
          onRetry={() => {
            if (lastGenParams.current) {
              const { periodType, from, to } = lastGenParams.current;
              generateReport(periodType, from, to);
            }
          }}
          onDismiss={() => setGenError(null)}
        />
      )}

      {/* ── Loading: SkeletonReportCard × 2 ── */}
      {loading && (
        <div className="flex flex-col gap-2" role="status" aria-label="Завантаження...">
          <SkeletonReportCard />
          <SkeletonReportCard />
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && reports.length === 0 && !generating && (
        <EmptyState
          icon="💡"
          title="Ще немає ретроспектив"
          subtitle="Проаналізуй свій прогрес за будь-який період"
          ctaLabel="Створити першу ретроспективу"
          onCta={() => { play('OPEN'); setShowNewReport(true); }}
        />
      )}

      {/* ── Month-grouped report cards ── */}
      {!loading && monthGroups.length > 0 && (
        <div className="flex flex-col gap-4">
          {monthGroups.map(({ label, reports: groupReports }) => (
            <div key={label} className="flex flex-col gap-2">
              {/* iOS_Section_Header */}
              <p className="text-[13px] uppercase tracking-wide text-muted-foreground px-1">
                {label}
              </p>
              {/* Report cards */}
              {groupReports.map(r => (
                <ReportCard
                  key={r.id}
                  report={r}
                  onDelete={() => deleteReport(r.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── New Report Sheet ── */}
      <NewReportSheet
        open={showNewReport}
        onClose={() => { play('CLOSE'); setShowNewReport(false); }}
        onGenerate={(type, from, to) => generateReport(type, from, to)}
      />

      {/* ── Paywall Modal ── */}
      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        {...paywallProps}
      />
    </div>
  );
}
