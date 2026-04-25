'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { useUsageCounts } from '@/lib/hooks/use-usage-counts';
import { TIER_INFO, type SubscriptionTier } from '@/lib/stars/paywall';

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
  { key: 'went_well' as const,           emoji: '✅', label: 'Що пройшло добре',                  color: 'border-emerald-400/40 bg-emerald-400/5',  labelColor: 'text-emerald-400' },
  { key: 'didnt_go_well' as const,       emoji: '❌', label: 'Що не вийшло',                       color: 'border-rose-400/40 bg-rose-400/5',         labelColor: 'text-rose-400' },
  { key: 'start_stop_continue' as const, emoji: '🔄', label: 'Почати / Зупинити / Продовжити',     color: 'border-blue-400/40 bg-blue-400/5',         labelColor: 'text-blue-400' },
  { key: 'experiment' as const,          emoji: '🧪', label: 'Експеримент',                        color: 'border-violet-400/40 bg-violet-400/5',     labelColor: 'text-violet-400' },
  { key: 'lesson' as const,              emoji: '💡', label: 'Урок',                               color: 'border-amber-400/40 bg-amber-400/5',       labelColor: 'text-amber-400' },
] as const;

const PERIOD_LABELS: Record<string, string> = {
  daily: 'Сьогодні', weekly: '7 днів', monthly: 'Місяць', custom: 'Звіт',
};

// ── Rotating progress labels ──────────────────────────────────────────────────

const PROGRESS_LABELS = [
  'Збираю записи...', 'Аналізую патерни...', 'Оцінюю прогрес...',
  'Шукаю інсайти...', 'Формую ретроспективу...', 'Майже готово...',
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

function groupReportsByMonth(reports: ReportSummary[]): Array<{ label: string; reports: ReportSummary[] }> {
  const map: Record<string, ReportSummary[]> = {};
  const sorted = [...reports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  for (const r of sorted) {
    const raw = new Date(r.created_at).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    (map[label] ??= []).push(r);
  }
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
  open: boolean; onClose: () => void;
  onGenerate: (periodType: string, from?: Date, to?: Date) => void;
}) {
  const [fromStr, setFromStr] = useState(isoDate(startOfDay(new Date())));
  const [toStr, setToStr] = useState(isoDate(new Date()));
  const [selected, setSelected] = useState<{ type: string; from: Date; to: Date } | null>(null);
  const customExpanded = selected?.type === 'custom';

  const handleSelectPreset = (opt: typeof PERIOD_OPTIONS[number]) => {
    if (opt.fn) {
      const r = opt.fn();
      setSelected({ type: opt.type, from: r.from, to: r.to });
    } else {
      const from = startOfDay(new Date(fromStr)), to = endOfDay(new Date(toStr));
      const valid = !isNaN(from.getTime()) && !isNaN(to.getTime()) && from <= to;
      setSelected(valid ? { type: 'custom', from, to } : { type: 'custom', from: startOfDay(new Date()), to: endOfDay(new Date()) });
    }
  };

  const handleFromChange = (val: string) => {
    setFromStr(val);
    if (selected?.type === 'custom') {
      const from = startOfDay(new Date(val)), to = endOfDay(new Date(toStr));
      if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && from <= to) setSelected({ type: 'custom', from, to });
    }
  };

  const handleToChange = (val: string) => {
    setToStr(val);
    if (selected?.type === 'custom') {
      const from = startOfDay(new Date(fromStr)), to = endOfDay(new Date(val));
      if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && from <= to) setSelected({ type: 'custom', from, to });
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-4 pt-3 pb-2">
        <h3 className="text-[17px] font-semibold">Нова ретроспектива</h3>
        <p className="text-[13px] text-muted-foreground">Оберіть період для аналізу</p>
      </div>
      <div className="px-4">
        {PERIOD_OPTIONS.map((opt) => {
          const isSelected = selected?.type === opt.type;
          return (
            <button key={opt.type} onClick={() => handleSelectPreset(opt)} className="min-h-[44px] flex items-center gap-3 px-0 w-full">
              <Icon name={opt.icon} size={20} className="text-primary/60 shrink-0" />
              <span className="flex-1 text-left text-[15px]">{opt.label}</span>
              {isSelected ? <Icon name="check" size={18} className="text-primary shrink-0" /> : <Icon name="chevron_right" size={18} className="text-muted-foreground shrink-0" />}
            </button>
          );
        })}
      </div>
      <div className={cn('overflow-hidden transition-all duration-300', customExpanded ? 'max-h-40' : 'max-h-0')}>
        <div className="mx-4 h-px bg-border/40" />
        <div className="px-4 pt-3 pb-1 flex items-center gap-2">
          <input type="date" value={fromStr} onChange={e => handleFromChange(e.target.value)} className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          <span className="text-muted-foreground">–</span>
          <input type="date" value={toStr} onChange={e => handleToChange(e.target.value)} className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>
      <div className="px-4 pt-3 pb-2">
        <Button className="w-full min-h-[44px]" disabled={!selected} onClick={() => { if (selected) { onGenerate(selected.type, selected.from, selected.to); onClose(); } }}>
          Згенерувати ретроспективу
        </Button>
      </div>
    </BottomSheet>
  );
}

// ── Report Detail View ────────────────────────────────────────────────────────

function ReportDetail({ report, onClose, onDelete }: {
  report: ReportSummary;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { play } = useSound();

  const from = new Date(report.period_from).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
  const to   = new Date(report.period_to).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });

  const hasRetroSections = !!(report.went_well || report.didnt_go_well || report.start_stop_continue || report.experiment || report.lesson);
  const filledSections = RETRO_SECTIONS.filter(s => !!report[s.key]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" style={{ paddingBottom: 'calc(var(--tab-bar-h, 84px) + var(--bottom-inset, 0px))' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-border/30">
        <button onClick={() => { play('SLIDE'); onClose(); }} className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-muted/60 text-muted-foreground shrink-0">
          <Icon name="arrow_back" size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-semibold truncate">{PERIOD_LABELS[report.period_type] ?? 'Ретроспектива'}</p>
          <p className="text-[13px] text-muted-foreground">{from} — {to}</p>
        </div>
        <button onClick={() => setConfirmDelete(true)} className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-muted-foreground hover:text-destructive transition-colors shrink-0">
          <Icon name="delete" size={18} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {/* Summary */}
        <div className="rounded-2xl bg-muted/30 border border-border/30 px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Підсумок</p>
          <p className="text-[15px] leading-relaxed text-foreground">{report.summary}</p>
        </div>

        {/* Retro sections */}
        {hasRetroSections ? (
          filledSections.map(s => {
            const text = report[s.key];
            if (!text) return null;
            return (
              <div key={s.key} className={cn('rounded-2xl border px-4 py-3.5', s.color)}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg leading-none">{s.emoji}</span>
                  <p className={cn('text-[13px] font-semibold uppercase tracking-wide', s.labelColor)}>{s.label}</p>
                </div>
                <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-line">{text}</p>
              </div>
            );
          })
        ) : (
          /* Legacy insights */
          <div className="flex flex-col gap-2">
            {report.insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-3 rounded-2xl border border-border/30 bg-muted/20 px-4 py-3">
                <span className="text-xl leading-none shrink-0">{ins.emoji}</span>
                <p className="text-[14px] leading-relaxed">{ins.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); onDelete(); onClose(); }}
        title="Видалити ретроспективу?"
        subtitle="Цю дію не можна скасувати."
        confirmLabel="Видалити"
      />
    </div>
  );
}

// ── Report list row ───────────────────────────────────────────────────────────

function ReportRow({ report, onTap, onDelete }: {
  report: ReportSummary;
  onTap: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { play } = useSound();

  const from = new Date(report.period_from).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  const to   = new Date(report.period_to).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  const filledCount = RETRO_SECTIONS.filter(s => !!report[s.key]).length;

  return (
    <>
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer active:bg-muted/30 transition-colors"
        onClick={() => { play('OPEN'); onTap(); }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[15px] font-semibold">{PERIOD_LABELS[report.period_type] ?? 'Ретроспектива'}</span>
            <span className="text-[12px] text-muted-foreground">{from} — {to}</span>
          </div>
          <p className="text-[13px] text-muted-foreground line-clamp-1 leading-snug">{report.summary}</p>
          {filledCount > 0 && (
            <div className="flex gap-1 mt-1.5">
              {RETRO_SECTIONS.filter(s => !!report[s.key]).map(s => (
                <span key={s.key} className="text-[13px] leading-none">{s.emoji}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
            className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-muted-foreground hover:text-destructive transition-colors"
          >
            <Icon name="delete" size={16} />
          </button>
          <Icon name="chevron_right" size={16} className="text-muted-foreground/50" />
        </div>
      </div>
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); onDelete(); }}
        title="Видалити ретроспективу?"
        subtitle="Цю дію не можна скасувати."
        confirmLabel="Видалити"
      />
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
  const [selectedReport, setSelectedReport] = useState<ReportSummary | null>(null);
  const lastGenParams = useRef<{ periodType: string; from?: Date; to?: Date } | null>(null);
  const progressLabel = useProgressLabel(generating);
  const { play } = useSound();

  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallProps, setPaywallProps] = useState<{ feature: string; current?: number; limit?: number; requiredTier: SubscriptionTier }>({ feature: 'ai_reports', requiredTier: 'stars_basic' });
  const [userTier, setUserTier] = useState<SubscriptionTier | null>(null);
  const { counts } = useUsageCounts(accessToken);

  const fetchUserTier = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return;
      const { profile } = await res.json();
      setUserTier((profile?.subscription_tier as SubscriptionTier) ?? 'free');
    } catch { /* non-critical */ }
  }, [accessToken]);

  const loadReports = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/reports', { headers: { Authorization: `Bearer ${accessToken}` } });
      const d = await res.json();
      setReports(d.reports ?? []);
    } finally { setLoading(false); }
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
        setPaywallProps({ feature: data.feature ?? 'reports', current: data.current, limit: data.limit, requiredTier: (data.required_tier as SubscriptionTier) ?? 'stars_basic' });
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
    } finally { setGenerating(false); }
  };

  const deleteReport = async (id: string) => {
    if (!accessToken) return;
    await fetch('/api/reports', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ id }) });
    setReports(prev => prev.filter(r => r.id !== id));
  };

  // Compute remaining reports
  const tierLimits = userTier ? TIER_INFO[userTier].limits : null;
  const reportsLimit = tierLimits?.reports ?? 5;
  const reportsUsed = counts?.reports ?? 0;
  const _reportsLeft = reportsLimit === Infinity ? null : Math.max(0, reportsLimit - reportsUsed);

  const monthGroups = groupReportsByMonth(reports);

  // If a report is selected, show detail view
  if (selectedReport) {
    return (
      <ReportDetail
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
        onDelete={() => { deleteReport(selectedReport.id); setSelectedReport(null); }}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-3 px-4 pt-5 pb-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight">Інсайти</h1>
          <p className="text-[13px] text-muted-foreground">Ретроспектива та аналіз</p>
        </div>
        <button
          onClick={() => { if (generating) return; play('OPEN'); setShowNewReport(true); }}
          disabled={generating}
          className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm disabled:opacity-50 transition-opacity mt-1 shrink-0"
          aria-label="Нова ретроспектива"
        >
          {generating
            ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            : <Icon name="add" size={20} />}
        </button>
      </div>

      {/* Usage counter removed — visible only on plans/subscriptions page */}

      {/* Generating indicator */}
      <AnimatePresence>
        {generating && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-3"
          >
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
            <p className="text-sm text-muted-foreground">{progressLabel}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error banner */}
      {genError && (
        <ErrorBanner
          message={genError}
          onRetry={() => { if (lastGenParams.current) { const { periodType, from, to } = lastGenParams.current; generateReport(periodType, from, to); } }}
          onDismiss={() => setGenError(null)}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-2" role="status">
          <SkeletonReportCard />
          <SkeletonReportCard />
        </div>
      )}

      {/* Empty state */}
      {!loading && reports.length === 0 && !generating && (
        <EmptyState
          icon="💡"
          title="Ще немає ретроспектив"
          subtitle="Проаналізуй свій прогрес за будь-який період"
          features={[
            { emoji: '✅', text: 'Що пройшло добре цього тижня' },
            { emoji: '❌', text: 'Що не вийшло і чому' },
            { emoji: '🔄', text: 'Почати / Зупинити / Продовжити' },
            { emoji: '🧪', text: 'Гіпотеза для наступного спринту' },
            { emoji: '💡', text: 'Найважливіший урок періоду' },
          ]}
          ctaLabel="Створити першу ретроспективу"
          onCta={() => { play('OPEN'); setShowNewReport(true); }}
        />
      )}

      {/* Month-grouped report list */}
      {!loading && monthGroups.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-4"
        >
          {monthGroups.map(({ label, reports: groupReports }, groupIdx) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: groupIdx * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-0"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-1">{label}</p>
              <div className="rounded-2xl bg-card/60 border border-border/30 overflow-hidden divide-y divide-border/20">
                {groupReports.map(r => (
                  <ReportRow
                    key={r.id}
                    report={r}
                    onTap={() => setSelectedReport(r)}
                    onDelete={() => deleteReport(r.id)}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <NewReportSheet
        open={showNewReport}
        onClose={() => { play('CLOSE'); setShowNewReport(false); }}
        onGenerate={(type, from, to) => generateReport(type, from, to)}
      />

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} {...paywallProps} />
    </motion.div>
  );
}
