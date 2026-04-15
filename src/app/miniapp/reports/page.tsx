'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { FileText, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReportInsight } from '@/lib/bot/retrospective';

interface ReportSummary {
  id: string;
  period_type: string;
  period_from: string;
  period_to: string;
  summary: string;
  insights: ReportInsight[];
  created_at: string;
}

const INSIGHT_COLORS: Record<string, string> = {
  celebration: 'bg-green-50 border-green-200 text-green-800',
  strength:    'bg-blue-50 border-blue-200 text-blue-800',
  pattern:     'bg-amber-50 border-amber-200 text-amber-800',
  concern:     'bg-rose-50 border-rose-200 text-rose-800',
  action:      'bg-violet-50 border-violet-200 text-violet-800',
};

const PERIOD_LABELS: Record<string, string> = {
  daily: 'Щоденний', weekly: 'Тижневий', monthly: 'Місячний', custom: 'Звіт',
};

// Rotating progress labels shown while generating
const PROGRESS_LABELS = [
  'Збираю записи...',
  'Аналізую патерни...',
  'Оцінюю прогрес...',
  'Шукаю інсайти...',
  'Формую висновки...',
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

// ── New Report Drawer ─────────────────────────────────────────────────────────

function NewReportDrawer({ onClose, onGenerate }: {
  onClose: () => void;
  onGenerate: (periodType: string, from?: Date, to?: Date) => void;
}) {
  const [fromStr, setFromStr] = useState(isoDate(startOfDay(new Date())));
  const [toStr, setToStr] = useState(isoDate(new Date()));
  const [showCustom, setShowCustom] = useState(false);
  const [selected, setSelected] = useState<{ type: string; from: Date; to: Date } | null>(null);

  const presets = [
    { label: 'Сьогодні', type: 'daily', fn: () => { const n = new Date(); return { from: startOfDay(n), to: endOfDay(n) }; } },
    { label: '7 днів', type: 'weekly', fn: () => { const n = new Date(); const f = new Date(n); f.setDate(n.getDate()-6); return { from: startOfDay(f), to: endOfDay(n) }; } },
    { label: 'Місяць', type: 'monthly', fn: () => { const n = new Date(); const f = new Date(n); f.setDate(1); return { from: startOfDay(f), to: endOfDay(n) }; } },
  ];

  const selectCustom = () => {
    const from = startOfDay(new Date(fromStr)), to = endOfDay(new Date(toStr));
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return;
    setSelected({ type: 'custom', from, to });
  };

  const generate = () => {
    if (!selected) return;
    onGenerate(selected.type, selected.from, selected.to);
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
        <h3 className="mb-4 text-sm font-semibold">Новий звіт</h3>

        {/* Presets */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          {presets.map(p => {
            const isSelected = selected?.type === p.type;
            return (
              <button
                key={p.type}
                onClick={() => { const r = p.fn(); setSelected({ type: p.type, from: r.from, to: r.to }); setShowCustom(false); }}
                className={cn(
                  'rounded-xl border py-3 text-sm font-medium transition-colors',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-muted/30 hover:bg-muted active:bg-muted/70'
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Custom range toggle */}
        <button
          onClick={() => setShowCustom(v => !v)}
          className="mb-3 flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/30"
        >
          <span>Свій діапазон</span>
          <ChevronDown size={15} className={cn('transition-transform', showCustom && 'rotate-180')} />
        </button>

        {showCustom && (
          <div className="mb-3">
            <div className="mb-3 flex items-center gap-2">
              <input type="date" value={fromStr} onChange={e => setFromStr(e.target.value)}
                className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              <span className="text-muted-foreground">–</span>
              <input type="date" value={toStr} onChange={e => setToStr(e.target.value)}
                className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <Button variant="outline" className="w-full" onClick={selectCustom}>Обрати діапазон</Button>
          </div>
        )}

        {/* Single generate button */}
        <Button className="w-full" disabled={!selected} onClick={generate}>Згенерувати</Button>
      </div>
    </div>
  );
}

// ── Delete confirm sheet ──────────────────────────────────────────────────────

function DeleteSheet({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full rounded-t-2xl bg-background px-4 pt-4 pb-8 shadow-2xl">
        <div className="mb-4 flex justify-center"><div className="h-1 w-10 rounded-full bg-muted" /></div>
        <h3 className="mb-1 text-base font-semibold">Видалити звіт?</h3>
        <p className="mb-5 text-sm text-muted-foreground">Це незворотньо.</p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Скасувати</Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm}>Видалити</Button>
        </div>
      </div>
    </div>
  );
}

// ── Report card ───────────────────────────────────────────────────────────────

function ReportCard({ report, onDelete }: { report: ReportSummary; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const from = new Date(report.period_from).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  const to   = new Date(report.period_to).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <FileText size={18} className="text-primary" />
          </div>
          <button onClick={() => setExpanded(v => !v)} className="flex-1 min-w-0 text-left">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{PERIOD_LABELS[report.period_type] ?? 'Звіт'}</p>
              <span className="text-[10px] text-muted-foreground">{from} — {to}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{report.summary}</p>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setExpanded(v => !v)} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground">
              <ChevronDown size={15} className={cn('transition-transform', expanded && 'rotate-180')} />
            </button>
            <button onClick={() => setConfirmDelete(true)} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {expanded && report.insights.length > 0 && (
          <div className="border-t px-4 pb-4 pt-3">
            <div className="flex flex-col gap-2">
              {report.insights.map((ins, i) => (
                <div key={i} className={cn('flex items-start gap-2 rounded-xl border px-3 py-2 text-xs', INSIGHT_COLORS[ins.type] ?? 'bg-muted')}>
                  <span className="shrink-0 text-base leading-none">{ins.emoji}</span>
                  <p className="leading-relaxed">{ins.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {confirmDelete && (
        <DeleteSheet onConfirm={() => { setConfirmDelete(false); onDelete(); }} onCancel={() => setConfirmDelete(false)} />
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
  const [showNewDrawer, setShowNewDrawer] = useState(false);
  const progressLabel = useProgressLabel(generating);

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

  useEffect(() => { loadReports(); }, [loadReports]);

  const generateReport = async (periodType: string, from?: Date, to?: Date) => {
    if (!accessToken || generating) return;
    setGenerating(true);
    try {
      const body: Record<string, unknown> = { period_type: periodType };
      if (from) body.from = from.toISOString();
      if (to) body.to = to.toISOString();
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      if (res.ok) await loadReports();
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

  return (
    <div className="flex flex-col gap-3 px-4 pt-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Звіти</h1>
        <button
          onClick={() => !generating && setShowNewDrawer(true)}
          disabled={generating}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm disabled:opacity-50 transition-opacity"
          aria-label="Новий звіт"
        >
          {generating
            ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            : <Plus size={18} />}
        </button>
      </div>

      {/* Generating indicator */}
      {generating && (
        <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-3">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          <p className="text-sm text-muted-foreground transition-all">{progressLabel}</p>
        </div>
      )}

      {/* List */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        </div>
      )}
      {!loading && reports.length === 0 && !generating && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText size={32} className="mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Звітів ще немає</p>
          <p className="mt-1 text-xs text-muted-foreground">Натисни + щоб згенерувати перший</p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {reports.map(r => (
          <ReportCard key={r.id} report={r} onDelete={() => deleteReport(r.id)} />
        ))}
      </div>

      {/* New report drawer */}
      {showNewDrawer && (
        <NewReportDrawer
          onClose={() => setShowNewDrawer(false)}
          onGenerate={(type, from, to) => generateReport(type, from, to)}
        />
      )}
    </div>
  );
}
