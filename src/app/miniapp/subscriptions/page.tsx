'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/supabase/auth-context';
import { TIER_INFO, type SubscriptionTier } from '@/lib/stars/paywall';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Separator } from '@/components/ui/separator';
import { useUsageCounts } from '@/lib/hooks/use-usage-counts';
import { cn } from '@/lib/utils';
import { useSound } from '@/lib/sound/use-sound';
import { Confetti } from '@/components/ui/confetti';

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
  tier, isCurrent, isUpgrade, isExpiredRenewal, isLoading, anyPaying, onSubscribe,
}: {
  tier: SubscriptionTier;
  isCurrent: boolean;
  isUpgrade: boolean;
  isExpiredRenewal: boolean;
  isLoading: boolean;
  anyPaying: boolean;
  onSubscribe: (tier: SubscriptionTier) => void;
}) {
  const info = TIER_INFO[tier];
  const { play } = useSound();
  const isBasic = tier === 'stars_basic';
  const isPro = tier === 'stars_pro';
  const showCTA = isUpgrade || isExpiredRenewal;

  return (
    <div
      className={cn(
        'relative rounded-2xl border',
        isCurrent ? 'border-primary/40 bg-primary/5' : 'border-border/40 bg-card/60',
        isBasic && !isCurrent && 'border-primary/30',
        isBasic && !isCurrent && 'mt-4'
      )}
    >
      {isBasic && !isCurrent && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
          <span className="rounded-full bg-primary px-3 py-0.5 text-[10px] font-semibold text-primary-foreground whitespace-nowrap shadow-sm">
            🔥 Найпопулярніший
          </span>
        </div>
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

      {/* CTA */}
      {showCTA && (
        <div className="px-4 pb-4">
          <button
            onClick={() => { play('BUTTON'); onSubscribe(tier); }}
            disabled={isLoading || anyPaying}
            className={cn(
              'w-full rounded-xl py-3 text-[14px] font-semibold transition-all active:scale-[0.98] min-h-[44px]',
              isPro
                ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-slate-950'
                : isExpiredRenewal
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-primary text-primary-foreground',
              (isLoading || anyPaying) && 'opacity-60'
            )}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Відкриваємо...
              </span>
            ) : isExpiredRenewal ? (
              `Поновити — ${info.priceStars} ⭐`
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
  const [confetti, setConfetti] = useState(false);
  const [thankYouTier, setThankYouTier] = useState<SubscriptionTier | null>(null);

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
          setConfetti(true);
          setThankYouTier(tier);
          setTimeout(() => setConfetti(false), 3500);
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

  const endsAt = profile?.subscription_ends_at ? new Date(profile.subscription_ends_at) : null;
  const isExpired = endsAt ? endsAt < new Date() : false;
  const daysRemaining = endsAt && !isExpired
    ? Math.ceil((endsAt.getTime() - Date.now()) / 86400000)
    : null;

  // Effective tier — if expired, treat as free
  const effectiveTier: SubscriptionTier = (currentTier !== 'free' && isExpired) ? 'free' : currentTier;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </div>
    );
  }

  return (
    <>
      <Confetti active={confetti} />

      {/* Thank-you overlay */}
      <AnimatePresence>
        {thankYouTier && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm px-8 text-center"
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
              className="mb-6 text-7xl leading-none select-none"
            >
              {TIER_INFO[thankYouTier].icon}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
              className="mb-2 text-[26px] font-bold"
            >
              Дякуємо! 🎉
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.35 }}
              className="mb-1 text-[17px] font-semibold text-primary"
            >
              {TIER_INFO[thankYouTier].name} активовано
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.35 }}
              className="text-[14px] text-muted-foreground"
            >
              Твоя підтримка дуже важлива для нас ❤️
            </motion.p>
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.3 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setThankYouTier(null)}
              className="mt-8 rounded-full bg-primary px-8 py-3.5 text-[15px] font-semibold text-primary-foreground"
            >
              Чудово →
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-4 px-4 pt-5 pb-10"
      >
        {/* Header */}
        <div className="text-center">
          <h1 className="text-[28px] font-bold leading-tight">Підписка</h1>
          <p className="text-[13px] text-muted-foreground">Підтримай Memo та отримай більше</p>
        </div>

        {/* Current plan banner */}
        {profile && (
          <div className={cn(
            'flex items-center gap-3 rounded-2xl px-4 py-3',
            isExpired ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted/30'
          )}>
            <span className="text-2xl">{TIER_INFO[effectiveTier].icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[14px] font-semibold">{TIER_INFO[effectiveTier].name}</p>
                {isExpired && (
                  <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
                    Закінчилась
                  </span>
                )}
                {!isExpired && effectiveTier !== 'free' && (
                  <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-400">
                    Активна
                  </span>
                )}
              </div>
              {effectiveTier === 'free' && !isExpired && (
                <p className="text-[12px] text-muted-foreground">Безкоштовно назавжди</p>
              )}
              {effectiveTier !== 'free' && endsAt && !isExpired && (
                <p className="text-[12px] text-muted-foreground">
                  До {endsAt.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
              {isExpired && endsAt && (
                <p className="text-[12px] text-destructive/70">
                  Закінчилась {endsAt.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })} · Поновіть вручну
                </p>
              )}
            </div>
            {daysRemaining !== null && daysRemaining <= 7 && (
              <span className="rounded-full bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 text-[11px] text-amber-300 shrink-0">
                {daysRemaining === 1 ? '1 день' : `${daysRemaining} дні`}
              </span>
            )}
          </div>
        )}

        {/* Billing note */}
        {effectiveTier !== 'free' && !isExpired && (
          <div className="flex items-start gap-2 rounded-xl bg-muted/20 px-3 py-2.5">
            <span className="text-[13px] leading-none mt-0.5">ℹ️</span>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Підписка на 30 днів. Telegram Stars не підтримує автоматичне поновлення — поновіть вручну до закінчення терміну.
            </p>
          </div>
        )}

        {/* Usage */}
        {effectiveTier !== 'stars_pro' && (
          <UsageSection accessToken={accessToken} currentTier={effectiveTier} />
        )}

        {/* Error */}
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {/* Plan cards */}
        <div className="flex flex-col gap-4 pt-2">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            >
              <PlanCard
                tier={tier}
                isCurrent={effectiveTier === tier}
                isUpgrade={tierRank[tier] > tierRank[effectiveTier]}
                isExpiredRenewal={isExpired && currentTier === tier}
                isLoading={paying === tier}
                anyPaying={paying !== null}
                onSubscribe={handleSubscribe}
              />
            </motion.div>
          ))}
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          Telegram Stars · 30 днів · Поновлення вручну
        </p>
      </motion.div>
    </>
  );
}
