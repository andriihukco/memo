'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import { TIER_INFO, type SubscriptionTier } from '@/lib/stars/paywall';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useSound } from '@/lib/sound/use-sound';

interface ProfileData {
  id: string;
  subscription_tier: SubscriptionTier;
  subscription_status: string;
  subscription_ends_at: string | null;
}

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

  useEffect(() => { loadProfile(); }, [loadProfile]);

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

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8">
      {/* Back header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { play('CLOSE'); router.back(); }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 text-muted-foreground active:bg-muted"
          aria-label="Назад"
        >
          <Icon name="arrow_back" size={20} />
        </button>
        <h1 className="text-xl font-bold">Підписка</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">Підтримай Memo та отримай більше можливостей</p>

      {/* Current plan badge */}
      <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
        <span className="text-2xl">{TIER_INFO[currentTier].icon}</span>
        <div>
          <p className="text-sm font-semibold">Поточний план: {TIER_INFO[currentTier].name}</p>
          {profile?.subscription_ends_at && (
            <p className="text-xs text-muted-foreground">
              До {new Date(profile.subscription_ends_at).toLocaleDateString('uk-UA')}
            </p>
          )}
          {currentTier !== 'free' && !profile?.subscription_ends_at && (
            <p className="text-xs text-green-500">Постійний доступ</p>
          )}
        </div>
      </div>

      {/* Success / Error messages */}
      {successMsg && (
        <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-600">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Plans */}
      <div className="flex flex-col gap-3">
        {(Object.keys(TIER_INFO) as SubscriptionTier[]).map((tier) => {
          const info = TIER_INFO[tier];
          const isCurrent = currentTier === tier;
          const isUpgrade = tierRank[tier] > tierRank[currentTier];
          const isLoading = paying === tier;

          return (
            <div
              key={tier}
              className={cn(
                'rounded-2xl border p-4 transition-all',
                isCurrent
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border/50 bg-card'
              )}
            >
              {/* Header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{info.icon}</span>
                  <div>
                    <p className="font-semibold leading-tight">{info.name}</p>
                    <p className="text-xs text-muted-foreground">{info.description}</p>
                  </div>
                </div>
                {isCurrent && <Badge variant="outline" className="text-xs border-primary/40 text-primary">Активний</Badge>}
                {tier !== 'free' && (
                  <div className="text-right">
                    <p className="font-bold text-base">{info.priceStars} ⭐</p>
                    <p className="text-[10px] text-muted-foreground">/ місяць</p>
                  </div>
                )}
              </div>

              <Separator className="mb-3 opacity-50" />

              {/* Features */}
              <ul className="mb-4 space-y-1.5">
                {info.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-green-500 text-xs">✓</span>
                    <span className="text-foreground/80">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {isUpgrade && (
                <button
                  onClick={() => { play('BUTTON'); handleSubscribe(tier); }}
                  disabled={isLoading || paying !== null}
                  className={cn(
                    'w-full rounded-xl py-3 text-sm font-semibold transition-all active:scale-95',
                    tier === 'stars_pro'
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-slate-950 shadow-lg shadow-yellow-400/20'
                      : 'bg-primary text-primary-foreground',
                    (isLoading || paying !== null) && 'opacity-60 cursor-not-allowed'
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
                <p className="text-center text-xs text-muted-foreground">Підписка активна</p>
              )}
              {tier === 'free' && isCurrent && (
                <p className="text-center text-xs text-muted-foreground">Безкоштовно назавжди</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground px-4">
        Оплата через Telegram Stars · Підписка на 30 днів · Поновлення вручну
      </p>
    </div>
  );
}
