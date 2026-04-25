'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useSound } from '@/lib/sound/use-sound';
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

  const copy = PAYWALL_COPY[feature] ?? FALLBACK_COPY;
  const tierInfo = TIER_INFO[requiredTier];

  // Play CAUTION when the sheet opens
  useEffect(() => {
    if (open) {
      play('CAUTION');
    }
  }, [open, play]);

  const handleUpgrade = () => {
    play('OPEN');
    router.push('/miniapp/subscriptions');
  };

  const handleDismiss = () => {
    play('CLOSE');
    onClose();
  };

  const ctaLabel =
    requiredTier === 'stars_pro'
      ? `Перейти на Pro — ${tierInfo.priceStars} ⭐`
      : `Перейти на Basic — ${tierInfo.priceStars} ⭐`;

  return (
    <BottomSheet open={open} onClose={handleDismiss}>
      {/* Content area */}
      <div className="flex flex-col items-center text-center gap-4 px-4 pt-2 pb-2">
        {/* Feature icon */}
        <Icon
          name={copy.icon}
          size={48}
          className="text-amber-400"
          aria-hidden
        />

        {/* Title */}
        <h2 className="text-[17px] font-semibold leading-snug">{copy.title}</h2>

        {/* Subtitle / usage description */}
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          {copy.subtitle(current, limit)}
        </p>

        {/* Feature comparison row */}
        <div className="w-full bg-muted/40 rounded-xl px-4 py-3">
          <p className="text-[13px] text-muted-foreground">{copy.comparisonText}</p>
        </div>
      </div>

      {/* CTA area */}
      <div className="px-4 pb-2 flex flex-col gap-3 mt-2">
        <Button
          variant="default"
          className="w-full min-h-[44px]"
          onClick={handleUpgrade}
        >
          {ctaLabel}
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
