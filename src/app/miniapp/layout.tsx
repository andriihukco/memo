'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from '@/lib/supabase/auth-context';
import { Icon } from '@/components/ui/icon';
import { SoundProvider } from '@/lib/sound/sound-context';
import { useSound } from '@/lib/sound/use-sound';
import { PasscodeScreen, createPinHash } from '@/components/ui/passcode-screen';
import { getPasscodeHash, setPasscodeHash, shouldLock, touchLastActive, removePasscode } from '@/lib/passcode';
import { cn } from '@/lib/utils';
import { SplashScreen } from '@/components/ui/splash-screen';
import { ReportGenerationProvider } from '@/lib/report-generation-context';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        ready: () => void;
        expand: () => void;
        openInvoice: (url: string, callback: (status: string) => void) => void;
        safeAreaInset?: { top: number; bottom: number; left: number; right: number };
        contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
      };
    };
  }
}

// ── Onboarding ────────────────────────────────────────────────────────────────

interface Slide {
  emoji: string;
  title: string;
  body: string;
  bg: string;
  textColor?: string;
  isFinal?: boolean;
  showPrivacyBadge?: boolean;
}

const SLIDES: Slide[] = [
  {
    emoji: '🔵',
    title: 'Твій особистий щоденник',
    body: 'Просто пиши або говори — Memo сам розбере що зберегти. Їжа, тренування, витрати, думки.',
    bg: 'from-indigo-950 to-slate-950',
  },
  {
    emoji: '🤖',
    title: 'AI, що тебе розуміє',
    body: 'Memo аналізує твої записи, рахує калорії та макроси, трекає активність і відповідає на питання про твоє минуле.',
    bg: 'from-violet-950 to-slate-950',
  },
  {
    emoji: '📊',
    title: 'Дашборд і графіки',
    body: 'Всі твої метрики в одному місці. Бачиш прогрес, патерни і тренди — без зайвих зусиль.',
    bg: 'from-blue-950 to-slate-950',
  },
  {
    emoji: '💡',
    title: 'Розумні рекомендації',
    body: 'Memo помічає якщо ти мало спиш, п\'єш забагато алкоголю або не вистачає білка — і підказує що змінити.',
    bg: 'from-amber-950 to-slate-950',
  },
  {
    emoji: '🔐',
    title: 'Твої дані захищені',
    body: 'Всі записи шифруються на твоєму пристрої перед збереженням. Навіть ми не можемо їх прочитати. Твоя приватність — наш пріоритет.',
    bg: 'from-emerald-950 to-slate-950',
    textColor: 'text-emerald-400',
    showPrivacyBadge: true,
  },
  {
    emoji: '⭐',
    title: 'Підтримай проект',
    body: 'Базові функції безкоштовні назавжди. Stars Pro відкриває розширену аналітику та рекомендації.',
    bg: 'from-yellow-950 to-slate-950',
    isFinal: true,
  },
];

// ── OnboardingPaywall ─────────────────────────────────────────────────────────

interface OnboardingPaywallProps {
  finish: () => void;
  play: (event: string) => void;
}

function OnboardingPaywall({ finish, play }: OnboardingPaywallProps) {
  const { accessToken } = useAuth();
  const [visible, setVisible] = useState(false);
  const [paying, setPaying] = useState<'stars_basic' | 'stars_pro' | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');

  const BILLING = {
    monthly:   { label: 'Місяць',   months: 1,  days: 30,  discount: 0,   badge: null },
    quarterly: { label: '3 місяці', months: 3,  days: 90,  discount: 15,  badge: '−15%' },
    annual:    { label: 'Рік',      months: 12, days: 365, discount: 30,  badge: '−30%' },
  } as const;

  const calcPrice = (base: number) => {
    const { months, discount } = BILLING[billingPeriod];
    return Math.round(base * months * (1 - discount / 100));
  };

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleContinueFree = () => { play('CLOSE'); finish(); };

  const handleSubscribe = async (tier: 'stars_basic' | 'stars_pro') => {
    play('BUTTON');
    if (!accessToken) { finish(); return; }

    // Check Telegram WebApp availability upfront
    const tg = window.Telegram?.WebApp;
    if (!tg?.openInvoice) { finish(); return; }

    setPaying(tier);
    try {
      const res = await fetch('/api/stars/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ tier, billingPeriod }),
      });
      const data = await res.json();
      if (!data.ok || !data.invoiceLink) throw new Error('no invoice');

      tg.openInvoice(data.invoiceLink, (status) => {
        setPaying(null);
        if (status === 'paid') finish();
      });
    } catch {
      setPaying(null);
      finish();
    }
  };

  const plans = [
    {
      tier: 'stars_basic' as const,
      emoji: '🌟',
      name: 'Nova',
      basePrice: 250,
      features: ['До 2 000 записів', '15 AI-віджетів', 'AI ретроспективи', 'Граф зв\'язків'],
      recommended: true,
    },
    {
      tier: 'stars_pro' as const,
      emoji: '💫',
      name: 'Supernova',
      basePrice: 500,
      features: ['Необмежені записи', 'Необмежені AI-віджети', 'Повна історія', 'Експорт даних'],
      recommended: false,
    },
  ];

  const periods: Array<'monthly' | 'quarterly' | 'annual'> = ['monthly', 'quarterly', 'annual'];

  return (
    <div
      className="fixed inset-0 z-[101] flex flex-col bg-gradient-to-b from-yellow-950 to-slate-950"
      style={{ transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)' }}
    >
      <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-10 pt-6">
        {/* Header: close button + centered title */}
        <div className="relative flex items-center justify-center mb-5">
          <button
            onClick={handleContinueFree}
            className="absolute left-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 active:bg-white/20 transition-colors"
            aria-label="Закрити"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="text-center">
            <h1 className="text-[18px] font-bold text-white leading-tight">Обери свій план</h1>
            <p className="text-[12px] text-white/50">Базові функції безкоштовні назавжди</p>
          </div>
        </div>

        {/* Billing period switcher */}
        <div className="mb-4 flex rounded-2xl bg-white/10 p-1 gap-1">
          {periods.map((p) => {
            const info = BILLING[p];
            const isSelected = billingPeriod === p;
            return (
              <button
                key={p}
                onClick={() => { play('SELECT'); setBillingPeriod(p); }}
                className={cn(
                  'relative flex-1 flex flex-col items-center justify-center rounded-xl py-2 px-1 transition-all',
                  isSelected ? 'bg-white/15 text-white' : 'text-white/50'
                )}
              >
                {info.badge && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-green-500 px-1.5 py-0.5 text-[9px] font-bold text-white whitespace-nowrap">
                    {info.badge}
                  </span>
                )}
                <span className="text-[12px] font-medium">{info.label}</span>
              </button>
            );
          })}
        </div>
        {billingPeriod !== 'monthly' && (
          <p className="mb-3 text-center text-[11px] text-green-400">
            Економія {BILLING[billingPeriod].discount}% порівняно з місячною оплатою
          </p>
        )}

        {/* Free tier row */}
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <span className="text-xl">✨</span>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-white">Memo Spark</p>
            <p className="text-[12px] text-white/40">До 100 записів · 3 AI-віджети · 5 ретроспектив</p>
          </div>
          <span className="text-[13px] text-white/40">Безкоштовно</span>
        </div>

        {/* Paid plan cards */}
        <div className="flex flex-col gap-3">
          {plans.map((plan) => {
            const price = calcPrice(plan.basePrice);
            const monthlyEquiv = billingPeriod !== 'monthly'
              ? Math.round(price / BILLING[billingPeriod].months)
              : null;
            return (
              <div
                key={plan.tier}
                className={cn(
                  'relative rounded-2xl border px-4 py-3.5',
                  plan.recommended ? 'border-yellow-400/50 bg-yellow-950/50' : 'border-white/10 bg-white/5'
                )}
              >
                {plan.recommended && (
                  <span className="absolute -top-2.5 right-3 rounded-full bg-yellow-400 px-2.5 py-0.5 text-[10px] font-semibold text-slate-950">
                    Рекомендовано
                  </span>
                )}
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl leading-none">{plan.emoji}</span>
                    <span className="text-[15px] font-semibold text-white">{plan.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-bold text-white">{price} ⭐</p>
                    <p className="text-[10px] text-white/40">
                      {billingPeriod === 'monthly' ? '/ міс' : `/ ${BILLING[billingPeriod].label.toLowerCase()}`}
                    </p>
                    {monthlyEquiv && (
                      <p className="text-[10px] text-green-400">≈ {monthlyEquiv} ⭐/міс</p>
                    )}
                  </div>
                </div>
                <ul className="mb-3 space-y-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-[12px] text-white/50">
                      <span className="text-[10px] text-yellow-400/80">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(plan.tier)}
                  disabled={paying !== null}
                  className={cn(
                    'w-full rounded-xl py-2.5 text-[14px] font-semibold transition-all active:scale-95 disabled:opacity-60',
                    plan.recommended ? 'bg-yellow-400 text-slate-950' : 'bg-white/10 text-white'
                  )}
                >
                  {paying === plan.tier ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Відкриваємо...
                    </span>
                  ) : (
                    `Підписатися — ${price} ⭐`
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── OnboardingPasscode ────────────────────────────────────────────────────────

function OnboardingPasscode({ onDone, play }: { onDone: () => void; play: (s: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<'ask' | 'set' | 'confirm'>('ask');
  const [pendingPin, setPendingPin] = useState('');
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const skip = () => { play('CLOSE'); onDone(); };

  const handleNewPin = (pin: string) => {
    setPendingPin(pin);
    setMismatch(false);
    setStep('confirm');
  };

  const handleConfirm = async (pin: string) => {
    if (pin !== pendingPin) {
      setMismatch(true);
      setTimeout(() => { setMismatch(false); setPendingPin(''); setStep('set'); }, 800);
      return;
    }
    const hash = await createPinHash(pin);
    setPasscodeHash(hash);
    play('CELEBRATION');
    onDone();
  };

  if (step === 'set') {
    return (
      <div className="fixed inset-0 z-[102]" style={{ transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)' }}>
        <PasscodeScreen mode="set" title="Новий код" subtitle="Введіть 4-значний код" stepCurrent={1} stepTotal={2} onSuccess={handleNewPin} onCancel={skip} />
      </div>
    );
  }
  if (step === 'confirm') {
    return (
      <div className="fixed inset-0 z-[102]" style={{ transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)' }}>
        <PasscodeScreen mode="confirm" title="Підтвердіть код" subtitle="Введіть код ще раз" stepCurrent={2} stepTotal={2} mismatch={mismatch} onSuccess={handleConfirm} onCancel={skip} />
      </div>
    );
  }

  // 'ask' step
  return (
    <div
      className="fixed inset-0 z-[102] flex flex-col items-center justify-center bg-gradient-to-b from-emerald-950 to-slate-950 px-6"
      style={{ transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)' }}
    >
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-400/15 text-5xl">
        🔐
      </div>
      <h2 className="mb-2 text-[24px] font-bold text-white text-center">Захисти Memo</h2>
      <p className="mb-8 text-[15px] text-white/60 text-center max-w-xs leading-relaxed">
        Встанови 4-значний пін-код, щоб ніхто не міг переглянути твої записи
      </p>
      <div className="w-full max-w-xs flex flex-col gap-3">
        <button
          onClick={() => { play('OPEN'); setStep('set'); }}
          className="w-full rounded-2xl bg-emerald-400 py-4 text-[16px] font-semibold text-slate-950 active:scale-95 transition-all"
        >
          Встановити код →
        </button>
        <button
          onClick={skip}
          className="w-full py-3 text-[14px] text-white/40 active:text-white/60"
        >
          Пропустити
        </button>
      </div>
    </div>
  );
}

// ── OnboardingOverlay ─────────────────────────────────────────────────────────

function OnboardingOverlay({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [showPasscode, setShowPasscode] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isScrolling = useRef<boolean | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const { play } = useSound();

  const finish = () => {
    play('CELEBRATION');
    setVisible(false);
    setTimeout(onDone, 350);
  };

  // Flow: slides → passcode → paywall → done
  const openPasscode = () => setShowPasscode(true);
  const openPaywall = () => { setShowPasscode(false); setShowPaywall(true); };

  const goNext = () => {
    if (index < SLIDES.length - 1) {
      play('SLIDE');
      setIndex(i => i + 1);
    } else {
      play('OPEN');
      openPasscode();
    }
  };
  const goPrev = () => {
    if (index > 0) {
      play('SLIDE');
      setIndex(i => i - 1);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isScrolling.current = null;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (isScrolling.current === null) isScrolling.current = Math.abs(dy) > Math.abs(dx);
    if (isScrolling.current) return;
    e.preventDefault();
    setDragOffset(dx);
  };
  const onTouchEnd = () => {
    setDragging(false);
    if (isScrolling.current) { setDragOffset(0); return; }
    if (dragOffset < -60) goNext();
    else if (dragOffset > 60) goPrev();
    setDragOffset(0);
  };

  const slide = SLIDES[index];
  const direction = useRef(1);

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 120 : -120, opacity: 0, scale: 0.95 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d > 0 ? -120 : 120, opacity: 0, scale: 0.95 }),
  };

  const originalGoNext = goNext;
  const originalGoPrev = goPrev;
  // Override to track direction
  const goNextWithDir = () => { direction.current = 1; originalGoNext(); };
  const goPrevWithDir = () => { direction.current = -1; originalGoPrev(); };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.35 }}
        className={cn(
          'fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gradient-to-b px-6 pb-12 pt-16',
          slide.bg,
          !visible && 'pointer-events-none'
        )}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Skip */}
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          onClick={() => { play('CLOSE'); openPasscode(); }}
          className="absolute right-5 top-5 text-sm text-white/40 active:text-white/70 min-h-[44px] flex items-center"
        >
          Пропустити
        </motion.button>

        {/* Content */}
        <div className="relative flex flex-1 flex-col items-center justify-center text-center overflow-hidden">
          <AnimatePresence mode="wait" custom={direction.current}>
            <motion.div
              key={index}
              custom={direction.current}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
              className="flex flex-col items-center"
              style={{
                transform: `translateX(${dragging ? dragOffset * 0.2 : 0}px)`,
              }}
            >
              <motion.div
                className="mb-8 text-8xl leading-none select-none"
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 15, delay: 0.1 }}
              >
                {slide.emoji}
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.35 }}
                className={cn('mb-4 text-[28px] font-bold leading-tight', slide.textColor ?? 'text-white')}
              >
                {slide.title}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.35 }}
                className="max-w-xs text-[15px] leading-relaxed text-white/60"
              >
                {slide.body}
              </motion.p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots */}
        <div className="mb-8 flex gap-1.5 items-center">
          {SLIDES.map((_, i) => (
            <motion.button
              key={i}
              onClick={() => { direction.current = i > index ? 1 : -1; play('SELECT'); setIndex(i); }}
              animate={{ width: i === index ? 16 : 6 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              style={{ minWidth: 0, minHeight: 0, height: 6 }}
              className={cn('rounded-full', i === index ? 'bg-white' : 'bg-white/30')}
            />
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
          className="w-full max-w-xs space-y-3"
        >
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={goNextWithDir}
            className={cn(
              'w-full rounded-2xl py-4 text-base font-semibold text-slate-950 transition-colors',
              slide.isFinal ? 'bg-yellow-400 shadow-lg shadow-yellow-400/30' : 'bg-white shadow-lg shadow-white/10'
            )}
          >
            {slide.isFinal ? 'Почати безкоштовно →' : 'Далі →'}
          </motion.button>
          <AnimatePresence>
            {index > 0 && (
              <motion.button
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                onClick={goPrevWithDir}
                className="w-full py-2 text-sm text-white/40 active:text-white/70"
              >
                ← Назад
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* Passcode setup — shown after slides, before paywall */}
      {showPasscode && (
        <OnboardingPasscode onDone={openPaywall} play={play} />
      )}

      {/* Paywall overlay — rendered on top of the onboarding slide */}
      {showPaywall && (
        <OnboardingPaywall finish={finish} play={play} />
      )}
    </>
  );
}

// ── Pill Tab Bar ──────────────────────────────────────────────────────────────

const tabs = [
  { label: 'Стрічка',  href: '/miniapp',            icon: 'contract' },
  { label: 'Віджети',  href: '/miniapp/dashboard',   icon: 'dashboard' },
  { label: 'Графік',   href: '/miniapp/graph',        icon: 'hub' },
  { label: 'Інсайти',  href: '/miniapp/reports',      icon: 'wb_incandescent', activeIconColor: '#F5C542', activeIconStyle: { transform: 'rotate(1deg)', filter: 'drop-shadow(0 4px 8px rgba(245,197,66,0.55))' } },
  { label: 'Меню',    href: '/miniapp/settings',     icon: 'menu' },
];

const ACTIVE_COLOR = '#4797FF';
const INACTIVE_COLOR = '#335B7E';

function PillTabBar({ pathname, bottomInset }: { pathname: string; bottomInset: number }) {
  const { play } = useSound();
  const [sheetsOpen, setSheetsOpen] = useState(false);

  // Hide tab bar when any bottom sheet is open
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setSheetsOpen(document.body.hasAttribute('data-sheets-open'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-sheets-open'] });
    return () => observer.disconnect();
  }, []);

  return (
    <AnimatePresence>
      {!sheetsOpen && (
        <>
          {/* Wrapper centres the pill without conflicting with Framer Motion's transform */}
          <div
            style={{
              position: 'fixed',
              bottom: bottomInset + 10,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              zIndex: 50,
              pointerEvents: 'none',
            }}
          >
          <motion.nav
            role="navigation"
            aria-label="Головна навігація"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            style={{
              borderRadius: 48,
              background: '#1F2234',
              width: 'min(calc(100vw - 16px), 380px)',
              height: 64,
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-around',
              alignItems: 'center',
              padding: '0 8px',
              boxSizing: 'border-box',
              pointerEvents: 'auto',
            }}
          >
            {tabs.map(({ label, href, icon, activeIconColor, activeIconStyle }) => {
              const isActive = pathname === href;
              const iconColor = isActive ? (activeIconColor ?? ACTIVE_COLOR) : INACTIVE_COLOR;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => play(isActive ? 'SELECT' : 'SLIDE')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 2,
                    minWidth: 44,
                    minHeight: 44,
                    textDecoration: 'none',
                    flex: 1,
                    position: 'relative',
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute inset-0 rounded-full bg-white/8"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon
                    name={icon}
                    size={24}
                    filled={isActive}
                    style={{ color: iconColor, ...(isActive && activeIconStyle ? activeIconStyle : {}) }}
                  />
                  <span
                    style={{
                      fontFamily: "'Comfortaa', 'Mulish', sans-serif",
                      fontWeight: 500,
                      fontSize: 11,
                      lineHeight: '14px',
                      textAlign: 'center',
                      color: isActive ? ACTIVE_COLOR : INACTIVE_COLOR,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </motion.nav>
          </div>
          {/* Fill the gap below the pill tab bar so body background doesn't show */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              height: bottomInset + 10,
              background: 'hsl(var(--background))',
              zIndex: 49,
            }}
          />
        </>
      )}
    </AnimatePresence>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────

const rootPaths = ['/miniapp', '/miniapp/dashboard', '/miniapp/graph', '/miniapp/reports', '/miniapp/settings'];
function MiniAppContent({ children }: { children: React.ReactNode }) {
  const { setAccessToken } = useAuth();
  const { play } = useSound();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const pathname = usePathname();
  const router = useRouter();
  const isSubPage = !rootPaths.includes(pathname);
  const [topInset, setTopInset] = useState(0);
  const [bottomInset, setBottomInset] = useState(0);
  const [locked, setLocked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showRenewalBanner, setShowRenewalBanner] = useState(false);
  const didInit = useRef(false);

  // Pill tab bar height: 64px tall + 10px bottom offset + bottomInset
  const tabBarH = 64 + 10 + bottomInset;

  useEffect(() => {
    // If auth already completed this session, skip splash immediately
    if (sessionStorage.getItem('memo_auth_done')) {
      setStatus('ready');
    }

    async function init() {
      try {
        const tg = window.Telegram?.WebApp;
        tg?.ready();
        tg?.expand();

        const top = (tg?.contentSafeAreaInset?.top ?? 0) + (tg?.safeAreaInset?.top ?? 0);
        const bottom = tg?.safeAreaInset?.bottom ?? 0;
        setTopInset(top);
        setBottomInset(bottom);

        if (!didInit.current) {
          didInit.current = true;
          if (!sessionStorage.getItem('memo_session_init')) {
            sessionStorage.setItem('memo_session_init', '1');
            if (shouldLock()) setLocked(true);
          }
          if (!localStorage.getItem('memo_onboarding_done')) {
            setShowOnboarding(true);
          }
        }

        const initData = tg?.initData ?? '';
        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 401 || res.status === 403 || res.status === 404) {
            removePasscode();
            localStorage.removeItem('memo_onboarding_done');
            localStorage.removeItem('memo_renewal_banner_shown_date');
          }
          throw new Error(data.error ?? `Auth failed (${res.status})`);
        }

        const { access_token } = await res.json();
        setAccessToken(access_token);
        sessionStorage.setItem('memo_auth_done', '1');

        // Check subscription expiry for renewal banner
        const profileRes = await fetch('/api/profile', {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        if (profileRes.ok) {
          const { profile } = await profileRes.json();
          if (
            profile?.subscription_ends_at &&
            new Date(profile.subscription_ends_at) < new Date() &&
            profile?.subscription_tier !== 'free'
          ) {
            const today = new Date().toISOString().slice(0, 10);
            if (localStorage.getItem('memo_renewal_banner_shown_date') !== today) {
              setShowRenewalBanner(true);
            }
          }
        }
      } catch (err) {
        // Only show error screen on first load, not on re-mounts
        if (!sessionStorage.getItem('memo_auth_done')) {
          setErrorMsg(err instanceof Error ? err.message : 'Authentication failed');
          setStatus('error');
          return;
        }
      }
      setStatus('ready');
    }

    init();
  }, [setAccessToken]);

  useEffect(() => {
    const handler = () => setLocked(true);
    window.addEventListener('memo:lock', handler);
    return () => window.removeEventListener('memo:lock', handler);
  }, []);

  const handleUnlock = () => {
    touchLastActive();
    setLocked(false);
  };

  const dismissRenewalBanner = () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('memo_renewal_banner_shown_date', today);
    setShowRenewalBanner(false);
  };

  if (status === 'loading') {
    // First cold load → full splash with constellation animation
    // Re-mount on tab navigation → instant blank (auth already done)
    const isColdLoad = typeof window !== 'undefined' && !sessionStorage.getItem('memo_auth_done');
    if (isColdLoad) return <SplashScreen />;
    return <div className="flex h-screen bg-background" />;
  }

  if (status === 'error') {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-1 text-[17px] font-semibold text-foreground"
          >
            Sign In Failed
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-[15px] text-muted-foreground"
          >
            {errorMsg}
          </motion.p>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen flex-col bg-background"
      style={{
        '--bottom-inset': `${bottomInset}px`,
        '--tab-bar-h': `${tabBarH}px`,
        fontFamily: "'Comfortaa', 'Mulish', sans-serif",
      } as React.CSSProperties}
    >
      {showOnboarding && (
        <OnboardingOverlay onDone={() => {
          localStorage.setItem('memo_onboarding_done', '1');
          setShowOnboarding(false);
          router.replace('/miniapp');
        }} />
      )}

      {locked && (
        <PasscodeScreen
          mode="enter"
          title="Memo"
          subtitle="Введіть код доступу"
          expectedHash={getPasscodeHash() ?? undefined}
          onSuccess={handleUnlock}
        />
      )}

      {/* Top spacer — ensures content doesn't sit under Telegram's header */}
      <div style={{ height: Math.max(topInset, 0) }} />

      {isSubPage && (
        <button
          onClick={() => { router.back(); play('SLIDE'); }}
          className="fixed top-4 left-4 z-50 flex h-[44px] w-[44px] items-center justify-center rounded-full bg-muted/80 backdrop-blur-sm text-foreground"
          aria-label="Назад"
        >
          <Icon name="arrow_back" size={24} />
        </button>
      )}

      <main
        className="relative flex-1 overflow-y-auto"
        style={{ paddingBottom: `var(--tab-bar-h)` }}
        onClick={(e) => {
          // Play TAP on empty area clicks (not on interactive elements)
          const target = e.target as HTMLElement;
          const isInteractive = target.closest('button, a, input, textarea, select, [role="button"], [role="switch"]');
          if (!isInteractive) play('TAP');
        }}
      >
        {children}
      </main>

      <PillTabBar pathname={pathname} bottomInset={bottomInset} />

      {/* Renewal banner — shown once per day when subscription has expired */}
      {showRenewalBanner && (
        <div
          className="fixed left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 bg-amber-950/90 border-t border-amber-400/30 backdrop-blur-sm"
          style={{
            bottom: `calc(var(--tab-bar-h, 84px) + var(--bottom-inset, 0px))`,
          }}
        >
          <p className="flex-1 text-[13px] text-amber-200 leading-snug">
            Підписка закінчилась. Поновіть для продовження доступу.
          </p>
          <button
            onClick={() => router.push('/miniapp/subscriptions')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-amber-400 px-3 text-[13px] font-semibold text-slate-950 shrink-0"
            aria-label="Поновити підписку"
          >
            Поновити
          </button>
          <button
            onClick={dismissRenewalBanner}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-amber-400/70 shrink-0"
            aria-label="Закрити банер"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SoundProvider>
        <ReportGenerationProvider>
          <MiniAppContent>{children}</MiniAppContent>
        </ReportGenerationProvider>
      </SoundProvider>
    </AuthProvider>
  );
}
