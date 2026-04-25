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
  voice_logging: {
    emoji: '🎙️',
    title: 'Голосові повідомлення',
    subtitle: () => 'Записуй нотатки голосом — Memo розпізнає і збереже',
    basicFeatures: ['Розпізнавання мови', 'Автокласифікація', 'Метрики з голосу'],
    proFeatures: ['Пріоритетна обробка', 'Розширений аналіз', 'Всі функції Basic'],
  },
  goal_tracking: {
    emoji: '🎯',
    title: 'Трекінг цілей',
    subtitle: () => 'Ставь цілі та відстежуй прогрес',
    basicFeatures: ['Необмежені цілі', 'Прогрес-бари', 'Нагадування'],
    proFeatures: ['AI аналіз цілей', 'Пріоритетна обробка', 'Всі функції Basic'],
  },
  custom_widgets: {
    emoji: '📊',
    title: 'Ліміт AI-віджетів вичерпано',
    subtitle: () => 'У безкоштовному плані доступно 3 AI-віджети. Перейди на Nova для збільшення до 15.',
    basicFeatures: ['15 кастомних AI-віджетів', 'AI генерація метрик', 'Всі типи трекінгу'],
    proFeatures: ['Необмежені AI-віджети', 'Пріоритетна обробка', 'Розширена аналітика'],
  },
  ai_widgets: {
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
  widgets: {
    emoji: '📊',
    title: 'Ліміт AI-віджетів вичерпано',
    subtitle: (c, l) => `Використано ${c} з ${l} AI-віджетів. Перейди на Nova для збільшення до 15.`,
    basicFeatures: ['15 кастомних AI-віджетів', 'AI генерація метрик', 'Всі типи трекінгу'],
    proFeatures: ['Необмежені AI-віджети', 'Пріоритетна обробка', 'Розширена аналітика'],
  },
  reports: {
    emoji: '💡',
    title: 'Ліміт ретроспектив вичерпано',
    subtitle: (c, l) => `${c} з ${l} звітів цього місяця`,
    basicFeatures: ['50 звітів на місяць', 'Всі типи аналізу', 'Структурований звіт'],
    proFeatures: ['Необмежені звіти', 'Пріоритетна обробка', 'Повна аналітика'],
  },
  graph_full: {
    emoji: '🕸️',
    title: 'Граф зв\'язків',
    subtitle: () => 'Візуалізуй, як твої думки та записи пов\'язані між собою',
    basicFeatures: ['Інтерактивний граф', 'Кольорові кластери', 'Редагування з графу'],
    proFeatures: ['Всі функції Nova', 'Пріоритетна обробка', 'Розширена аналітика'],
  },
};

const FALLBACK_COPY: FeatureCopy = {
  emoji: '🔒',
  title: 'Функція недоступна',
  subtitle: () => 'Перейди на платний план, щоб розблокувати',
  basicFeatures: ['Розширені функції', 'AI аналітика', 'Більше лімітів'],
  proFeatures: ['Необмежений доступ', 'Пріоритетна обробка', 'Всі функції'],
};

// ── Elevation tokens (dark → light as z-index rises) ─────────────────────────
// bg:        #0B0F19  (page background — darkest)
// sheet:     #1A2234  (bottom sheet panel — surface-elevated)
// track:     #222C42  (segmented control track — slightly lighter)
// pill:      #2D3A52  (selected pill — lightest interactive surface)

const EL = {
  track: 'bg-[#1e2a3e]',          // segmented control background
  pill:  'bg-[#2d3a52]',          // selected segment pill
  card:  'bg-[#1e2a3e]',          // feature card background
  cardBorder: 'border-[#2d3a52]/60',
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  feature: string;
  current?: number;
  limit?: number;
  requiredTier: SubscriptionTier;
}

export function PaywallModal({
  open,
  onClose,
  feature,
  current = 0,
  limit = 0,
  requiredTier,
}: PaywallModalProps) {
  const router = useRouter();
  const { play } = useSound();
  const { accessToken } = useAuth();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setSelectedTier(requiredTier === 'stars_pro' ? 'stars_pro' : 'stars_basic');
      setBillingPeriod('monthly');
    }
  }, [open, play, requiredTier]);

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
      if (!data.ok || !data.invoiceLink) {
        throw new Error(data.error ?? 'Не вдалося створити рахунок');
      }

      tg.openInvoice(data.invoiceLink, (status) => {
        setPaying(false);
        if (status === 'paid') {
          play('CELEBRATION');
          onClose();
        } else if (status === 'failed') {
          setError('Оплата не вдалася. Спробуй ще раз.');
        }
      });
    } catch (err) {
      setPaying(false);
      setError(err instanceof Error ? err.message : 'Щось пішло не так. Спробуй ще раз.');
    }
  };

  const selectedInfo = TIER_INFO[selectedTier];
  const starsPrice = calcPrice(selectedInfo.priceStars, billingPeriod);
  const periodInfo = BILLING_PERIODS[billingPeriod];
  const features = selectedTier === 'stars_basic' ? copy.basicFeatures : copy.proFeatures;
  const isPro = selectedTier === 'stars_pro';

  return (
    <BottomSheet open={open} onClose={() => { play('CLOSE'); onClose(); }}>
      <div className="flex flex-col px-4 pb-2 gap-5">

        {/* ── Hero ── */}
        <div className="flex flex-col items-center text-center gap-2 pt-1">
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
            <h2 className="text-[18px] font-bold tracking-tight">{copy.title}</h2>
            <p className="text-[13px] text-muted-foreground leading-snug max-w-[260px] mx-auto">
              {copy.subtitle(current, limit)}
            </p>
          </motion.div>
        </div>

        {/* ── Plan segmented control ── */}
        {/* Track is slightly lighter than the sheet; selected pill is lightest */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.22 }}
          className={cn('flex rounded-2xl p-1 gap-1', EL.track)}
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
                    ? cn(EL.pill, 'text-foreground shadow-sm')
                    : 'text-muted-foreground/60 hover:text-muted-foreground'
                )}
              >
                <span className="text-[17px] leading-none">{info.icon}</span>
                <span>{info.name}</span>
                {planTier === 'stars_pro' && (
                  <span className="absolute -top-2 right-3 rounded-full bg-amber-400/20 border border-amber-400/30 px-1.5 py-px text-[9px] font-bold text-amber-300 whitespace-nowrap">
                    PRO
                  </span>
                )}
              </button>
            );
          })}
        </motion.div>

        {/* ── Billing period segmented control ── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.22 }}
          className={cn('flex rounded-2xl p-1 gap-1', EL.track)}
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
                  isSelected
                    ? cn(EL.pill, 'text-foreground shadow-sm')
                    : 'text-muted-foreground/60 hover:text-muted-foreground'
                )}
              >
                {info.badge && (
                  <span className={cn(
                    'absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-px text-[9px] font-bold whitespace-nowrap border',
                    isSelected
                      ? 'bg-green-500/20 border-green-500/40 text-green-300'
                      : 'bg-green-500/10 border-green-500/20 text-green-500/50'
                  )}>
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
          className={cn(
            'rounded-2xl border px-4 py-4',
            EL.card, EL.cardBorder
          )}
        >
          {/* Price row */}
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <span className="text-[22px] leading-none">{selectedInfo.icon}</span>
              <div>
                <p className="text-[15px] font-bold leading-tight">{selectedInfo.name}</p>
                <p className="text-[11px] text-muted-foreground">{selectedInfo.description}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={cn(
                'text-[22px] font-bold leading-tight',
                isPro ? 'text-amber-300' : 'text-primary'
              )}>
                {starsPrice} ⭐
              </p>
              <p className="text-[10px] text-muted-foreground">
                {billingPeriod === 'monthly' ? '/ місяць' : `/ ${periodInfo.label.toLowerCase()}`}
              </p>
              {billingPeriod !== 'monthly' && (
                <p className="text-[10px] text-green-400 font-medium">
                  ≈ {Math.round(starsPrice / periodInfo.months)} ⭐/міс
                </p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/5 mb-3" />

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
                <span className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  isPro ? 'bg-amber-400/15 text-amber-300' : 'bg-primary/15 text-primary'
                )}>✓</span>
                <span className="text-[13px] text-foreground/80">{f}</span>
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
              className="text-[13px] text-destructive text-center -mt-2"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* ── CTA ── */}
        <div className="flex flex-col gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={paying}
            onClick={handleUpgrade}
            className={cn(
              'w-full min-h-[50px] rounded-2xl text-[15px] font-bold transition-all disabled:opacity-60',
              isPro
                ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-900 shadow-lg shadow-amber-400/20'
                : 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
            )}
          >
            {paying ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                Відкриваємо оплату...
              </span>
            ) : (
              `Підписатися — ${starsPrice} ⭐`
            )}
          </motion.button>

          <button
            onClick={() => { play('CLOSE'); onClose(); }}
            className="w-full py-3 text-[13px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Не зараз
          </button>
        </div>

      </div>
    </BottomSheet>
  );
}
