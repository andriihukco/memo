'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronRight, Lock, LockOpen, RectangleEllipsis, ClockFading, Trash2, BookOpen, Bell, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PasscodeScreen, createPinHash } from '@/components/ui/passcode-screen';
import { useAuth } from '@/lib/supabase/auth-context';
import {
  getPasscodeHash, setPasscodeHash, removePasscode,
  getLockTimer, setLockTimer, type LockTimer, LOCK_TIMER_LABELS,
} from '@/lib/passcode';
import { cn } from '@/lib/utils';

type SetupStep = 'idle' | 'enter_current' | 'set_new' | 'confirm_new';

interface CustomRule { id: string; instruction: string; created_at: string; }
interface ReportSchedule { daily: boolean; weekly: boolean; weekly_day: number; monthly: boolean; monthly_day: number; time: string; }

const WEEK_DAYS = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

// ── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          checked ? 'bg-primary' : 'bg-input',
        )}
      >
        <span className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { accessToken } = useAuth();
  const [hasPasscode, setHasPasscode] = useState(false);
  const [lockTimer, setLockTimerState] = useState<LockTimer>(0);
  const [step, setStep] = useState<SetupStep>('idle');
  const [pendingPin, setPendingPin] = useState('');
  const [showTimerPicker, setShowTimerPicker] = useState(false);

  // Rules
  const [rules, setRules] = useState<CustomRule[]>([]);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRuleText, setNewRuleText] = useState('');

  // Schedule
  const [schedule, setSchedule] = useState<ReportSchedule>({ daily: false, weekly: true, weekly_day: 1, monthly: true, monthly_day: 1, time: '09:00' });

  useEffect(() => {
    setHasPasscode(!!getPasscodeHash());
    setLockTimerState(getLockTimer());
  }, []);

  const loadRules = useCallback(async () => {
    if (!accessToken) return;
    const res = await fetch('/api/rules', { headers: { Authorization: `Bearer ${accessToken}` } });
    const d = await res.json();
    setRules(d.rules ?? []);
  }, [accessToken]);

  const loadSchedule = useCallback(async () => {
    if (!accessToken) return;
    const res = await fetch('/api/schedule', { headers: { Authorization: `Bearer ${accessToken}` } });
    const d = await res.json();
    if (d.schedule) setSchedule(d.schedule);
  }, [accessToken]);

  useEffect(() => { loadRules(); loadSchedule(); }, [loadRules, loadSchedule]);

  const deleteRule = async (id: string) => {
    if (!accessToken) return;
    await fetch('/api/rules', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ id }),
    });
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const addRule = async () => {
    if (!accessToken || !newRuleText.trim()) return;
    const res = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ instruction: newRuleText.trim() }),
    });
    if (res.ok) {
      const { rule } = await res.json();
      setRules(prev => [...prev, rule]);
      setNewRuleText('');
      setShowAddRule(false);
    }
  };

  const updateSchedule = async (patch: Partial<ReportSchedule>) => {
    if (!accessToken) return;
    const next = { ...schedule, ...patch };
    setSchedule(next);
    await fetch('/api/schedule', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(patch),
    });
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

  if (step === 'enter_current') return <PasscodeScreen key="enter_current" mode="enter" title="Поточний код" subtitle="Введіть поточний код доступу" expectedHash={getPasscodeHash() ?? undefined} onSuccess={handleCurrentVerified} onCancel={() => setStep('idle')} />;
  if (step === 'set_new') return <PasscodeScreen key="set_new" mode="set" title="Новий код" subtitle="Введіть новий 4-значний код" onSuccess={handleNewPin} onCancel={() => setStep('idle')} />;
  if (step === 'confirm_new') return <PasscodeScreen key="confirm_new" mode="confirm" title="Підтвердіть код" subtitle="Введіть код ще раз" onSuccess={handleConfirmPin} onCancel={() => setStep('idle')} />;

  const TIMERS: LockTimer[] = [0, 1, 5, 15, 60];

  return (
    <div className="flex flex-col gap-6 px-4 pt-5 pb-6">
      <h1 className="text-lg font-semibold">Профіль</h1>

      {/* ── Auto-reports ──────────────────────────────────────────────────── */}
      <section>
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Автозвіти</p>
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Bell size={16} className="text-primary" />
              </div>
              <p className="flex-1 text-sm font-medium">Час відправки</p>
              <input
                type="time"
                value={schedule.time}
                onChange={e => updateSchedule({ time: e.target.value })}
                className="rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <Separator />
            <ToggleRow label="Щоденний звіт" checked={schedule.daily} onChange={v => updateSchedule({ daily: v })} />
            <Separator />
            <ToggleRow label="Тижневий звіт" checked={schedule.weekly} onChange={v => updateSchedule({ weekly: v })} />
            {schedule.weekly && (
              <>
                <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                  {WEEK_DAYS.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => updateSchedule({ weekly_day: i })}
                      className={cn(
                        'h-8 w-8 rounded-full text-xs font-medium transition-colors',
                        schedule.weekly_day === i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </>
            )}
            <Separator />
            <ToggleRow label="Місячний звіт" checked={schedule.monthly} onChange={v => updateSchedule({ monthly: v })} />
            {schedule.monthly && (
              <div className="flex items-center gap-3 px-4 pb-3">
                <span className="text-xs text-muted-foreground">День місяця:</span>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={schedule.monthly_day ?? 1}
                  onChange={e => updateSchedule({ monthly_day: Math.min(28, Math.max(1, Number(e.target.value))) })}
                  className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            )}
          </CardContent>
        </Card>
        <p className="mt-1.5 px-1 text-xs text-muted-foreground">Або скажи боту: &ldquo;Вмикай тижневий звіт о 10:00&rdquo;</p>
      </section>

      {/* ── Rules ─────────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Правила бота</p>
          <button
            onClick={() => setShowAddRule(v => !v)}
            className="flex items-center gap-1 text-xs text-primary"
          >
            <Plus size={12} />
            Додати правило
          </button>
        </div>

        {showAddRule && (
          <div className="mb-2 flex gap-2">
            <input
              type="text"
              placeholder="Наприклад: мій стакан = 300мл"
              value={newRuleText}
              onChange={e => setNewRuleText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addRule(); }}
              autoFocus
              className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={addRule}
              disabled={!newRuleText.trim()}
              className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Зберегти
            </button>
          </div>
        )}

        {rules.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <BookOpen size={16} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Правил ще немає. Напиши боту: &ldquo;Запам&apos;ятай: мій стакан = 300мл&rdquo;</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {rules.map((rule, i) => (
                <div key={rule.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-start gap-3 px-4 py-3">
                    <p className="flex-1 text-sm leading-relaxed">{rule.instruction}</p>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Privacy ───────────────────────────────────────────────────────── */}
      <section>
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Конфіденційність</p>
        <Card>
          <CardContent className="p-0">
            <button onClick={hasPasscode ? handleChangePasscode : handleEnablePasscode}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                {hasPasscode ? <RectangleEllipsis size={16} className="text-primary" /> : <Lock size={16} className="text-primary" />}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{hasPasscode ? 'Змінити код' : 'Увімкнути код'}</p>
                <p className="text-xs text-muted-foreground">{hasPasscode ? 'Змінити 4-значний код доступу' : 'Захистити додаток кодом'}</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>

            {hasPasscode && <Separator />}

            {hasPasscode && (
              <div>
                <button onClick={() => setShowTimerPicker(v => !v)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <ClockFading size={16} className="text-primary" />
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

            {hasPasscode && <Separator />}

            {hasPasscode && (
              <button onClick={handleDisablePasscode}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-destructive transition-colors hover:bg-destructive/5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                  <LockOpen size={16} className="text-destructive" />
                </div>
                <p className="text-sm font-medium">Вимкнути код</p>
              </button>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
