'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useSound } from '@/lib/sound/use-sound';
import { useAuth } from '@/lib/supabase/auth-context';
import type { SubscriptionTier, BillingPeriod } from '@/lib/stars/paywall';
import { TIER_INFO, BILLING_PERIODS, calcPrice } from '@/lib/stars/paywall';
import { cn } from '@/lib/utils';

// ── Feature scenes ────────────────────────────────────────────────────────────
// Each scene has a hero visual, headline, and benefit bullets.

interface FeatureScene {
  emoji: string;
  gradient: string;       // Tailwind bg-gradient classes for the hero area
  accentColor: string;    // Tailwind text color for accents
  headline: string;
  subline: (current: number, limit: number) => string;
  bullets: { icon: string; text: string }[];
  requiredTier: 'stars_basic' | 'stars_pro';
}

const SCENES: Record<string, FeatureScene> = {
  ai_reports: {
    emoji: '✨',
    gradient: 'from-violet-950 via-indigo-950 to-slate-950',
    accentColor: 'text-violet-300',
    headline: 'AI ретроспективи',
    subline: () => 'Глибокий аналіз твого прогресу за будь-який період',
    bullets: [
      { icon: '📊', text: 'Щоденні, тижневі та місячні звіти' },
      { icon: '🔍', text: 'Патерни та тренди у твоїх даних' },
      { icon: '💡', text: 'Персоналізовані інсайти від AI' },
      { icon: '📈', text: 'До 50 звітів на місяць' },
    ],
    requiredTier: 'stars_basic',
  },
  ai_recommendations: {
    emoji: '💡',
    gradient: 'from-amber-950 via-orange-950 to-slate-950',
    accentColor: 'text-amber-300',
    headline: 'AI рекомендації',
    subline: () => 'Персоналізовані поради на основі твоїх записів',
    bullets: [
      { icon: '🧠', text: 'Аналіз твоїх звичок і патернів' },
      { icon: '🎯', text: 'Конкретні поради для покращення' },
      { icon: '📅', text: 'Щотижневі рекомендації' },
      { icon: '❤️', text: 'Поради по здоров\'ю та продуктивності' },
    ],
    requiredTier: 'stars_basic',
  },
  goal_tracking: {
    emoji: '🎯',
    gradient: 'from-emerald-950 via-teal-950 to-slate-950',
    accentColor: 'text-emerald-300',
    headline: 'Трекінг цілей',
    subline: () => 'Ставь цілі та відстежуй прогрес у реальному часі',
    bullets: [
      { icon: '🎯', text: 'Необмежена кількість цілей' },
      { icon: '📊', text: 'Прогрес-бари на дашборді' },
      { icon: '🔔', text: 'Нагадування та мотивація' },
      { icon: '🏆', text: 'Відстеження досягнень' },
    ],
    requiredTier: 'stars_basic',
  },
  graph_full: {
    emoji: '🕸️',
    gradient: 'from-indigo-950 via-blue-950 to-slate-950',
    accentColor: 'text-indigo-300',
    headline: 'Граф зв\'язків',
    subline: () => 'Візуалізуй, як твої думки та записи пов\'язані між собою',
    bullets: [
      { icon: '🔗', text: 'Зв\'язки між записами та ідеями' },
      { icon: '🎨', text: 'Кольорові кластери по категоріях' },
      { icon: '🔍', text: 'Пошук патернів у думках' },
      { icon: '✏️', text: 'Редагування прямо з графу' },
    ],
    requiredTier: 'stars_basic',
  },
  ai_widgets: {
    emoji: '📊',
    gradient: 'from-cyan-950 via-sky-950 to-slate-950',
    accentColor: 'text-cyan-300',
    headline: 'Більше AI-віджетів',
    subline: (c, l) => `Використано ${c} з ${l}. Розблокуй до 15 кастомних метрик`,
    bullets: [
      { icon: '📊', text: '15 кастомних AI-віджетів' },
      { icon: '🤖', text: 'AI генерація метрик з тексту' },
      { icon: '🎯', text: 'Цілі та прогрес-бари' },
      { icon: '📈', text: 'Всі типи трекінгу' },
    ],
    requiredTier: 'stars_basic',
  },
  custom_widgets: {
    emoji: '📊',
    gradient: 'from-cyan-950 via-sky-950 to-slate-950',
    accentColor: 'text-cyan-300',
    headline: 'Більше AI-віджетів',
    subline: () => 'Розблокуй до 15 кастомних метрик на дашборді',
    bullets: [
      { icon: '📊', text: '15 кастомних AI-віджетів' },
      { icon: '🤖', text: 'AI генерація метрик з тексту' },
      { icon: '🎯', text: 'Цілі та прогрес-бари' },
      { icon: '📈', text: 'Всі типи трекінгу' },
    ],
    requiredTier: 'stars_basic',
  },
  widgets: {
    emoji: '📊',
    gradient: 'from-cyan-950 via-sky-950 to-slate-950',
    accentColor: 'text-cyan-300',
    headline: 'Більше AI-віджетів',
    subline: (c, l) => `Використано ${c} з ${l}. Розблокуй до 15 кастомних метрик`,
    bullets: [
      { icon: '📊', text: '15 кастомних AI-віджетів' },
      { icon: '🤖', text: 'AI генерація метрик з тексту' },
      { icon: '🎯', text: 'Цілі та прогрес-бари' },
      { icon: '📈', text: 'Всі типи трекінгу' },
    ],
    requiredTier: 'stars_basic',
  },
  entries: {
    emoji: '📝',
    gradient: 'from-rose-950 via-pink-950 to-slate-950',
    accentColor: 'text-rose-300',
    headline: 'Більше записів',
    subline: (c, l) => `${c} з ${l} записів використано`,
    bullets: [
      { icon: '📝', text: 'До 2 000 записів' },
      { icon: '📜', text: 'Повна стрічка без обмежень' },
      { icon: '🗂️', text: 'Всі категорії та метрики' },
      { icon: '🔍', text: 'Повний пошук по записах' },
    ],
    requiredTier: 'stars_basic',
  },
  reports: {
    emoji: '💡',
    gradient: 'from-violet-950 via-purple-950 to-slate-950',
    accentColor: 'text-violet-300',
    headline: 'Більше ретроспектив',
    subline: (c, l) => `${c} з ${l} звітів цього місяця`,
    bullets: [
      { icon: '📊', text: '50 звітів на місяць' },
      { icon: '📅', text: 'Всі типи аналізу' },
      { icon: '✍️', text: 'Структурований звіт' },
      { icon: '💡', text: 'AI інсайти та рекомендації' },
    ],
    requiredTier: 'stars_basic',
  },
  date_range: {
    emoji: '📅',
    gradient: 'from-blue-950 via-indigo-950 to-slate-950',
    accentColor: 'text-blue-300',
    headline: 'Розширена історія',
    subline: () => 'Аналізуй дані за 3 місяці, рік або весь час',
    bullets: [
      { icon: '📅', text: '3 місяці, рік, з початку року' },
      { icon: '🗓️', text: 'Власний діапазон дат' },
      { icon: '📊', text: '365 днів для Nova' },
      { icon: '♾️', text: 'Необмежена історія для Supernova' },
    ],
    requiredTier: 'stars_basic',
  },
};

const FALLBACK_SCENE: FeatureScene = {
  emoji: '⭐',
  gradient: 'from-slate-900 via-slate-950 to-black',
  accentColor: 'text-yellow-300',
  headline: 'Розблокуй повний доступ',
  subline: () => 'Перейди на платний план щоб отримати всі функції',
  bullets: [
    { icon: '🤖', text: 'AI ретроспективи та рекомендації' },
    { icon: '📊', text: '15 кастомних AI-віджетів' },
    { icon: '🕸️', text: 'Граф зв\'язків між записами' },
    { icon: '📅', text: '365 днів історії' },
  ],
  requiredTier: 'stars_basic',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  feature: string;
  current?: number;
  limit?: number;
  requiredTier: SubscriptionTier;
  trialUsed?: boolean;
  onTrialActivated?: () => void;
}

export function PaywallModal({
  open,
  onClose,
  feature,
  current = 0,
  limit = 0,
  requiredTier,
  trialUsed = true,
  onTrialActivated,
}: PaywallModalProps) {
  const router = useRouter();
  const { play } = useSound();
  const { accessToken } = useAuth();
  const [paying, setPaying] = useState(false);
  const [activatingTrial, setActivatingTrial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successType, setSuccessType] = useState<'trial' | 'paid' | null>(null);
  const [selectedTier, setSelectedTier] = useState<'stars_basic' | 'stars_pro'>(
    requiredTier === 'stars_pro' ? 'stars_pro' : 'stars_basic'
  );
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  const scene = SCENES[feature] ?? FALLBACK_SCENE;

  useEffect(() => {
    if (open) {
      play('CAUTION');
      setError(null);
      setPaying(false);
      setActivatingTrial(false);
      setSuccessType(null);
      setSelectedTier(requiredTier === 'stars_pro' ? 'stars_pro' : 'stars_basic');
      setBillingPeriod('monthly');
    }
  }, [open, play, requiredTier, feature]);

  const handleActivateTrial = async () => {
    if (!accessToken) return;
    play('BUTTON');
    setError(null);
    setActivatingTrial(true);
    try {
      const res = await fetch('/api/profile/trial', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Не вдалося активувати пробний період.');
      } else {
        play('CELEBRATION');
        setSuccessType('trial');
        onTrialActivated?.();
      }
    } catch {
      setError('Щось пішло не так. Спробуй ще раз.');
    } finally {
      setActivatingTrial(false);
    }
  };

  const handleUpgrade = async () => {
    play('BUTTON');
    setError(null);

    if (!accessToken) {
      router.push('/miniapp/subscriptions');
      onClose();
      return;
    }

    const tg = window.Telegram?.WebApp;
    if (!tg?.openInvoice) {
      router.push('/miniapp/subscriptions');
      onClose();
      return;
    }

    setPaying(true);
    try {
      const res = await fetch('/api/stars/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ tier: selectedTier, billingPeriod }),
      });
      const data = await res.json();
      if (!data.ok || !data.invoiceLink) throw new Error(data.error ?? 'Не вдалося створити рахунок');

      tg.openInvoice(data.invoiceLink, (status) => {
        setPaying(false);
        if (status === 'paid') { play('CELEBRATION'); setSuccessType('paid'); }
        else if (status === 'failed') setError('Оплата не вдалася. Спробуй ще раз.');
      });
    } catch (err) {
      setPaying(false);
      setError(err instanceof Error ? err.message : 'Щось пішло не так. Спробуй ще раз.');
    }
  };

  const selectedInfo = TIER_INFO[selectedTier];
  const starsPrice = calcPrice(selectedInfo.priceStars, billingPeriod);
  const periodInfo = BILLING_PERIODS[billingPeriod];
  const showTrial = !trialUsed && selectedTier === 'stars_basic';

  // ── Success screen ──────────────────────────────────────────────────────────
  if (successType) {
    const isTrial = successType === 'trial';
    return (
      <BottomSheet open={open} onClose={onClose}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center px-6 pt-6 pb-8 gap-5"
        >
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.05 }}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15 text-5xl select-none"
          >
            {isTrial ? '🎉' : TIER_INFO[selectedTier].icon}
          </motion.div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[22px] font-bold">
              {isTrial ? 'Пробний період активовано!' : 'Дякуємо! 🎉'}
            </h2>
            <p className="text-[15px] font-semibold text-green-400">
              {isTrial ? 'Memo Nova — 3 дні безкоштовно' : `${TIER_INFO[selectedTier].name} активовано`}
            </p>
            <p className="text-[14px] text-muted-foreground">
              {isTrial ? 'Тепер у тебе є доступ до всіх функцій Nova. Насолоджуйся!' : 'Твоя підтримка дуже важлива для нас ❤️'}
            </p>
          </div>
          <button
            className="w-full min-h-[48px] rounded-2xl bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground active:scale-[0.98] transition-transform"
            onClick={() => { play('BUTTON'); onClose(); }}
          >
            Чудово →
          </button>
        </motion.div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onClose={() => { play('CLOSE'); onClose(); }}>
      <div className="flex flex-col pb-2">

        {/* ── Hero section ── */}
        <div className={cn(
          'relative mx-4 mt-1 mb-4 rounded-2xl bg-gradient-to-br px-5 pt-6 pb-5 overflow-hidden',
          scene.gradient
        )}>
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5 blur-xl" />

          {/* Emoji + headline */}
          <div className="relative flex flex-col items-center text-center gap-3">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.05 }}
              className="text-5xl leading-none select-none"
            >
              {scene.emoji}
            </motion.div>
            <div>
              <h2 className="text-[20px] font-bold text-white leading-tight">{scene.headline}</h2>
              <p className="mt-1 text-[13px] text-white/60 leading-snug">{scene.subline(current, limit)}</p>
            </div>
          </div>

          {/* Benefit bullets */}
          <div className="relative mt-4 flex flex-col gap-2">
            {scene.bullets.map(({ icon, text }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05, duration: 0.25 }}
                className="flex items-center gap-2.5"
              >
                <span className="text-[16px] leading-none shrink-0">{icon}</span>
                <span className="text-[13px] text-white/80">{text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Plan tabs ── */}
        <div className="px-4 mb-3">
          <div className="flex rounded-2xl bg-muted/40 p-1 gap-1">
            {(['stars_basic', 'stars_pro'] as const).map((planTier) => {
              const info = TIER_INFO[planTier];
              const isSelected = selectedTier === planTier;
              return (
                <button
                  key={planTier}
                  onClick={() => { play('SELECT'); setSelectedTier(planTier); }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-semibold transition-all',
                    isSelected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  <span className="text-base leading-none">{info.icon}</span>
                  <span>{info.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Billing period ── */}
        <div className="px-4 mb-4">
          <div className="flex rounded-2xl bg-muted/40 p-1 gap-1">
            {(['monthly', 'quarterly', 'annual'] as BillingPeriod[]).map((p) => {
              const info = BILLING_PERIODS[p];
              const isSelected = billingPeriod === p;
              return (
                <button
                  key={p}
                  onClick={() => { play('SELECT'); setBillingPeriod(p); }}
                  className={cn(
                    'relative flex-1 flex flex-col items-center justify-center rounded-xl py-2 text-[12px] font-medium transition-all',
                    isSelected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  {info.badge && (
                    <span className={cn(
                      'absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap',
                      isSelected ? 'bg-green-500 text-white' : 'bg-green-500/30 text-green-400'
                    )}>
                      {info.badge}
                    </span>
                  )}
                  {info.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Price row ── */}
        <div className="px-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-[13px] text-muted-foreground">
              {billingPeriod === 'monthly' ? 'На місяць' : `За ${periodInfo.label.toLowerCase()}`}
            </p>
            {billingPeriod !== 'monthly' && (
              <p className="text-[11px] text-green-400">≈ {Math.round(starsPrice / periodInfo.months)} ⭐/міс</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[24px] font-bold leading-tight">{starsPrice} ⭐</p>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <p className="px-4 mb-3 text-[13px] text-destructive text-center">{error}</p>
        )}

        {/* ── CTAs ── */}
        <div className="px-4 flex flex-col gap-2.5">
          {/* Trial CTA — most prominent when available */}
          <AnimatePresence>
            {showTrial && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  'w-full min-h-[52px] rounded-2xl py-3.5 text-[15px] font-bold transition-all',
                  'bg-gradient-to-r from-yellow-400 to-amber-400 text-slate-950',
                  activatingTrial && 'opacity-60'
                )}
                disabled={activatingTrial || paying}
                onClick={handleActivateTrial}
              >
                {activatingTrial ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                    Активуємо...
                  </span>
                ) : (
                  '🎁 Спробувати Nova безкоштовно — 3 дні'
                )}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Subscribe button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            className={cn(
              'w-full min-h-[48px] rounded-2xl py-3 text-[14px] font-semibold transition-all',
              showTrial
                ? 'bg-muted/60 text-foreground/80 border border-border/40'
                : 'bg-yellow-400 text-slate-950',
              paying && 'opacity-60'
            )}
            disabled={paying}
            onClick={handleUpgrade}
          >
            {paying ? (
              <span className="flex items-center justify-center gap-2">
                <span className={cn(
                  'h-4 w-4 animate-spin rounded-full border-2',
                  showTrial ? 'border-foreground/30 border-t-foreground' : 'border-slate-950/30 border-t-slate-950'
                )} />
                Відкриваємо оплату...
              </span>
            ) : (
              `Підписатися — ${starsPrice} ⭐`
            )}
          </motion.button>

          {/* Dismiss */}
          <button
            className="w-full py-2.5 text-[13px] text-muted-foreground active:text-foreground transition-colors"
            onClick={() => { play('CLOSE'); onClose(); }}
          >
            Не зараз
          </button>
        </div>

      </div>
    </BottomSheet>
  );
}
