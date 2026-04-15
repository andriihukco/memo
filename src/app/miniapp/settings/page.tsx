'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronRight, Lock, Shield, BarChart2, RefreshCw, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PasscodeScreen, createPinHash } from '@/components/ui/passcode-screen';
import { useAuth } from '@/lib/supabase/auth-context';
import {
  getPasscodeHash, setPasscodeHash, removePasscode,
  getLockTimer, setLockTimer, type LockTimer, LOCK_TIMER_LABELS,
} from '@/lib/passcode';
import { cn } from '@/lib/utils';
import type { ReportInsight } from '@/lib/bot/retrospective';

type SetupStep = 'idle' | 'enter_current' | 'set_new' | 'confirm_new';

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

// ── Report card ───────────────────────────────────────────────────────────────

function ReportCard({ report }: { report: ReportSummary }) {
  const [expanded, setExpanded] = useState(false);
  const from = new Date(report.period_from).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  const to = new Date(report.period_to).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setExpanded(v => !v)} className="flex w-full items-start gap-3 p-4 text-left">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <BarChart2 size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{PERIOD_LABELS[report.period_type] ?? 'Звіт'}</p>
            <span className="text-[10px] text-muted-foreground">{from} — {to}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{report.summary}</p>
        </div>
        <ChevronDown size={16} className={cn('mt-1 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

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
  );
}

// ── Settings page ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { accessToken } = useAuth();
  const [hasPasscode, setHasPasscode] = useState(false);
  const [lockTimer, setLockTimerState] = useState<LockTimer>(0);
  const [step, setStep] = useState<SetupStep>('idle');
  const [pendingPin, setPendingPin] = useState('');
  const [showTimerPicker, setShowTimerPicker] = useState(false);

  // Reports state
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genPeriod, setGenPeriod] = useState<'daily'|'weekly'|'monthly'>('weekly');

  useEffect(() => {
    setHasPasscode(!!getPasscodeHash());
    setLockTimerState(getLockTimer());
  }, []);

  const loadReports = useCallback(async () => {
    if (!accessToken) return;
    setReportsLoading(true);
    try {
      const res = await fetch('/api/reports', { headers: { Authorization: `Bearer ${accessToken}` } });
      const d = await res.json();
      setReports(d.reports ?? []);
    } finally {
      setReportsLoading(false);
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
      if (res.ok) {
        await loadReports();
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleEnablePasscode = () => setStep('set_new');
  const handleChangePasscode = () => { if (hasPasscode) setStep('enter_current'); else setStep('set_new'); };
  const handleDisablePasscode = () => { removePasscode(); setHasPasscode(false); setStep('idle'); };
  const handleTimerChange = (t: LockTimer) => { setLockTimer(t); setLockTimerState(t); setShowTimerPicker(false); };
  const handleCurrentVerified = () => setStep('set_new');
  const handleNewPin = (pin: string) => { setPendingPin(pin); setStep('confirm_new'); };
  const handleConfirmPin = async (pin: string) => {
    if (pin !== pendingPin) { setStep('set_new'); setPendingPin(''); return; }
    const hash = await createPinHash(pin);
    setPasscodeHash(hash);
    setHasPasscode(true);
    setStep('idle');
    setPendingPin('');
  };

  if (step === 'enter_current') {
    return <PasscodeScreen key="enter_current" mode="enter" title="Поточний код" subtitle="Введіть поточний код доступу" expectedHash={getPasscodeHash() ?? undefined} onSuccess={handleCurrentVerified} onCancel={() => setStep('idle')} />;
  }
  if (step === 'set_new') {
    return <PasscodeScreen key="set_new" mode="set" title="Новий код" subtitle="Введіть новий 4-значний код" onSuccess={handleNewPin} onCancel={() => setStep('idle')} />;
  }
  if (step === 'confirm_new') {
    return <PasscodeScreen key="confirm_new" mode="confirm" title="Підтвердіть код" subtitle="Введіть код ще раз" onSuccess={handleConfirmPin} onCancel={() => setStep('idle')} />;
  }

  const TIMERS: LockTimer[] = [0, 1, 5, 15, 60];

  return (
    <div className="flex flex-col gap-6 px-4 pt-5 pb-6">
      <h1 className="text-lg font-semibold">Профіль</h1>

      {/* ── Reports section ─────────────────────────────────────────────── */}
      <section>
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Ретроспективи</p>

        {/* Generate */}
        <Card className="mb-3 p-4">
          <p className="mb-3 text-sm font-medium">Згенерувати звіт</p>
          <div className="mb-3 flex gap-2">
            {(['daily','weekly','monthly'] as const).map(p => (
              <button key={p} onClick={() => setGenPeriod(p)}
                className={cn('flex-1 rounded-full py-2 text-xs font-medium transition-colors',
                  genPeriod === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                {p === 'daily' ? 'День' : p === 'weekly' ? 'Тиждень' : 'Місяць'}
              </button>
            ))}
          </div>
          <Button className="w-full rounded-full gap-2" onClick={generateReport} disabled={generating}>
            {generating ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" /> : <RefreshCw size={15} />}
            {generating ? 'Аналізую...' : 'Згенерувати'}
          </Button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Або напиши боту: /report weekly
          </p>
        </Card>

        {/* Reports list */}
        {reportsLoading && <div className="flex justify-center py-6"><div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground" /></div>}
        {!reportsLoading && reports.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">Звітів ще немає. Згенеруй перший!</p>
        )}
        <div className="flex flex-col gap-2">
          {reports.map(r => <ReportCard key={r.id} report={r} />)}
        </div>
      </section>

      {/* ── Privacy section ─────────────────────────────────────────────── */}
      <section>
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Конфіденційність</p>
        <Card>
          <CardContent className="p-0">
            <button onClick={hasPasscode ? handleChangePasscode : handleEnablePasscode}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Lock size={16} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{hasPasscode ? 'Змінити код' : 'Увімкнути код'}</p>
                <p className="text-xs text-muted-foreground">{hasPasscode ? 'Змінити 4-значний код доступу' : 'Захистити додаток кодом'}</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>

            {hasPasscode && <div className="mx-4 h-px bg-border" />}

            {hasPasscode && (
              <div>
                <button onClick={() => setShowTimerPicker(v => !v)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Shield size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">Блокування</p>
                    <p className="text-xs text-muted-foreground">{LOCK_TIMER_LABELS[lockTimer]}</p>
                  </div>
                  <ChevronRight size={16} className={cn('text-muted-foreground transition-transform', showTimerPicker && 'rotate-90')} />
                </button>
                {showTimerPicker && (
                  <div className="border-t pb-1">
                    {TIMERS.map(t => (
                      <button key={t} onClick={() => handleTimerChange(t)}
                        className="flex w-full items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-muted/50">
                        <span className={cn(t === lockTimer && 'font-medium text-primary')}>{LOCK_TIMER_LABELS[t]}</span>
                        {t === lockTimer && <Check size={16} className="text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {hasPasscode && (
              <>
                <div className="mx-4 h-px bg-border" />
                <button onClick={handleDisablePasscode}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-destructive transition-colors hover:bg-destructive/5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                    <Lock size={16} className="text-destructive" />
                  </div>
                  <p className="text-sm font-medium">Вимкнути код</p>
                </button>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
