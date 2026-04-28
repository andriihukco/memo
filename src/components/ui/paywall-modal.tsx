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
import { useI18n } from '@/lib/i18n/context';

// ── Feature copy map ──────────────────────────────────────────────────────────

interface FeatureCopy {
  emoji: string;
  title: string;
  subtitle: (current: number, limit: number) => string;
  basicFeatures: string[];
  proFeatures: string[];
}

const PAYWALL_COPY: Record<string, FeatureCopy> = {
  ai_reports: {
    emoji: '✨',
    title: 'AI ретроспективи',
    subtitle: () => 'Аналізуй свій прогрес за будь-який період',
    basicFeatures: ['50 звітів на місяць', 'Щоденні, тижневі, місячні', 'Структурований аналіз'],
    proFeatures: ['Необмежені звіти', 'Пріоритетна обробка', 'Повна аналітика'],
  },
  ai_recommendations: {
    emoji: '💡',
    title: 'AI рекомендації',
    subtitle: () => 'Персоналізовані поради на основі твоїх даних',
    basicFeatures: ['Щотижневі рекомендації', 'Аналіз патернів', 'Поради по здоров\'ю'],
    proFeatures: ['Щоденні рекомендації', 'Пріоритетна обробка', 'Розширений аналіз'],
  },
  goal_tracking: {
    emoji: '🎯',
    title: 'Трекінг цілей',
    subtitle: () => 'Ставь цілі та відстежуй прогрес',
    basicFeatures: ['Необмежені цілі', 'Прогрес-бари', 'Нагадування'],
    proFeatures: ['AI аналіз цілей', 'Пріоритетна обробка', 'Всі функції Basic'],
  },
  graph_full: {
    emoji: '🕸️',
    title: 'Граф зв\'язків',
    subtitle: () => 'Візуалізуй, як твої думки та записи пов\'язані між собою',
    basicFeatures: ['Інтерактивний граф', 'Кольорові кластери', 'Редагування з графу'],
    proFeatures: ['Всі функції Nova', 'Пріоритетна обробка', 'Розширена аналітика'],
  },
  ai_widgets: {
    emoji: '📊',
    title: 'Ліміт AI-віджетів вичерпано',
    subtitle: (c, l) => `Використано ${c} з ${l} AI-віджетів. Перейди на Nova для збільшення до 15.`,
    basicFeatures: ['15 кастомних AI-віджетів', 'AI генерація метрик', 'Всі типи трекінгу'],
    proFeatures: ['Необмежені AI-віджети', 'Пріоритетна обробка', 'Розширена аналітика'],
  },
  custom_widgets: {
    emoji: '📊',
    title: 'Ліміт AI-віджетів вичерпано',
    subtitle: () => 'У безкоштовному плані доступно 3 AI-віджети. Перейди на Nova для збільшення до 15.',
    basicFeatures: ['15 кастомних AI-віджетів', 'AI генерація метрик', 'Всі типи трекінгу'],
    proFeatures: ['Необмежені AI-віджети', 'Пріоритетна обробка', 'Розширена аналітика'],
  },
  widgets: {
    emoji: '📊',
    title: 'Ліміт AI-віджетів вичерпано',
    subtitle: (c, l) => `Використано ${c} з ${l} AI-віджетів. Перейди на Nova для збільшення до 15.`,
    basicFeatures: ['15 кастомних AI-віджетів', 'AI генерація метрик', 'Всі типи трекінгу'],
    proFeatures: ['Необмежені AI-віджети', 'Пріоритетна обробка', 'Розширена аналітика'],
  },
  entries: {
    emoji: '📝',
    title: 'Ліміт записів вичерпано',
    subtitle: (c, l) => `${c} з ${l} записів використано`,
    basicFeatures: ['До 2 000 записів', 'Повна стрічка', 'Всі категорії'],
    proFeatures: ['Необмежені записи', 'Пріоритетна обробка', 'Повна аналітика'],
  },
  reports: {
    emoji: '💡',
    title: 'Ліміт ретроспектив вичерпано',
    subtitle: (c, l) => `${c} з ${l} звітів цього місяця`,
    basicFeatures: ['50 звітів на місяць', 'Всі типи аналізу', 'Структурований звіт'],
    proFeatures: ['Необмежені звіти', 'Пріоритетна обробка', 'Повна аналітика'],
  },
  date_range: {
    emoji: '📅',
    title: 'Розширена історія',
    subtitle: () => 'Аналізуй дані за 3 місяці, рік або весь час',
    basicFeatures: ['3 місяці, рік, з початку року', 'Власний діапазон дат', '365 днів для Nova'],
    proFeatures: ['Необмежена історія', 'Пріоритетна обробка', 'Повна аналітика'],
  },
};

const FALLBACK_COPY: FeatureCopy = {
  emoji: '🔒',
  title: 'Функція недоступна',
  subtitle: () => 'Перейди на платний план, щоб розблокувати',
  basicFeatures: ['Розширені функції', 'AI аналітика', 'Більше лімітів'],
  proFeatures: ['Необмежений доступ', 'Пріоритетна обробка', 'Всі функції'],
};

// ── Warm elevation tokens (matches onboarding warm brown palette) ─────────────
const EL = {
  track: 'bg-white/10',
  pill:  'bg-white/15',
  card:  'bg-white/5',
  cardBorder: 'border-white/10',
} as const;

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
  const { t } = useI18n();
  const [paying, setPaying] = useState(false);
  const [activatingTrial, setActivatingTrial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successType, setSuccessType] = useState<'trial' | 'paid' | null>(null);
  const [selectedTier, setSelectedTier] = useState<'stars_basic' | 'stars_pro'>(
    requiredTier === 'stars_pro' ? 'stars_pro' : 'stars_basic'
  );
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  const copy = PAYWALL_COPY[feature] ?? FALLBACK_COPY;

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
        setError(data.error ?? t('miniapp.subs.error.trial'));
      } else {
        play('CELEBRATION');
        setSuccessType('trial');
        onTrialActivated?.();
      }
    } catch {
      setError(t('miniapp.subs.error.generic'));
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
      if (!data.ok || !data.invoiceLink) throw new Error(data.error ?? t('miniapp.subs.error.invoice'));

      tg.openInvoice(data.invoiceLink, (status) => {
        setPaying(false);
        if (status === 'paid') { play('CELEBRATION'); setSuccessType('paid'); }
        else if (status === 'failed') setError(t('miniapp.subs.error.payment_failed'));
      });
    } catch (err) {
      setPaying(false);
      setError(err instanceof Error ? err.message : t('miniapp.subs.error.generic'));
    }
  };

  const selectedInfo = TIER_INFO[selectedTier];
  const starsPrice = calcPrice(selectedInfo.priceStars, billingPeriod);
  const periodInfo = BILLING_PERIODS[billingPeriod];
  const features = selectedTier === 'stars_basic' ? copy.basicFeatures : copy.proFeatures;
  const showTrial = !trialUsed && selectedTier === 'stars_basic';

  // ── Success screen ──────────────────────────────────────────────────────────
  if (successType) {
    const isTrial = successType === 'trial';
    return (
      <BottomSheet open={open} onClose={onClose} className="bg-gradient-to-b from-yellow-950 to-[#0d1117]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center px-6 pt-6 pb-8 gap-5"
        >
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.05 }}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-yellow-400/15 text-5xl select-none"
          >
            {isTrial ? '🎉' : TIER_INFO[selectedTier].icon}
          </motion.div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[22px] font-bold">
              {isTrial ? t('miniapp.paywall.success.trial_title') : t('miniapp.paywall.success.paid_title')}
            </h2>
            <p className="text-[15px] font-semibold text-yellow-400">
              {isTrial ? t('miniapp.paywall.success.trial_subtitle') : t('miniapp.paywall.success.paid_subtitle', { name: TIER_INFO[selectedTier].name })}
            </p>
            <p className="text-[14px] text-muted-foreground">
              {isTrial ? t('miniapp.paywall.success.trial_body') : t('miniapp.paywall.success.paid_body')}
            </p>
          </div>
          <button
            className="w-full min-h-[48px] rounded-2xl bg-yellow-400 py-3.5 text-[15px] font-semibold text-slate-950 active:scale-[0.98] transition-transform"
            onClick={() => { play('BUTTON'); onClose(); }}
          >
            {t('miniapp.paywall.success.cta')}
          </button>
        </motion.div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      open={open}
      onClose={() => { play('CLOSE'); onClose(); }}
      className="bg-gradient-to-b from-yellow-950 to-[#0d1117]"
    >
      <div className="relative flex flex-col pb-2">

        {/* Close button — top-left */}
        <button
          onClick={() => { play('CLOSE'); onClose(); }}
          className="absolute top-0 left-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 active:bg-white/20 transition-colors"
          aria-label="Закрити"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* ── Hero ── */}
        <div className="flex flex-col items-center text-center gap-2 pt-4 px-4">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20, delay: 0.05 }}
            className="text-[52px] leading-none select-none"
          >
            {copy.emoji}
          </motion.span>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.25 }}
            className="flex flex-col gap-1"
          >
            <h2 className="text-[18px] font-bold tracking-tight text-white">{copy.title}</h2>
            <p className="text-[13px] text-white/50 leading-snug max-w-[260px] mx-auto">
              {copy.subtitle(current, limit)}
            </p>
          </motion.div>
        </div>

        {/* ── Plan segmented control ── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.22 }}
          className={cn('flex rounded-2xl p-1 gap-1 mx-4 mt-4', EL.track)}
        >
          {(['stars_basic', 'stars_pro'] as const).map((planTier) => {
            const info = TIER_INFO[planTier];
            const isSelected = selectedTier === planTier;
            return (
              <button
                key={planTier}
                onClick={() => { play('SELECT'); setSelectedTier(planTier); }}
                className={cn(
                  'relative flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold transition-all duration-200',
                  isSelected
                    ? cn(EL.pill, 'text-white shadow-sm')
                    : 'text-white/50'
                )}
              >
                <span className="text-[17px] leading-none">{info.icon}</span>
                <span>{info.name}</span>
              </button>
            );
          })}
        </motion.div>

        {/* ── Billing period segmented control ── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.22 }}
          className={cn('flex rounded-2xl p-1 gap-1 mx-4 mt-3', EL.track)}
        >
          {(['monthly', 'quarterly', 'annual'] as BillingPeriod[]).map((p) => {
            const info = BILLING_PERIODS[p];
            const isSelected = billingPeriod === p;
            return (
              <button
                key={p}
                onClick={() => { play('SELECT'); setBillingPeriod(p); }}
                className={cn(
                  'relative flex-1 flex flex-col items-center justify-center rounded-xl py-2 text-[12px] font-medium transition-all duration-200',
                  isSelected ? cn(EL.pill, 'text-white shadow-sm') : 'text-white/50'
                )}
              >
                {info.badge && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-px text-[9px] font-bold whitespace-nowrap bg-green-500 text-white">
                    {info.badge}
                  </span>
                )}
                <span>{info.label}</span>
              </button>
            );
          })}
        </motion.div>

        {/* ── Plan detail card ── */}
        <motion.div
          key={`${selectedTier}-${billingPeriod}`}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          className={cn('rounded-2xl border mx-4 mt-3 px-4 py-4', EL.card, EL.cardBorder)}
        >
          {/* Price row */}
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <span className="text-[22px] leading-none">{selectedInfo.icon}</span>
              <div>
                <p className="text-[15px] font-bold leading-tight text-white">{selectedInfo.name}</p>
                <p className="text-[11px] text-white/40">{selectedInfo.description}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[22px] font-bold leading-tight text-yellow-400">
                {starsPrice} ⭐
              </p>
              <p className="text-[10px] text-white/40">
                {billingPeriod === 'monthly' ? t('miniapp.subs.per_month') : `/ ${periodInfo.label.toLowerCase()}`}
              </p>
              {billingPeriod !== 'monthly' && (
                <p className="text-[10px] text-green-400 font-medium">
                  ≈ {Math.round(starsPrice / periodInfo.months)} ⭐/міс
                </p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/10 mb-3" />

          {/* Features */}
          <div className="flex flex-col gap-2">
            {features.map((f, i) => (
              <motion.div
                key={f}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.18 }}
                className="flex items-center gap-2.5"
              >
                <span className="text-[13px] font-bold text-yellow-400/80 shrink-0">✓</span>
                <span className="text-[13px] text-white/70">{f}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Error ── */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-[13px] text-destructive text-center mt-2 px-4"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* ── CTAs ── */}
        <div className="flex flex-col gap-2 px-4 mt-4">
          {/* Subscribe — always the primary yellow CTA */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={paying || activatingTrial}
            onClick={handleUpgrade}
            className={cn(
              'w-full min-h-[52px] rounded-2xl text-[15px] font-bold transition-all disabled:opacity-60',
              'bg-yellow-400 text-slate-950 shadow-lg shadow-yellow-400/20'
            )}
          >
            {paying ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                {t('miniapp.paywall.opening')}
              </span>
            ) : (
              t('miniapp.paywall.subscribe', { price: String(starsPrice) })
            )}
          </motion.button>

          {/* Trial — minimal text link when available */}
          <AnimatePresence>
            {showTrial && (
              <motion.button
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                whileTap={{ scale: 0.97 }}
                disabled={activatingTrial || paying}
                onClick={handleActivateTrial}
                className="w-full py-2.5 text-[13px] font-medium text-yellow-400/80 hover:text-yellow-400 transition-colors disabled:opacity-50"
              >
                {activatingTrial ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-yellow-400/30 border-t-yellow-400" />
                    {t('miniapp.paywall.trial_activating')}
                  </span>
                ) : (
                  t('miniapp.paywall.trial_cta')
                )}
              </motion.button>
            )}
          </AnimatePresence>

          <button
            onClick={() => { play('CLOSE'); onClose(); }}
            className="w-full py-2.5 text-[13px] text-white/30 hover:text-white/50 transition-colors"
          >
            {t('miniapp.paywall.not_now')}
          </button>
        </div>

      </div>
    </BottomSheet>
  );
}
