'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { TIER_INFO, type SubscriptionTier } from '@/lib/stars/paywall';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Separator } from '@/components/ui/separator';
import { useUsageCounts } from '@/lib/hooks/use-usage-counts';
import { cn } from '@/lib/utils';
import { useSound } from '@/lib/sound/use-sound';

interface ProfileData {
  id: string;
  subscription_tier: SubscriptionTier;
  subscription_status: string;
  subscription_ends_at: string | null;
}

// ── UsageSection ──────────────────────────────────────────────────────────────

function UsageSection({ accessToken, currentTier }: { accessToken: string | null | undefined; currentTier: SubscriptionTier }) {
  const { counts } = useUsageCounts(accessToken);
  const limits = TIER_INFO[currentTier].limits;

  const rows = [
    { label: 'Записи', icon: '📝', current: counts?.entries ?? 0, limit: limits.entries },
    { label: 'Віджети', icon: '📊', current: counts?.widgets ?? 0, limit: limits.widgets },
    { label: 'Звіти', icon: '💡', current: counts?.reports ?? 0, limit: limits.reports },
  ];

  return (
    <div className="rounded-2xl bg-muted/20 overflow-hidden">
      <div className="px-4 pt-3.5 pb-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Використання</p>
      </div>
      {rows.map((row, i) => {
        const isUnlimited = row.limit === Infinity;
        const pct = isUnlimited ? 0 : Math.min(Math.round((row.current / row.limit) * 100), 100);
        const isHigh = pct >= 80;
        return (
          <div key={row.label}>
            {i > 0 && <div className="mx-4 h-px bg-border/30" />}
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-base leading-none">{row.icon}</span>
              <span className="flex-1 text-[14px] text-foreground/80">{row.label}</span>
              <span className="text-[13px] font-medium tabular-nums text-muted-foreground">
                {isUnlimited ? '∞' : `${row.current} / ${row.limit}`}
              </span>
              {!isUnlimited && (
                <div className="w-16 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', isHigh ? 'bg-amber-400' : 'bg-primary/70')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div className="h-1" />
    </div>
  );
}

// ── PlanCard ──────────────────────────────────────────────────────────────────

function PlanCard({
  tier, isCurrent, isUpgrade, isLoading, anyPaying, onSubscribe,
}: {
  tier: SubscriptionTier;
  isCurrent: boolean;
  isUpgrade: boolean;
  isLoading: boolean;
  anyPaying: boolean;
  onSubscribe: (tier: SubscriptionTier) => void;
}) {
  const info = TIER_INFO[tier];
  const { play } = useSound();
  const isBasic = tier === 'stars_basic';
  const isPro = tier === 'stars_pro';

  return (
    <div
      className={cn(
        'relative rounded-2xl border overflow-hidden',
        isCurrent ? 'border-primary/40 bg-primary/5' : 'border-border/40 bg-card/60',
        isBasic && !isCurrent && 'border-primary/30'
      )}
    >
      {isBasic && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">{info.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[16px] font-semibold">{info.name}</p>
              {isCurrent && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Активний
                </span>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground">{info.description}</p>
          </div>
        </div>
        <div className="text-right shrink-0 ml-2">
          {tier === 'free' ? (
            <p className="text-[14px] font-semibold text-muted-foreground">Безкоштовно</p>
          ) : (
            <>
              <p className="text-[18px] font-bold leading-tight">{info.priceStars} ⭐</p>
              <p className="text-[10px] text-muted-foreground">/ місяць</p>
            </>
          )}
        </div>
      </div>

      <Separator className="opacity-30 mx-4" style={{ width: 'calc(100% - 2rem)' }} />

      {/* Features */}
      <div className="px-4 py-3 flex flex-col gap-1.5">
        {info.features.map((f, i) => (
          <div key={i} className={cn('flex items-center gap-2', !f.included && 'opacity-35')}>
            <span className={cn('text-[12px] font-bold w-3 shrink-0', f.included ? 'text-green-400' : 'text-muted-foreground')}>
              {f.included ? '✓' : '✗'}
            </span>
            <span className="text-[13px] text-foreground/80">{f.label}</span>
          </div>
        ))}
      </div>

      {/* CTA — outside the card content, full width */}
      {isUpgrade && (
        <div className="px-4 pb-4">
          <button
            onClick={() => { play('BUTTON'); onSubscribe(tier); }}
            disabled={isLoading || anyPaying}
            className={cn(
              'w-full rounded-xl py-3 text-[14px] font-semibold transition-all active:scale-[0.98] min-h-[44px]',
              isPro
                ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-slate-950'
                : 'bg-primary text-primary-foreground',
              (isLoading || anyPaying) && 'opacity-60'
            )}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Відкриваємо...
              </span>
            ) : (
              `Підписатися — ${info.priceStars} ⭐`
            )}
          </button>
        </div>
      )}
      {isCurrent && tier !== 'free' && (
        <p className="text-center text-[12px] text-muted-foreground pb-3">Підписка активна</p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const { accessToken } = useAuth();
  const { play } = useSound();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<SubscriptionTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setProfile(data.profile);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  async function handleSubscribe(tier: SubscriptionTier) {
    if (!accessToken || !profile) return;
    setPaying(tier);
    setError(null);
    try {
      const res = await fetch('/api/stars/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userId: profile.id, tier }),
      });
      const data = await res.json();
      if (!data.ok || !data.invoiceLink) { setError(data.error ?? 'Помилка'); setPaying(null); return; }

      const tg = window.Telegram?.WebApp;
      if (!tg?.openInvoice) { setError('Відкрий у Telegram'); setPaying(null); return; }

      tg.openInvoice(data.invoiceLink, async (status) => {
        setPaying(null);
        if (status === 'paid') {
          play('CELEBRATION');
          setSuccessMsg(`✅ ${TIER_INFO[tier].name} активовано!`);
          await loadProfile();
        } else if (status === 'failed') {
          setError('Оплата не вдалася. Спробуй ще раз.');
        }
        // cancelled — stay on page, do nothing
      });
    } catch {
      setError('Щось пішло не так');
      setPaying(null);
    }
  }

  const currentTier = profile?.subscription_tier ?? 'free';
  const tierRank: Record<SubscriptionTier, number> = { free: 0, stars_basic: 1, stars_pro: 2 };
  const tiers = Object.keys(TIER_INFO) as SubscriptionTier[];

  const daysRemaining = profile?.subscription_ends_at
    ? Math.ceil((new Date(profile.subscription_ends_at).getTime() - Date.now()) / 86400000)
    : null;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-bold leading-tight">Підписка</h1>
        <p className="text-[13px] text-muted-foreground">Підтримай Memo та отримай більше</p>
      </div>

      {/* Current plan banner */}
      {profile && (
        <div className="flex items-center gap-3 rounded-2xl bg-muted/30 px-4 py-3">
          <span className="text-2xl">{TIER_INFO[currentTier].icon}</span>
          <div className="flex-1">
            <p className="text-[14px] font-semibold">{TIER_INFO[currentTier].name}</p>
            {currentTier === 'free' && <p className="text-[12px] text-muted-foreground">Безкоштовно назавжди</p>}
            {currentTier !== 'free' && profile.subscription_ends_at && (
              <p className="text-[12px] text-muted-foreground">
                До {new Date(profile.subscription_ends_at).toLocaleDateString('uk-UA')}
              </p>
            )}
          </div>
          {daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7 && (
            <span className="rounded-full bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 text-[11px] text-amber-300">
              {daysRemaining} {daysRemaining === 1 ? 'день' : 'дні'}
            </span>
          )}
        </div>
      )}

      {/* Usage */}
      {currentTier !== 'stars_pro' && (
        <UsageSection accessToken={accessToken} currentTier={currentTier} />
      )}

      {/* Success */}
      {successMsg && (
        <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-[14px] text-green-500">
          {successMsg}
        </div>
      )}

      {/* Error */}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Plan cards */}
      <div className="flex flex-col gap-4">
        {tiers.map((tier) => (
          <PlanCard
            key={tier}
            tier={tier}
            isCurrent={currentTier === tier}
            isUpgrade={tierRank[tier] > tierRank[currentTier]}
            isLoading={paying === tier}
            anyPaying={paying !== null}
            onSubscribe={handleSubscribe}
          />
        ))}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Telegram Stars · 30 днів · Поновлення вручну
      </p>
    </div>
  );
}
