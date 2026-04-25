'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { useSound } from '@/lib/sound/use-sound';
import { useAuth } from '@/lib/supabase/auth-context';
import type { SubscriptionTier } from '@/lib/stars/paywall';
import { TIER_INFO } from '@/lib/stars/paywall';

// ── Props ─────────────────────────────────────────────────────────────────────

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  /** Feature key — one of the 9 gated features or a count-limit key */
  feature: string;
  /** Current usage count (for count-limit features: entries, widgets, reports) */
  current?: number;
  /** Plan limit (for count-limit features) */
  limit?: number;
  /** The minimum tier required to unlock this feature */
  requiredTier: SubscriptionTier;
}

// ── Feature copy map ──────────────────────────────────────────────────────────

interface FeatureCopy {
  icon: string;
  title: string;
  subtitle: (current: number, limit: number) => string;
  comparisonText: string;
}

const PAYWALL_COPY: Record<string, FeatureCopy> = {
  ai_reports: {
    icon: 'auto_awesome',
    title: 'AI ретроспективи',
    subtitle: () =>
      'Аналізуй свій прогрес за будь-який період за допомогою штучного інтелекту',
    comparisonText: 'Basic: 50 звітів · Pro: необмежено',
  },
  ai_recommendations: {
    icon: 'lightbulb',
    title: 'AI рекомендації',
    subtitle: () => 'Отримуй персоналізовані поради на основі твоїх даних',
    comparisonText: 'Basic: ✓ · Pro: ✓',
  },
  voice_logging: {
    icon: 'mic',
    title: 'Голосові повідомлення',
    subtitle: () => 'Записуй нотатки голосом — Memo розпізнає і збереже',
    comparisonText: 'Basic: ✓ · Pro: ✓',
  },
  goal_tracking: {
    icon: 'my_location',
    title: 'Трекінг цілей',
    subtitle: () => 'Ставь цілі та відстежуй прогрес у стрічці',
    comparisonText: 'Basic: ✓ · Pro: ✓',
  },
  custom_widgets: {
    icon: 'dashboard_customize',
    title: 'Кастомні віджети',
    subtitle: () => 'Створюй власні метрики за допомогою AI',
    comparisonText: 'Basic: 15 віджетів · Pro: необмежено',
  },
  full_history: {
    icon: 'history',
    title: 'Повна історія',
    subtitle: () => 'Переглядай всі записи без обмежень за часом',
    comparisonText: 'Basic: 1 рік · Pro: вся історія',
  },
  graph_full: {
    icon: 'bar_chart',
    title: 'Графіки та аналітика',
    subtitle: () => 'Повний доступ до графіків і статистики',
    comparisonText: 'Basic: повна · Pro: повна + експорт',
  },
  data_export: {
    icon: 'download',
    title: 'Експорт даних',
    subtitle: () => 'Вивантажуй свої дані у форматі JSON або CSV',
    comparisonText: 'Basic: ✗ · Pro: ✓',
  },
  priority_processing: {
    icon: 'bolt',
    title: 'Пріоритетна обробка',
    subtitle: () => 'Твої запити обробляються першими',
    comparisonText: 'Basic: ✗ · Pro: ✓',
  },
  entries: {
    icon: 'edit_note',
    title: 'Ліміт записів вичерпано',
    subtitle: (c, l) =>
      `У тебе ${c} з ${l} записів. Перейди на Basic для збільшення ліміту.`,
    comparisonText: 'Basic: 2 000 · Pro: необмежено',
  },
  widgets: {
    icon: 'dashboard',
    title: 'Ліміт віджетів вичерпано',
    subtitle: (c, l) =>
      `У тебе ${c} з ${l} віджетів. Перейди на Basic для збільшення ліміту.`,
    comparisonText: 'Basic: 15 · Pro: необмежено',
  },
  reports: {
    icon: 'summarize',
    title: 'Ліміт ретроспектив вичерпано',
    subtitle: (c, l) =>
      `У тебе ${c} з ${l} ретроспектив. Перейди на Basic для збільшення ліміту.`,
    comparisonText: 'Basic: 50 · Pro: необмежено',
  },
};

/** Fallback copy for unknown feature keys */
const FALLBACK_COPY: FeatureCopy = {
  icon: 'lock',
  title: 'Функція недоступна',
  subtitle: () => 'Перейди на платний план, щоб розблокувати цю функцію',
  comparisonText: 'Basic: ✓ · Pro: ✓',
};

// ── Component ─────────────────────────────────────────────────────────────────

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

  const copy = PAYWALL_COPY[feature] ?? FALLBACK_COPY;
  const tierInfo = TIER_INFO[requiredTier];

  // Play CAUTION when the sheet opens
  useEffect(() => {
    if (open) {
      play('CAUTION');
      setError(null);
      setPaying(false);
    }
  }, [open, play]);

  const handleUpgrade = async () => {
    play('BUTTON');
    setError(null);

    if (!accessToken) {
      // Not authenticated yet — fall back to subscriptions page
      router.push('/miniapp/subscriptions');
      onClose();
      return;
    }

    setPaying(true);
    try {
      const profileRes = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!profileRes.ok) throw new Error('no profile');
      const { profile } = await profileRes.json();

      const res = await fetch('/api/stars/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userId: profile.id, tier: requiredTier }),
      });
      const data = await res.json();
      if (!data.ok || !data.invoiceLink) throw new Error(data.error ?? 'no invoice');

      const tg = window.Telegram?.WebApp;
      if (!tg?.openInvoice) {
        // Not in Telegram — fall back to subscriptions page
        router.push('/miniapp/subscriptions');
        onClose();
        return;
      }

      tg.openInvoice(data.invoiceLink, (status) => {
        setPaying(false);
        if (status === 'paid') {
          play('CELEBRATION');
          onClose();
        } else if (status === 'failed') {
          setError('Оплата не вдалася. Спробуй ще раз.');
        }
        // cancelled — stay on paywall, do nothing
      });
    } catch {
      setPaying(false);
      setError('Щось пішло не так. Спробуй ще раз.');
    }
  };

  const handleDismiss = () => {
    play('CLOSE');
    onClose();
  };

  const ctaLabel =
    requiredTier === 'stars_pro'
      ? `Підписатися — ${tierInfo.priceStars} ⭐`
      : `Підписатися — ${tierInfo.priceStars} ⭐`;

  return (
    <BottomSheet open={open} onClose={handleDismiss}>
      {/* Content area */}
      <div className="flex flex-col gap-3 px-4 pt-2 pb-2">
        {/* Feature header */}
        <div className="flex flex-col items-center text-center gap-2">
          <span className="text-5xl leading-none select-none">
            {copy.icon === 'auto_awesome' ? '✨' :
             copy.icon === 'dashboard_customize' ? '📊' :
             copy.icon === 'summarize' ? '💡' :
             copy.icon === 'dashboard' ? '📊' :
             copy.icon === 'edit_note' ? '📝' :
             copy.icon === 'lightbulb' ? '💡' :
             copy.icon === 'mic' ? '🎙️' :
             copy.icon === 'my_location' ? '🎯' :
             copy.icon === 'history' ? '📅' :
             copy.icon === 'bar_chart' ? '📈' :
             copy.icon === 'download' ? '📤' :
             copy.icon === 'bolt' ? '⚡' :
             '🔒'}
          </span>
          <h2 className="text-[17px] font-semibold leading-snug">{copy.title}</h2>
          <p className="text-[14px] text-muted-foreground leading-relaxed">
            {copy.subtitle(current, limit)}
          </p>
        </div>

        {/* Mini plan cards */}
        <div className="flex flex-col gap-2 mt-1">
          {(['stars_basic', 'stars_pro'] as const).map((planTier) => {
            const info = TIER_INFO[planTier];
            const isRequired = planTier === requiredTier;
            return (
              <div
                key={planTier}
                className={`rounded-xl border px-3 py-2.5 ${isRequired ? 'border-primary/40 bg-primary/5' : 'border-border/30 bg-muted/20'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">{info.icon}</span>
                    <div>
                      <p className="text-[13px] font-semibold">{info.name}</p>
                      <p className="text-[11px] text-muted-foreground">{copy.comparisonText.split('·')[planTier === 'stars_basic' ? 0 : 1]?.trim()}</p>
                    </div>
                  </div>
                  <p className="text-[13px] font-bold">{info.priceStars} ⭐</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <p className="text-[13px] text-destructive text-center">{error}</p>
        )}
      </div>

      {/* CTA area */}
      <div className="px-4 pb-2 flex flex-col gap-2 mt-1">
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
            ctaLabel
          )}
        </Button>

        <Button
          variant="ghost"
          className="w-full min-h-[44px]"
          onClick={handleDismiss}
        >
          Не зараз
        </Button>
      </div>
    </BottomSheet>
  );
}
