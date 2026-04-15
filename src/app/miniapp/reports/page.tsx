'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { BarChart2, ChevronDown, RefreshCw, Trash2 } from 'lucide-react';
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

// ── Delete confirm sheet ──────────────────────────────────────────────────────

function DeleteSheet({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full rounded-t-2xl bg-[var(--tgui--bg_color)] px-4 pt-4 pb-8 shadow-2xl">
        <div className="mb-4 flex justify-center"><div className="h-1 w-10 rounded-full bg-[var(--tgui--secondary_bg_color)]" /></div>
        <h3 className="mb-1 text-base font-semibold">Видалити звіт?</h3>
        <p className="mb-5 text-sm text-[var(--tgui--hint_color)]">Це незворотньо.</p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-full" onClick={onCancel}>Скасувати</Button>
          <Button variant="destructive" className="flex-1 rounded-full" onClick={onConfirm}>Видалити</Button>
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
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--tgui--link_color)]/10">
            <BarChart2 size={18} className="text-[var(--tgui--link_color)]" />
          </div>
          <button onClick={() => setExpanded(v => !v)} className="flex-1 min-w-0 text-left">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{PERIOD_LABELS[report.period_type] ?? 'Звіт'}</p>
              <span className="text-[10px] text-[var(--tgui--hint_color)]">{from} — {to}</span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--tgui--hint_color)] line-clamp-2">{report.summary}</p>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--tgui--hint_color)]"
            >
              <ChevronDown size={15} className={cn('transition-transform', expanded && 'rotate-180')} />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--tgui--hint_color)] hover:text-destructive"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {expanded && report.insights.length > 0 && (
          <div className="border-t px-4 pb-4 pt-3">
            <div className="flex flex-col gap-2">
              {report.insights.map((ins, i) => (
                <div key={i} className={cn('flex items-start gap-2 rounded-xl border px-3 py-2 text-xs', INSIGHT_COLORS[ins.type] ?? 'bg-[var(--tgui--secondary_bg_color)]')}>
                  <span className="shrink-0 text-base leading-none">{ins.emoji}</span>
                  <p className="leading-relaxed">{ins.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {confirmDelete && (
        <DeleteSheet
          onConfirm={() => { setConfirmDelete(false); onDelete(); }}
          onCancel={() => setConfirmDelete(false)}
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
  const [genPeriod, setGenPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

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

  const generateReport = async () => {
    if (!accessToken || generating) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ period_type: genPeriod }),
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
    <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
      <h1 className="text-lg font-semibold">Звіти</h1>

      {/* Generate */}
      <Card className="p-4">
        <p className="mb-3 text-sm font-medium">Згенерувати звіт</p>
        <div className="mb-3 flex gap-2">
          {(['daily', 'weekly', 'monthly'] as const).map(p => (
            <button key={p} onClick={() => setGenPeriod(p)}
              className={cn('flex-1 rounded-full py-2 text-xs font-medium transition-colors',
                genPeriod === p
                  ? 'bg-[var(--tgui--button_color)] text-white'
                  : 'bg-[var(--tgui--secondary_bg_color)] text-[var(--tgui--hint_color)]')}>
              {p === 'daily' ? 'День' : p === 'weekly' ? 'Тиждень' : 'Місяць'}
            </button>
          ))}
        </div>
        <Button className="w-full rounded-full gap-2" onClick={generateReport} disabled={generating}>
          {generating
            ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            : <RefreshCw size={15} />}
          {generating ? 'Аналізую...' : 'Згенерувати'}
        </Button>
        <p className="mt-2 text-center text-[10px] text-[var(--tgui--hint_color)]">
          Або напиши боту: /report weekly
        </p>
      </Card>

      {/* List */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        </div>
      )}
      {!loading && reports.length === 0 && (
        <p className="py-8 text-center text-sm text-[var(--tgui--hint_color)]">
          Звітів ще немає. Згенеруй перший або напиши боту /report
        </p>
      )}
      <div className="flex flex-col gap-2">
        {reports.map(r => (
          <ReportCard key={r.id} report={r} onDelete={() => deleteReport(r.id)} />
        ))}
      </div>
    </div>
  );
}
