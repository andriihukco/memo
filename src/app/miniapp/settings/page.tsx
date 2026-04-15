'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronRight, Lock, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PasscodeScreen, createPinHash } from '@/components/ui/passcode-screen';
import {
  getPasscodeHash, setPasscodeHash, removePasscode,
  getLockTimer, setLockTimer, type LockTimer, LOCK_TIMER_LABELS,
} from '@/lib/passcode';
import { cn } from '@/lib/utils';

type SetupStep = 'idle' | 'enter_current' | 'set_new' | 'confirm_new';

export default function SettingsPage() {
  const [hasPasscode, setHasPasscode] = useState(false);
  const [lockTimer, setLockTimerState] = useState<LockTimer>(0);
  const [step, setStep] = useState<SetupStep>('idle');
  const [pendingPin, setPendingPin] = useState('');
  const [showTimerPicker, setShowTimerPicker] = useState(false);

  useEffect(() => {
    setHasPasscode(!!getPasscodeHash());
    setLockTimerState(getLockTimer());
  }, []);

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

      <section>
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-[var(--tgui--hint_color)]">Конфіденційність</p>
        <Card>
          <CardContent className="p-0">
            <button onClick={hasPasscode ? handleChangePasscode : handleEnablePasscode}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--tgui--secondary_bg_color)]/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--tgui--link_color)]/10">
                <Lock size={16} className="text-[var(--tgui--link_color)]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{hasPasscode ? 'Змінити код' : 'Увімкнути код'}</p>
                <p className="text-xs text-[var(--tgui--hint_color)]">{hasPasscode ? 'Змінити 4-значний код доступу' : 'Захистити додаток кодом'}</p>
              </div>
              <ChevronRight size={16} className="text-[var(--tgui--hint_color)]" />
            </button>

            {hasPasscode && <div className="mx-4 h-px bg-[var(--tgui--hint_color)]/20" />}

            {hasPasscode && (
              <div>
                <button onClick={() => setShowTimerPicker(v => !v)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--tgui--secondary_bg_color)]/50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--tgui--link_color)]/10">
                    <Shield size={16} className="text-[var(--tgui--link_color)]" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">Блокування</p>
                    <p className="text-xs text-[var(--tgui--hint_color)]">{LOCK_TIMER_LABELS[lockTimer]}</p>
                  </div>
                  <ChevronRight size={16} className={cn('text-[var(--tgui--hint_color)] transition-transform', showTimerPicker && 'rotate-90')} />
                </button>
                {showTimerPicker && (
                  <div className="border-t pb-1">
                    {TIMERS.map(t => (
                      <button key={t} onClick={() => handleTimerChange(t)}
                        className="flex w-full items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-[var(--tgui--secondary_bg_color)]/50">
                        <span className={cn(t === lockTimer && 'font-medium text-[var(--tgui--link_color)]')}>{LOCK_TIMER_LABELS[t]}</span>
                        {t === lockTimer && <Check size={16} className="text-[var(--tgui--link_color)]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {hasPasscode && (
              <>
                <div className="mx-4 h-px bg-[var(--tgui--hint_color)]/20" />
                <button onClick={handleDisablePasscode}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-[var(--tgui--destructive_text_color)] transition-colors hover:bg-[var(--tgui--destructive_text_color)]/5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--tgui--destructive_text_color)]/10">
                    <Lock size={16} className="text-[var(--tgui--destructive_text_color)]" />
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
