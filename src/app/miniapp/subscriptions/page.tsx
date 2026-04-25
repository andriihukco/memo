'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { TIER_INFO, type SubscriptionTier } from '@/lib/stars/paywall';
import { ErrorBanner } from '@/components/ui/error-banner';
import { useUsageCounts } from '@/lib/hooks/use-usage-counts';
import { cn } from '@/lib/utils';
import { useSound } from '@/lib/sound/use-sound';

interface ProfileData {
  id: string;
  subscription_tier: SubscriptionTier;
  subscription_status: string;
  subscription_ends_at: string | null;
}

// ── UsageBar ──────────────────────────────────────────────────────────────────

function UsageBar({ label, current, limit }: { label: string; current: number; limit: number }) {
  const isUnlimited = limit === Infinity;
  const pct = isUnlimited ? 0 : Math.min(Math.round((current / limit) * 100), 100);
  const isHigh = pct >= 80;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <span className="text-[13px] font-medium tabular-nums">
          {isUnlimited ? '∞' : `${current} / ${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className={cn('h-full rounded-full transition-all', isHigh ? 'bg-amber-400' : 'bg-primary/70')}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── PlanRow — compact iOS-style plan row ──────────────────────────────────────

function PlanRow({
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
  const isFree = tier === 'free';
  const isBasic = tier === 'stars_basic';

  return (
    <div
      className={cn(
        'relative rounded-2xl border px-4 py-4 transition-all',
        isCurrent ? 'border-primary/40 bg-primary/5' : 'border-border/40 bg-card/60',
        isBasic && !isCurrent && 'border-primary/30'
      )}
    >
      {isBasic && (
        <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
          Популярний
        </span>
      )}

      <div className="flex items-center gap-3">
        <span className="text-2xl leading-none">{info.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-semibold">{info.name}</p>
            {isCurrent && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                Активний
              </span>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground">{info.description}</p>
        </div>
        <div className="shrink-0 text-right">
          {isFree ? (
            <p className="text-[13px] text-muted-foreground">Безкоштовно</p>
          ) : (
            <>
              <p className="text-[15px] font-bold">{info.priceStars} ⭐</p>
              <p className="text-[10px] text-muted-foreground">/ міс</p>
            </>
          )}
        </div>
      </div>

      {/* Feature list — compact */}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {info.features.filter(f => f.included).slice(0, 4).map((f, i) => (
          <span key={i} className="text-[11px] text-muted-foreground">
            ✓ {f.label}
          </span>
        ))}
      </div>

      {/* CTA */}
      {isUpgrade && (
        <button
          onClick={() => { play('BUTTON'); onSubscribe(tier); }}
          disabled={isLoading || anyPaying}
          className={cn(
            'mt-3 w-full rounded-xl py-2.5 text-[14px] font-semibold transition-all active:scale-[0.98] min-h-[44px]',
            tier === 'stars_pro'
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
  const { counts } = useUsageCounts(accessToken);

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
      });
    } catch {
      setError('Щось пішло не так');
      setPaying(null);
    }
  }

  const currentTier = profile?.subscription_tier ?? 'free';
  const tierRank: Record<SubscriptionTier, number> = { free: 0, stars_basic: 1, stars_pro: 2 };
  const tiers = Object.keys(TIER_INFO) as SubscriptionTier[];
  const limits = TIER_INFO[currentTier].limits;

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
    <div className="flex flex-col gap-5 px-4 pt-5 pb-10">
      {/* Header — no back button, layout provides it */}
      <div>
        <h1 className="text-[28px] font-bold leading-tight">Підписка</h1>
        <p className="text-[13px] text-muted-foreground">Підтримай Memo та отримай більше</p>
      </div>

      {/* Current plan + expiry */}
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
      {currentTier !== 'stars_pro' && counts && (
        <div className="rounded-2xl bg-muted/20 px-4 py-3.5 flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Використання</p>
          <UsageBar label="Записи" current={counts.entries} limit={limits.entries} />
          <UsageBar label="Віджети" current={counts.widgets} limit={limits.widgets} />
          <UsageBar label="Звіти" current={counts.reports} limit={limits.reports} />
        </div>
      )}

      {/* Success */}
      {successMsg && (
        <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-[14px] text-green-500">
          {successMsg}
        </div>
      )}

      {/* Error */}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Plan rows */}
      <div className="flex flex-col gap-3">
        {tiers.map((tier) => (
          <PlanRow
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
