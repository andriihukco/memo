'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { useAuth } from '@/lib/supabase/auth-context';
import { useSound } from '@/lib/sound/use-sound';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PasscodeScreen, createPinHash } from '@/components/ui/passcode-screen';
import {
  getPasscodeHash, setPasscodeHash, removePasscode,
  getLockTimer, setLockTimer, type LockTimer, LOCK_TIMER_LABELS,
} from '@/lib/passcode';
import { cn } from '@/lib/utils';

type SetupStep = 'idle' | 'enter_current' | 'set_new' | 'confirm_new';

// Fix: robust body attribute management for tab bar hiding
function useSheetBodyAttr(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const increment = () => {
      const prev = parseInt(document.body.getAttribute('data-sheets-open') ?? '0', 10);
      document.body.setAttribute('data-sheets-open', String(prev + 1));
    };
    const decrement = () => {
      const cur = parseInt(document.body.getAttribute('data-sheets-open') ?? '1', 10);
      const next = Math.max(0, cur - 1);
      if (next === 0) document.body.removeAttribute('data-sheets-open');
      else document.body.setAttribute('data-sheets-open', String(next));
    };
    increment();
    return decrement;
  }, [open]);
}

// ---------------------------------------------------------------------------
// SoundSection component
// ---------------------------------------------------------------------------

function SoundSection() {
  const { enabled, setEnabled, play } = useSound();
  // Guard against SSR hydration mismatch — don't render toggle until mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <section>
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Звук</p>
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Icon name={mounted && enabled ? 'volume_up' : 'volume_off'} size={16} className="text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">Звукові ефекти</p>
              <p className="text-xs text-muted-foreground">{mounted && enabled ? 'Увімкнено' : 'Вимкнено'}</p>
            </div>
            {/* Toggle switch — iOS style */}
            <button
              role="switch"
              aria-checked={mounted ? enabled : false}
              onClick={() => {
                const next = !enabled;
                setEnabled(next);
                if (next) play('TOGGLE_ON'); else play('TOGGLE_OFF');
              }}
              className={cn(
                'relative flex-shrink-0 rounded-full transition-colors duration-200',
                mounted && enabled ? 'bg-[#4797FF]' : 'bg-[#335B7E]'
              )}
              style={{ width: 44, height: 26, minWidth: 44, minHeight: 26 }}
            >
              <span
                className="absolute top-[3px] rounded-full bg-white shadow-sm transition-all duration-200"
                style={{
                  width: 20,
                  height: 20,
                  left: mounted && enabled ? 21 : 3,
                }}
              />
            </button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SettingsPage
// ---------------------------------------------------------------------------

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

  const { play } = useSound();

  // ── Categories state ──────────────────────────────────────────────────────
  const { accessToken } = useAuth();

  const [categories, setCategories] = useState<{ name: string; label_ua: string; color: string }[]>([]);
  const [catError, setCatError] = useState<string | null>(null);
  const [catLoading, setCatLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    setCatLoading(true);
    setCatError(null);
    fetch('/api/categories', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(d => setCategories(d.categories ?? []))
      .catch(() => setCatError('Не вдалося завантажити категорії'))
      .finally(() => setCatLoading(false));
  }, [accessToken]);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string | null>(null);
  const router = useRouter();

  // Fetch subscription tier for delete warning
  useEffect(() => {
    if (!accessToken) return;
    fetch('/api/profile', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(d => setUserTier(d.profile?.subscription_tier ?? 'free'))
      .catch(() => {});
  }, [accessToken]);

  // Register inline sheets with body attribute so tab bar hides
  useSheetBodyAttr(showDeleteConfirm);

  // ── Passcode handlers ─────────────────────────────────────────────────────
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

  // ── Delete account handler ────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (!accessToken) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/profile/delete', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Помилка'); }
      // Clear all local state
      removePasscode();
      localStorage.removeItem('memo_onboarding_done');
      localStorage.removeItem('memo_renewal_banner_shown_date');
      localStorage.removeItem('memo_sound_enabled');
      localStorage.removeItem('memo_sound_kit');
      // Reload to trigger onboarding
      router.push('/miniapp');
      window.location.reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Не вдалося видалити акаунт. Спробуйте ще раз.');
      play('CAUTION');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Passcode screens ───────────────────────────────────────────────────────
  if (step === 'enter_current') return <PasscodeScreen key="enter_current" mode="enter" title="Поточний код" subtitle="Введіть поточний код доступу" expectedHash={getPasscodeHash() ?? undefined} onSuccess={handleCurrentVerified} onCancel={() => setStep('idle')} />;
  if (step === 'set_new') return <PasscodeScreen key="set_new" mode="set" title="Новий код" subtitle="Введіть новий 4-значний код" onSuccess={handleNewPin} onCancel={() => setStep('idle')} />;
  if (step === 'confirm_new') return <PasscodeScreen key="confirm_new" mode="confirm" title="Підтвердіть код" subtitle="Введіть код ще раз" onSuccess={handleConfirmPin} onCancel={() => setStep('idle')} />;

  const TIMERS: LockTimer[] = [0, 1, 5, 15, 60];

  return (
    <div className="flex flex-col gap-6 px-4 pt-5 pb-6">
      <h1 className="text-lg font-semibold">Профіль</h1>

      {/* ── Subscription ────────────────────────────────────────────────────── */}
      <section>
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Підписка</p>
        <Card>
          <CardContent className="p-0">
            <a href="/miniapp/subscriptions"
              onClick={() => play('OPEN')}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15">
                <span className="text-base leading-none">⭐</span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Підписка Memo</p>
                <p className="text-xs text-muted-foreground">Розблокуй AI-функції та більше лімітів</p>
              </div>
              <Icon name="chevron_right" size={16} className="text-muted-foreground" />
            </a>
          </CardContent>
        </Card>
      </section>

      {/* ── Privacy ───────────────────────────────────────────────────────── */}
      <section>
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Конфіденційність</p>
        <Card>
          <CardContent className="p-0">
            <button onClick={hasPasscode ? handleChangePasscode : handleEnablePasscode}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
              onClickCapture={() => play('OPEN')}>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                {hasPasscode ? <Icon name="password" size={16} className="text-primary" /> : <Icon name="lock" size={16} className="text-primary" />}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{hasPasscode ? 'Змінити код' : 'Увімкнути код'}</p>
                <p className="text-xs text-muted-foreground">{hasPasscode ? 'Змінити 4-значний код доступу' : 'Захистити додаток кодом'}</p>
              </div>
              <Icon name="chevron_right" size={16} className="text-muted-foreground" />
            </button>

            {hasPasscode && <Separator />}

            {hasPasscode && (
              <div>
                <button onClick={() => { play('SELECT'); setShowTimerPicker(v => !v); }}
                  className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Icon name="timer" size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">Блокування</p>
                    <p className="text-xs text-muted-foreground">{LOCK_TIMER_LABELS[lockTimer]}</p>
                  </div>
                  <Icon name="chevron_right" size={16} className={cn('text-muted-foreground transition-transform', showTimerPicker && 'rotate-90')} />
                </button>
                {showTimerPicker && (
                  <div className="border-t pb-1">
                    {TIMERS.map(t => (
                      <button key={t} onClick={() => handleTimerChange(t)}
                        className="flex w-full items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-muted/50">
                        <span className={cn(t === lockTimer && 'font-medium text-primary')}>{LOCK_TIMER_LABELS[t]}</span>
                        {t === lockTimer && <Icon name="check" size={16} className="text-primary" />}
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
                  <Icon name="lock_open" size={16} className="text-destructive" />
                </div>
                <p className="text-sm font-medium">Вимкнути код</p>
              </button>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Categories ──────────────────────────────────────────────────── */}
      <section>
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Категорії</p>
        {catError && <p className="mb-2 text-xs text-destructive">{catError}</p>}
        <Card>
          <CardContent className="p-0">
            <a
              href="/miniapp/categories"
              onClick={() => play('OPEN')}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Icon name="label" size={16} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Категорії</p>
                <p className="text-xs text-muted-foreground">
                  {catLoading ? 'Завантаження...' : `${categories.length > 0 ? categories.length : 17} категорій`}
                </p>
              </div>
              <Icon name="chevron_right" size={16} className="text-muted-foreground" />
            </a>
          </CardContent>
        </Card>
      </section>

      {/* ── Sound ───────────────────────────────────────────────────────── */}
      <SoundSection />

      {/* ── Support ─────────────────────────────────────────────────────── */}
      <section>
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Підтримка</p>
        <Card>
          <CardContent className="p-0">
            <a
              href="https://t.me/get_memo_help"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => play('OPEN')}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Icon name="support_agent" size={16} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Написати в підтримку</p>
                <p className="text-xs text-muted-foreground">@get_memo_help</p>
              </div>
              <Icon name="open_in_new" size={16} className="text-muted-foreground" />
            </a>
            <Separator />
            <a
              href="https://t.me/get_memo_updates"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => play('OPEN')}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Icon name="campaign" size={16} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Канал оновлень</p>
                <p className="text-xs text-muted-foreground">Новини та зміни</p>
              </div>
              <Icon name="open_in_new" size={16} className="text-muted-foreground" />
            </a>
          </CardContent>
        </Card>
      </section>

      {/* ── Danger zone ─────────────────────────────────────────────────── */}
      <section>
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Акаунт</p>
        <Card>
          <CardContent className="p-0">
            <button
              onClick={() => { play('CAUTION'); setShowDeleteConfirm(true); }}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-destructive transition-colors hover:bg-destructive/5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                <Icon name="delete_forever" size={16} className="text-destructive" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Видалити акаунт</p>
                <p className="text-xs text-destructive/70">Всі дані будуть видалені назавжди</p>
              </div>
            </button>
          </CardContent>
        </Card>
      </section>

      {/* Delete account confirmation sheet */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => { play('CLOSE'); setShowDeleteConfirm(false); setDeleteError(null); }} />
          <div className="relative w-full rounded-t-2xl bg-background px-4 pt-4 pb-8 shadow-2xl">
            <div className="mb-4 flex justify-center"><div className="h-1 w-10 rounded-full bg-muted" /></div>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mx-auto">
              <Icon name="delete_forever" size={24} className="text-destructive" />
            </div>
            <h3 className="mb-1 text-center text-base font-semibold">Видалити акаунт?</h3>
            <p className="mb-4 text-center text-sm text-muted-foreground">
              Всі твої записи, категорії та налаштування будуть видалені назавжди. Це дію неможливо скасувати.
            </p>

            {/* Subscription warning */}
            {userTier && userTier !== 'free' && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-3">
                <span className="text-lg leading-none shrink-0">⚠️</span>
                <p className="text-[13px] text-amber-300 leading-snug">
                  У тебе активна підписка <span className="font-semibold">{userTier === 'stars_pro' ? 'Memo Pro' : 'Memo Basic'}</span>. Після видалення акаунту вона буде втрачена без відшкодування.
                </p>
              </div>
            )}

            {deleteError && <p className="mb-3 text-center text-xs text-destructive">{deleteError}</p>}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { play('BUTTON'); handleDeleteAccount(); }}
                disabled={deleteLoading}
                className="w-full rounded-full bg-destructive py-3.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
              >
                {deleteLoading ? 'Видалення...' : 'Так, видалити все'}
              </button>
              <button
                onClick={() => { play('CLOSE'); setShowDeleteConfirm(false); setDeleteError(null); }}
                className="w-full py-3 text-sm text-muted-foreground"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
