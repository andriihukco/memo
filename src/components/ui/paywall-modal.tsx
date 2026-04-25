'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
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
    subtitle: () => 'У безкоштовному плані доступно 3 кастомних AI-віджети. Перейди на Basic для збільшення до 15.',
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
    subtitle: (c, l) => `Використано ${c} з ${l} кастомних AI-віджетів. Перейди на Basic для збільшення до 15.`,
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
};

const FALLBACK_COPY: FeatureCopy = {
  emoji: '🔒',
  title: 'Функція недоступна',
  subtitle: () => 'Перейди на платний план, щоб розблокувати',
  basicFeatures: ['Розширені функції', 'AI аналітика', 'Більше лімітів'],
  proFeatures: ['Необмежений доступ', 'Пріоритетна обробка', 'Всі функції'],
};

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
  // Allow switching between plans in the modal
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

    // Check Telegram WebApp availability before making any network calls
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
        // cancelled — user closed the sheet, stay on paywall
      });
    } catch (err) {
      setPaying(false);
      const msg = err instanceof Error ? err.message : 'Щось пішло не так. Спробуй ще раз.';
      setError(msg);
    }
  };

  const selectedInfo = TIER_INFO[selectedTier];
  const starsPrice = calcPrice(selectedInfo.priceStars, billingPeriod);
  const periodInfo = BILLING_PERIODS[billingPeriod];
  const features = selectedTier === 'stars_basic' ? copy.basicFeatures : copy.proFeatures;

  return (
    <BottomSheet open={open} onClose={() => { play('CLOSE'); onClose(); }}>
      <div className="flex flex-col gap-4 px-4 pt-1 pb-2">
        {/* Feature header */}
        <div className="flex flex-col items-center text-center gap-1.5">
          <span className="text-5xl leading-none select-none">{copy.emoji}</span>
          <h2 className="text-[17px] font-semibold">{copy.title}</h2>
          <p className="text-[13px] text-muted-foreground">{copy.subtitle(current, limit)}</p>
        </div>

        {/* Plan selector tabs */}
        <div className="flex rounded-xl bg-muted/40 p-1 gap-1">
          {(['stars_basic', 'stars_pro'] as const).map((planTier) => {
            const info = TIER_INFO[planTier];
            const isSelected = selectedTier === planTier;
            return (
              <button
                key={planTier}
                onClick={() => { play('SELECT'); setSelectedTier(planTier); }}
                style={{ minHeight: 0, minWidth: 0 }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium transition-all',
                  isSelected
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                )}
              >
                <span className="text-base leading-none">{info.icon}</span>
                <span>{info.name}</span>
              </button>
            );
          })}
        </div>

        {/* Billing period switcher */}
        <div className="flex rounded-xl bg-muted/40 p-1 gap-1">
          {(['monthly', 'quarterly', 'annual'] as BillingPeriod[]).map((p) => {
            const info = BILLING_PERIODS[p];
            const isSelected = billingPeriod === p;
            return (
              <button
                key={p}
                onClick={() => { play('SELECT'); setBillingPeriod(p); }}
                className={cn(
                  'relative flex-1 flex flex-col items-center justify-center rounded-lg py-1.5 text-[12px] font-medium transition-all',
                  isSelected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                )}
              >
                {info.badge && (
                  <span className={cn(
                    'absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap',
                    isSelected ? 'bg-green-500 text-white' : 'bg-green-500/20 text-green-400'
                  )}>
                    {info.badge}
                  </span>
                )}
                {info.label}
              </button>
            );
          })}
        </div>

        {/* Selected plan details */}
        <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3.5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl leading-none">{selectedInfo.icon}</span>
              <p className="text-[15px] font-semibold">{selectedInfo.name}</p>
            </div>
            <div className="text-right">
              <p className="text-[17px] font-bold">{starsPrice} ⭐</p>
              <p className="text-[10px] text-muted-foreground">
                {billingPeriod === 'monthly' ? '/ місяць' : `/ ${periodInfo.label.toLowerCase()}`}
              </p>
              {billingPeriod !== 'monthly' && (
                <p className="text-[10px] text-green-400">
                  ≈ {Math.round(starsPrice / periodInfo.months)} ⭐/міс
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] text-green-400 font-bold w-3 shrink-0">✓</span>
                <span className="text-[13px] text-foreground/80">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && <p className="text-[13px] text-destructive text-center">{error}</p>}

        {/* CTA */}
        <div className="flex flex-col gap-2">
          <Button
            variant="default"
            className="w-full min-h-[44px]"
            disabled={paying}
            onClick={handleUpgrade}
          >
            {paying ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                Відкриваємо оплату...
              </span>
            ) : (
              `Підписатися — ${starsPrice} ⭐`
            )}
          </Button>
          <Button variant="ghost" className="w-full min-h-[44px]" onClick={() => { play('CLOSE'); onClose(); }}>
            Не зараз
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
