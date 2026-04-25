'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import { TIER_INFO, type SubscriptionTier } from '@/lib/stars/paywall';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { ErrorBanner } from '@/components/ui/error-banner';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useUsageCounts } from '@/lib/hooks/use-usage-counts';
import { cn } from '@/lib/utils';
import { useSound } from '@/lib/sound/use-sound';

interface ProfileData {
  id: string;
  subscription_tier: SubscriptionTier;
  subscription_status: string;
  subscription_ends_at: string | null;
}

// ── CurrentPlanBanner ─────────────────────────────────────────────────────────

interface CurrentPlanBannerProps {
  profile: ProfileData;
  currentTier: SubscriptionTier;
}

function CurrentPlanBanner({ profile, currentTier }: CurrentPlanBannerProps) {
  const info = TIER_INFO[currentTier];

  const daysRemaining =
    profile.subscription_ends_at
      ? Math.ceil(
          (new Date(profile.subscription_ends_at).getTime() - Date.now()) / 86400000
        )
      : null;

  const showExpiryWarning =
    daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
      <span className="text-2xl">{info.icon}</span>
      <div className="flex-1">
        <p className="text-[15px] font-semibold">Поточний план: {info.name}</p>
        {profile.subscription_ends_at && (
          <p className="text-[13px] text-muted-foreground">
            До {new Date(profile.subscription_ends_at).toLocaleDateString('uk-UA')}
          </p>
        )}
        {currentTier !== 'free' && !profile.subscription_ends_at && (
          <p className="text-[13px] text-green-500">Постійний доступ</p>
        )}
        {currentTier === 'free' && (
          <p className="text-[13px] text-muted-foreground">Безкоштовно назавжди</p>
        )}
      </div>
      {showExpiryWarning && daysRemaining !== null && (
        <span className="rounded-full bg-amber-400/15 border border-amber-400/30 px-2.5 py-1 text-[11px] font-medium text-amber-300">
          Закінчується через {daysRemaining} {daysRemaining === 1 ? 'день' : daysRemaining < 5 ? 'дні' : 'днів'}
        </span>
      )}
    </div>
  );
}

// ── UsageRow ──────────────────────────────────────────────────────────────────

interface UsageRowProps {
  label: string;
  current: number;
  limit: number;
}

function UsageRow({ label, current, limit }: UsageRowProps) {
  const isUnlimited = limit === Infinity;
  const pct = isUnlimited ? 0 : Math.min(Math.round((current / limit) * 100), 100);
  const completed = !isUnlimited && pct >= 100;

  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-[13px] text-muted-foreground">{label}</span>
      <span className="w-20 text-[13px] text-foreground/80 tabular-nums">
        {isUnlimited ? 'Необмежено' : `${current} / ${limit}`}
      </span>
      {!isUnlimited && (
        <ProgressBar
          value={pct}
          completed={completed}
          className="w-16 flex-none"
        />
      )}
    </div>
  );
}

// ── UsageSection ──────────────────────────────────────────────────────────────

interface UsageSectionProps {
  accessToken: string | null | undefined;
  currentTier: SubscriptionTier;
}

function UsageSection({ accessToken, currentTier }: UsageSectionProps) {
  const { counts } = useUsageCounts(accessToken);
  const limits = TIER_INFO[currentTier].limits;

  return (
    <div className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-3">
      <p className="mb-3 text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
        Використання
      </p>
      <div className="flex flex-col gap-2.5">
        <UsageRow
          label="Записи"
          current={counts?.entries ?? 0}
          limit={limits.entries}
        />
        <UsageRow
          label="Віджети"
          current={counts?.widgets ?? 0}
          limit={limits.widgets}
        />
        <UsageRow
          label="Звіти"
          current={counts?.reports ?? 0}
          limit={limits.reports}
        />
      </div>
    </div>
  );
}

// ── PlanCard ──────────────────────────────────────────────────────────────────

interface PlanCardProps {
  tier: SubscriptionTier;
  isCurrent: boolean;
  isUpgrade: boolean;
  isLoading: boolean;
  anyPaying: boolean;
  onSubscribe: (tier: SubscriptionTier) => void;
}

function PlanCard({
  tier,
  isCurrent,
  isUpgrade,
  isLoading,
  anyPaying,
  onSubscribe,
}: PlanCardProps) {
  const info = TIER_INFO[tier];
  const isBasic = tier === 'stars_basic';
  const isPro = tier === 'stars_pro';
  const { play } = useSound();

  return (
    <div
      className={cn(
        'relative rounded-2xl border p-4 transition-all',
        isCurrent
          ? 'border-primary/40 bg-primary/5'
          : 'border-border/50 bg-card'
      )}
    >
      {/* "Найпопулярніший" badge on Basic */}
      {isBasic && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-sm">
            Найпопулярніший
          </span>
        </div>
      )}

      {/* Header */}
      <div className={cn('mb-3 flex items-center justify-between', isBasic && 'mt-1')}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{info.icon}</span>
          <div>
            <p className="text-[17px] font-semibold leading-tight">{info.name}</p>
            <p className="text-[13px] text-muted-foreground">{info.description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isCurrent && (
            <Badge variant="outline" className="text-[11px] border-primary/40 text-primary">
              Активний
            </Badge>
          )}
          {tier !== 'free' && (
            <div className="text-right">
              <p className="text-[17px] font-bold">{info.priceStars} ⭐</p>
              <p className="text-[11px] text-muted-foreground">/ місяць</p>
            </div>
          )}
          {tier === 'free' && !isCurrent && (
            <p className="text-[13px] text-muted-foreground">Безкоштовно</p>
          )}
        </div>
      </div>

      <Separator className="mb-3 opacity-50" />

      {/* 14 feature rows */}
      <ul className="mb-4 space-y-1.5">
        {info.features.map((f, i) => (
          <li
            key={i}
            className={cn(
              'flex items-center gap-2 text-[15px]',
              !f.included && 'opacity-40'
            )}
          >
            <span
              className={cn(
                'text-[13px] font-bold',
                f.included ? 'text-green-500' : 'text-muted-foreground'
              )}
            >
              {f.included ? '✓' : '✗'}
            </span>
            <span className="text-foreground/80">{f.label}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isUpgrade && (
        <button
          onClick={() => {
            play('BUTTON');
            onSubscribe(tier);
          }}
          disabled={isLoading || anyPaying}
          aria-disabled={isLoading || anyPaying}
          className={cn(
            'w-full rounded-xl py-3 text-[15px] font-semibold transition-all active:scale-95 min-h-[44px]',
            isPro
              ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-slate-950 shadow-lg shadow-yellow-400/20'
              : 'bg-primary text-primary-foreground',
            (isLoading || anyPaying) && 'cursor-not-allowed opacity-60'
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Відкриваємо оплату...
            </span>
          ) : (
            `Підписатися за ${info.priceStars} ⭐`
          )}
        </button>
      )}
      {isCurrent && tier !== 'free' && (
        <p className="text-center text-[13px] text-muted-foreground">Підписка активна</p>
      )}
      {tier === 'free' && isCurrent && (
        <p className="text-center text-[13px] text-muted-foreground">Безкоштовно назавжди</p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const { play } = useSound();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<SubscriptionTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      setProfile(data.profile);
    } catch (err) {
      console.error('loadProfile error:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function handleSubscribe(tier: SubscriptionTier) {
    if (!accessToken || !profile) return;
    setPaying(tier);
    setError(null);

    try {
      // 1. Get invoice link from our backend
      const res = await fetch('/api/stars/invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ userId: profile.id, tier }),
      });

      const data = await res.json();
      if (!data.ok || !data.invoiceLink) {
        setError(data.error ?? 'Failed to create invoice');
        setPaying(null);
        return;
      }

      // 2. Open Telegram Stars payment UI
      const tg = window.Telegram?.WebApp;
      if (!tg?.openInvoice) {
        setError('Please open this in Telegram');
        setPaying(null);
        return;
      }

      tg.openInvoice(data.invoiceLink, async (status) => {
        setPaying(null);
        if (status === 'paid') {
          setSuccessMsg(`✅ Підписка ${TIER_INFO[tier].name} активована!`);
          // Reload profile to reflect new tier
          await loadProfile();
        } else if (status === 'cancelled') {
          // User cancelled — no error
        } else if (status === 'failed') {
          setError('Оплата не вдалася. Спробуй ще раз.');
        }
      });
    } catch (err) {
      console.error('handleSubscribe error:', err);
      setError('Щось пішло не так');
      setPaying(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </div>
    );
  }

  const currentTier = profile?.subscription_tier ?? 'free';
  const tierRank: Record<SubscriptionTier, number> = { free: 0, stars_basic: 1, stars_pro: 2 };
  const tiers = Object.keys(TIER_INFO) as SubscriptionTier[];

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8">
      {/* iOS_Large_Title header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            play('SLIDE');
            router.back();
          }}
          className="flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-muted/50 text-muted-foreground active:bg-muted"
          aria-label="Назад"
        >
          <Icon name="arrow_back" size={20} />
        </button>
        <div>
          <h1 className="text-[28px] font-bold leading-tight">Підписка</h1>
          <p className="text-[13px] text-muted-foreground">
            Підтримай Memo та отримай більше можливостей
          </p>
        </div>
      </div>

      {/* CurrentPlanBanner */}
      {profile && (
        <CurrentPlanBanner profile={profile} currentTier={currentTier} />
      )}

      {/* UsageSection — shown for non-Pro users */}
      {currentTier !== 'stars_pro' && (
        <UsageSection accessToken={accessToken} currentTier={currentTier} />
      )}

      {/* Success message */}
      {successMsg && (
        <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-[15px] text-green-600">
          {successMsg}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <ErrorBanner
          message={error}
          onDismiss={() => setError(null)}
          onRetry={undefined}
        />
      )}

      {/* Three full PlanCards */}
      <div className="flex flex-col gap-4">
        {tiers.map((tier) => {
          const isCurrent = currentTier === tier;
          const isUpgrade = tierRank[tier] > tierRank[currentTier];
          const isLoading = paying === tier;

          return (
            <PlanCard
              key={tier}
              tier={tier}
              isCurrent={isCurrent}
              isUpgrade={isUpgrade}
              isLoading={isLoading}
              anyPaying={paying !== null}
              onSubscribe={handleSubscribe}
            />
          );
        })}
      </div>

      {/* Footer note */}
      <p className="text-center text-[11px] text-muted-foreground px-4">
        Оплата через Telegram Stars · Підписка на 30 днів · Поновлення вручну
      </p>
    </div>
  );
}
