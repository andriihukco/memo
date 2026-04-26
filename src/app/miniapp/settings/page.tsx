'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
import { TIER_INFO, type SubscriptionTier } from '@/lib/stars/paywall';

type SetupStep = 'idle' | 'enter_current' | 'enter_current_to_disable' | 'set_new' | 'confirm_new' | 'success';

// ── OnboardingReplay — view-only onboarding slides ────────────────────────────

const ONBOARDING_SLIDES = [
  { emoji: '📓', title: 'Твій особистий щоденник', body: 'Просто пиши або говори — Memo сам розбере що зберегти. Їжа, тренування, витрати, думки.', bg: 'from-indigo-950 to-slate-950' },
  { emoji: '🤖', title: 'AI, що тебе розуміє', body: 'Memo аналізує твої записи, рахує калорії та макроси, трекає активність і відповідає на питання про твоє минуле.', bg: 'from-violet-950 to-slate-950' },
  { emoji: '📊', title: 'Дашборд і графіки', body: 'Всі твої метрики в одному місці. Бачиш прогрес, патерни і тренди — без зайвих зусиль.', bg: 'from-blue-950 to-slate-950' },
  { emoji: '💡', title: 'Розумні рекомендації', body: 'Memo помічає якщо ти мало спиш, п\'єш забагато алкоголю або не вистачає білка — і підказує що змінити.', bg: 'from-amber-950 to-slate-950' },
  { emoji: '🔐', title: 'Твої дані захищені', body: 'Всі записи шифруються на твоєму пристрої перед збереженням. Навіть ми не можемо їх прочитати.', bg: 'from-emerald-950 to-slate-950' },
  { emoji: '⭐', title: 'Підтримай проект', body: 'Базові функції безкоштовні назавжди. Stars Pro відкриває розширену аналітику, рекомендації та пріоритетну обробку.', bg: 'from-yellow-950 to-slate-950', isFinal: true },
];

function OnboardingReplay({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const { play } = useSound();

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0, scale: 0.94 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0, scale: 0.94 }),
  };

  const goNext = () => {
    if (index < ONBOARDING_SLIDES.length - 1) { play('SLIDE'); setDirection(1); setIndex(i => i + 1); }
    else { play('CELEBRATION'); onClose(); }
  };
  const goPrev = () => {
    if (index > 0) { play('SLIDE'); setDirection(-1); setIndex(i => i - 1); }
  };

  const slide = ONBOARDING_SLIDES[index];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'fixed inset-0 z-[200] flex flex-col items-center justify-between bg-gradient-to-b px-6 pb-12 pt-16',
        slide.bg,
      )}
    >
      {/* Close */}
      <button
        onClick={() => { play('CLOSE'); onClose(); }}
        className="absolute left-5 top-5 flex h-[44px] w-[44px] items-center justify-center rounded-full bg-white/10 text-white/60"
        aria-label="Закрити"
      >
        <Icon name="close" size={18} />
      </button>

      {/* Content */}
      <div className="relative flex flex-1 flex-col items-center justify-center text-center overflow-hidden w-full">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={index}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
            className="flex flex-col items-center"
          >
            <motion.div
              className="mb-8 text-8xl leading-none select-none"
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.05 }}
            >
              {slide.emoji}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.35 }}
              className="mb-4 text-[28px] font-bold leading-tight text-white"
            >
              {slide.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.35 }}
              className="max-w-xs text-[15px] leading-relaxed text-white/60"
            >
              {slide.body}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots */}
      <div className="mb-8 flex gap-1.5 items-center">
        {ONBOARDING_SLIDES.map((_, i) => (
          <motion.button
            key={i}
            onClick={() => { setDirection(i > index ? 1 : -1); play('SELECT'); setIndex(i); }}
            animate={{ width: i === index ? 16 : 6 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{ height: 6, minWidth: 0, minHeight: 0 }}
            className={cn('rounded-full', i === index ? 'bg-white' : 'bg-white/25')}
          />
        ))}
      </div>

      {/* CTA */}
      <div className="w-full max-w-xs space-y-3">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={goNext}
          className={cn(
            'w-full rounded-2xl py-4 text-base font-semibold text-slate-950',
            (slide as { isFinal?: boolean }).isFinal ? 'bg-yellow-400' : 'bg-white'
          )}
        >
          {(slide as { isFinal?: boolean }).isFinal ? 'Зрозуміло →' : 'Далі →'}
        </motion.button>
        {index > 0 && (
          <button onClick={goPrev} className="w-full py-2 text-sm text-white/40">
            ← Назад
          </button>
        )}
      </div>
    </motion.div>
  );
}

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
  const { enabled, setEnabled, play, playForced } = useSound();
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
                if (!enabled) {
                  // Turning ON: enable first, then play (playForced bypasses enabled check)
                  setEnabled(true);
                  playForced('TOGGLE_ON');
                } else {
                  // Turning OFF: play first while still enabled, then disable
                  play('TOGGLE_OFF');
                  setTimeout(() => setEnabled(false), 150);
                }
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
  const [confirmMismatch, setConfirmMismatch] = useState(false);
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
  const [userTier, setUserTier] = useState<SubscriptionTier | null>(null);
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const router = useRouter();

  // Fetch subscription tier for delete warning
  useEffect(() => {
    if (!accessToken) return;
    fetch('/api/profile', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(d => {
        setUserTier(d.profile?.subscription_tier ?? 'free');
        setSubscriptionEndsAt(d.profile?.subscription_ends_at ?? null);
      })
      .catch(() => {});
  }, [accessToken]);

  // Register inline sheets with body attribute so tab bar hides
  useSheetBodyAttr(showDeleteConfirm);

  // ── Passcode handlers ─────────────────────────────────────────────────────
  const handleEnablePasscode = () => { play('OPEN'); setStep('set_new'); };
  const handleChangePasscode = () => { play('OPEN'); if (hasPasscode) setStep('enter_current'); else setStep('set_new'); };
  // Disable: require current PIN first
  const handleDisablePasscode = () => { play('OPEN'); setStep('enter_current_to_disable'); };
  const handleTimerChange = (t: LockTimer) => { setLockTimer(t); setLockTimerState(t); setShowTimerPicker(false); };

  const handleCurrentVerified = () => setStep('set_new');
  const handleCurrentVerifiedForDisable = () => {
    removePasscode();
    setHasPasscode(false);
    setStep('idle');
    play('CELEBRATION');
  };

  const handleNewPin = (pin: string) => {
    setPendingPin(pin);
    setConfirmMismatch(false);
    setStep('confirm_new');
  };

  const handleConfirmPin = async (pin: string) => {
    if (pin !== pendingPin) {
      // Mismatch — show error on confirm screen then go back to set_new
      setConfirmMismatch(true);
      setTimeout(() => {
        setConfirmMismatch(false);
        setPendingPin('');
        setStep('set_new');
      }, 800);
      return;
    }
    const hash = await createPinHash(pin);
    setPasscodeHash(hash);
    setHasPasscode(true);
    setPendingPin('');
    setStep('success');
    play('CELEBRATION');
    setTimeout(() => setStep('idle'), 1800);
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
  if (step === 'enter_current') return (
    <PasscodeScreen
      key="enter_current"
      mode="enter"
      title="Поточний код"
      subtitle="Введіть поточний код для продовження"
      stepCurrent={1} stepTotal={3}
      expectedHash={getPasscodeHash() ?? undefined}
      onSuccess={handleCurrentVerified}
      onCancel={() => setStep('idle')}
    />
  );
  if (step === 'enter_current_to_disable') return (
    <PasscodeScreen
      key="enter_current_to_disable"
      mode="enter"
      title="Підтвердіть код"
      subtitle="Введіть поточний код, щоб вимкнути захист"
      expectedHash={getPasscodeHash() ?? undefined}
      onSuccess={handleCurrentVerifiedForDisable}
      onCancel={() => setStep('idle')}
    />
  );
  if (step === 'set_new') return (
    <PasscodeScreen
      key="set_new"
      mode="set"
      title="Новий код"
      subtitle="Введіть 4-значний код"
      stepCurrent={hasPasscode ? 2 : 1} stepTotal={hasPasscode ? 3 : 2}
      onSuccess={handleNewPin}
      onCancel={() => setStep('idle')}
    />
  );
  if (step === 'confirm_new') return (
    <PasscodeScreen
      key="confirm_new"
      mode="confirm"
      title="Підтвердіть код"
      subtitle="Введіть код ще раз"
      stepCurrent={hasPasscode ? 3 : 2} stepTotal={hasPasscode ? 3 : 2}
      mismatch={confirmMismatch}
      onSuccess={handleConfirmPin}
      onCancel={() => { setStep('idle'); setPendingPin(''); }}
    />
  );
  if (step === 'success') return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background gap-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-400/15">
        <span className="text-5xl">🔐</span>
      </div>
      <p className="text-[22px] font-bold text-green-400">Код встановлено!</p>
      <p className="text-[14px] text-muted-foreground">Додаток тепер захищено</p>
    </div>
  );

  const TIMERS: LockTimer[] = [0, 1, 5, 15, 60];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-6 px-4 pt-5 pb-6"
    >

      {/* ── Subscription ────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Підписка</p>
        <Card>
          <CardContent className="p-0">
            <a href="/miniapp/subscriptions"
              onClick={() => play('OPEN')}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15">
                <span className="text-base leading-none">
                  {userTier ? TIER_INFO[userTier as SubscriptionTier]?.icon ?? '⭐' : '⭐'}
                </span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">
                    {userTier ? TIER_INFO[userTier as SubscriptionTier]?.name ?? 'Підписка' : 'Підписка'}
                  </p>
                  {userTier && userTier !== 'free' && (() => {
                    const isExpired = subscriptionEndsAt ? new Date(subscriptionEndsAt) < new Date() : false;
                    const daysLeft = subscriptionEndsAt && !isExpired
                      ? Math.ceil((new Date(subscriptionEndsAt).getTime() - Date.now()) / 86400000)
                      : null;
                    return (
                      <>
                        {isExpired ? (
                          <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">Закінчилась</span>
                        ) : (
                          <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-400">Активна</span>
                        )}
                        {daysLeft !== null && daysLeft <= 7 && (
                          <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">{daysLeft}д</span>
                        )}
                      </>
                    );
                  })()}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {userTier === 'free' || !userTier
                    ? 'Розблокуй AI-функції та більше лімітів'
                    : subscriptionEndsAt
                      ? `До ${new Date(subscriptionEndsAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}`
                      : 'Керувати підпискою'}
                </p>
              </div>
              <Icon name="chevron_right" size={16} className="text-muted-foreground shrink-0" />
            </a>
          </CardContent>
        </Card>
      </motion.section>

      {/* ── Privacy ───────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Конфіденційність</p>
        <Card>
          <CardContent className="p-0">
            <motion.button
              whileTap={{ scale: 0.99, backgroundColor: 'rgba(255,255,255,0.03)' }}
              onClick={hasPasscode ? handleChangePasscode : handleEnablePasscode}
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
            </motion.button>

            {hasPasscode && <Separator />}

            {hasPasscode && (
              <div>
                <motion.button
                  whileTap={{ scale: 0.99 }}
                  onClick={() => { play('SELECT'); setShowTimerPicker(v => !v); }}
                  className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Icon name="timer" size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">Блокування</p>
                    <p className="text-xs text-muted-foreground">{LOCK_TIMER_LABELS[lockTimer]}</p>
                  </div>
                  <Icon name="chevron_right" size={16} className={cn('text-muted-foreground transition-transform', showTimerPicker && 'rotate-90')} />
                </motion.button>
                <AnimatePresence>
                  {showTimerPicker && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                      className="overflow-hidden border-t"
                    >
                      <div className="pb-1">
                        {TIMERS.map(t => (
                          <motion.button
                            key={t}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleTimerChange(t)}
                            className="flex w-full items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-muted/50"
                          >
                            <span className={cn(t === lockTimer && 'font-medium text-primary')}>{LOCK_TIMER_LABELS[t]}</span>
                            {t === lockTimer && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                              >
                                <Icon name="check" size={16} className="text-primary" />
                              </motion.div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {hasPasscode && <Separator />}

            {hasPasscode && (
              <motion.button
                whileTap={{ scale: 0.99 }}
                onClick={handleDisablePasscode}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-destructive transition-colors hover:bg-destructive/5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                  <Icon name="lock_open" size={16} className="text-destructive" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">Вимкнути код</p>
                  <p className="text-xs text-destructive/60">Потрібно підтвердити поточний код</p>
                </div>
              </motion.button>
            )}
          </CardContent>
        </Card>
      </motion.section>

      {/* ── Categories ──────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Категорії</p>
        {catError && <p className="mb-2 text-xs text-destructive">{catError}</p>}
        <Card>
          <CardContent className="p-0">
            <motion.a
              whileTap={{ scale: 0.99 }}
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
            </motion.a>
          </CardContent>
        </Card>
      </motion.section>

      {/* ── Sound ───────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <SoundSection />
      </motion.div>

      {/* ── Support ─────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Підтримка</p>
        <Card>
          <CardContent className="p-0">
            <motion.a
              whileTap={{ scale: 0.99 }}
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
            </motion.a>
            <Separator />
            <motion.a
              whileTap={{ scale: 0.99 }}
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
            </motion.a>
          </CardContent>
        </Card>
      </motion.section>

      {/* ── About ───────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Про додаток</p>
        <Card>
          <CardContent className="p-0">
            <motion.button
              whileTap={{ scale: 0.99 }}
              onClick={() => { play('OPEN'); setShowOnboarding(true); }}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Icon name="auto_stories" size={16} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Як користуватись Memo</p>
                <p className="text-xs text-muted-foreground">Переглянути онбординг ще раз</p>
              </div>
              <Icon name="chevron_right" size={16} className="text-muted-foreground" />
            </motion.button>
          </CardContent>
        </Card>
      </motion.section>

      {/* ── Danger zone ─────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Акаунт</p>
        <Card>
          <CardContent className="p-0">
            <motion.button
              whileTap={{ scale: 0.99 }}
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
            </motion.button>
          </CardContent>
        </Card>
      </motion.section>

      {/* Onboarding replay */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingReplay onClose={() => setShowOnboarding(false)} />
        )}
      </AnimatePresence>

      {/* Delete account confirmation sheet */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => { play('CLOSE'); setShowDeleteConfirm(false); setDeleteError(null); }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
              className="relative w-full rounded-t-2xl bg-background px-4 pt-4 pb-8 shadow-2xl"
            >
              <div className="mb-4 flex justify-center">
                <motion.div
                  className="h-1 w-10 rounded-full bg-muted"
                  whileHover={{ scaleX: 1.2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                />
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mx-auto"
              >
                <Icon name="delete_forever" size={24} className="text-destructive" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.25 }}
              >
                <h3 className="mb-1 text-center text-base font-semibold">Видалити акаунт?</h3>
                <p className="mb-4 text-center text-sm text-muted-foreground">
                  Всі твої записи, категорії та налаштування будуть видалені назавжди. Це дію неможливо скасувати.
                </p>

                {/* Subscription warning */}
                {userTier && userTier !== 'free' && (
                  <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-3">
                    <span className="text-lg leading-none shrink-0">⚠️</span>
                    <p className="text-[13px] text-amber-300 leading-snug">
                      У тебе активна підписка <span className="font-semibold">{userTier === 'stars_pro' ? 'Memo Supernova' : 'Memo Nova'}</span>. Після видалення акаунту вона буде втрачена без відшкодування.
                    </p>
                  </div>
                )}

                {deleteError && <p className="mb-3 text-center text-xs text-destructive">{deleteError}</p>}
                <div className="flex flex-col gap-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { play('BUTTON'); handleDeleteAccount(); }}
                    disabled={deleteLoading}
                    className="w-full rounded-full bg-destructive py-3.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
                  >
                    {deleteLoading ? 'Видалення...' : 'Так, видалити все'}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { play('CLOSE'); setShowDeleteConfirm(false); setDeleteError(null); }}
                    className="w-full py-3 text-sm text-muted-foreground"
                  >
                    Скасувати
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
