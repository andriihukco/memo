'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/supabase/auth-context';
import { TIER_INFO, BILLING_PERIODS, calcPrice, type SubscriptionTier, type BillingPeriod } from '@/lib/stars/paywall';
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
  subscription_start_date?: string | null;
}

// ── BillingPeriodSwitcher ─────────────────────────────────────────────────────

function BillingPeriodSwitcher({
  selected,
  onChange,
}: {
  selected: BillingPeriod;
  onChange: (p: BillingPeriod) => void;
}) {
  const { play } = useSound();
  const periods: BillingPeriod[] = ['monthly', 'quarterly', 'annual'];

  return (
    <div className="flex rounded-2xl bg-white/10 p-1 gap-1">
      {periods.map((p) => {
        const info = BILLING_PERIODS[p];
        const isSelected = selected === p;
        return (
          <button
            key={p}
            onClick={() => { play('SELECT'); onChange(p); }}
            className={cn(
              'relative flex-1 flex flex-col items-center justify-center rounded-xl py-2 px-1 transition-all',
              isSelected ? 'bg-white/15 text-foreground' : 'text-foreground/60'
            )}
          >
            {info.badge && (
              <span className={cn(
                'absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap',
                isSelected ? 'bg-green-500 text-white' : 'bg-green-500/40 text-green-300'
              )}>
                {info.badge}
              </span>
            )}
            <span className="text-[13px] font-medium">{info.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── UsageSection ──────────────────────────────────────────────────────────────

function UsageSection({ accessToken, currentTier }: { accessToken: string | null | undefined; currentTier: SubscriptionTier }) {
  const { counts } = useUsageCounts(accessToken);
  const limits = TIER_INFO[currentTier].limits;

  const rows = [
    { label: 'Записи', icon: '📝', current: counts?.entries ?? 0, limit: limits.entries },
    { label: 'AI-віджети', icon: '📊', current: counts?.widgets ?? 0, limit: limits.ai_widgets },
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
                {isUnlimited ? `${row.current} / ∞` : `${row.current} / ${row.limit}`}
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
  tier, billingPeriod, isCurrent, isUpgrade, isExpiredRenewal, isLoading, anyPaying, onSubscribe,
}: {
  tier: SubscriptionTier;
  billingPeriod: BillingPeriod;
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

  const starsPrice = tier === 'free' ? 0 : calcPrice(info.priceStars, billingPeriod);
  const monthlyEquiv = billingPeriod !== 'monthly' && tier !== 'free'
    ? Math.round(starsPrice / BILLING_PERIODS[billingPeriod].months)
    : null;

  return (
    <div
      className={cn(
        'relative rounded-2xl border',
        isCurrent
          ? 'border-yellow-400/30 bg-yellow-950/30'
          : isBasic
            ? 'border-yellow-400/50 bg-yellow-950/40 mt-4'
            : 'border-white/10 bg-white/5',
      )}
    >
      {isBasic && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span className="rounded-full bg-yellow-400 px-3 py-0.5 text-[10px] font-semibold text-slate-950 whitespace-nowrap shadow-sm">
            Рекомендовано
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">{info.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[16px] font-semibold text-foreground">{info.name}</p>
              {isCurrent && (
                <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-medium text-yellow-300">
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
              <p className="text-[18px] font-bold leading-tight text-foreground">{starsPrice} ⭐</p>
              <p className="text-[10px] text-muted-foreground">
                {billingPeriod === 'monthly' ? '/ місяць' : `/ ${BILLING_PERIODS[billingPeriod].label.toLowerCase()}`}
              </p>
              {monthlyEquiv && (
                <p className="text-[10px] text-green-400">≈ {monthlyEquiv} ⭐/міс</p>
              )}
            </>
          )}
        </div>
      </div>

      <Separator className="opacity-20 mx-4" style={{ width: 'calc(100% - 2rem)' }} />

      {/* Features */}
      <div className="px-4 py-3 flex flex-col gap-1.5">
        {info.features.map((f, i) => (
          <div key={i} className={cn('flex items-center gap-2', !f.included && 'opacity-35')}>
            <span className={cn('text-[11px] font-bold w-3 shrink-0', f.included ? 'text-yellow-400/80' : 'text-muted-foreground')}>
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
              isPro || isBasic
                ? 'bg-yellow-400 text-slate-950'
                : isExpiredRenewal
                  ? 'bg-yellow-400 text-slate-950'
                  : 'bg-white/10 text-foreground',
              (isLoading || anyPaying) && 'opacity-60'
            )}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Відкриваємо...
              </span>
            ) : isExpiredRenewal ? (
              `Поновити — ${starsPrice} ⭐`
            ) : (
              `Підписатися — ${starsPrice} ⭐`
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
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

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
    if (!accessToken) return;
    if (!profile) {
      setError('Профіль не завантажено. Спробуй ще раз.');
      return;
    }
    setPaying(tier);
    setError(null);

    // Check Telegram WebApp availability upfront
    const tg = window.Telegram?.WebApp;
    if (!tg?.openInvoice) {
      setError('Відкрий у Telegram для оплати');
      setPaying(null);
      return;
    }

    // If user already has an active subscription, show stacking info before proceeding
    const currentEndsAt = profile.subscription_ends_at ? new Date(profile.subscription_ends_at) : null;
    const isCurrentlyActive = currentEndsAt && currentEndsAt > new Date() && profile.subscription_tier !== 'free';
    if (isCurrentlyActive) {
      const periodDays = BILLING_PERIODS[billingPeriod].days;
      const newEndsAt = new Date(currentEndsAt!.getTime() + periodDays * 24 * 60 * 60 * 1000);
      const fmtNewEnd = newEndsAt.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
      // Show info — user confirmed by tapping the button, so proceed
      setError(`ℹ️ Твоя підписка буде продовжена до ${fmtNewEnd}`);
      // Small delay so user sees the message, then open invoice
      await new Promise(r => setTimeout(r, 1800));
      setError(null);
    }

    try {
      const res = await fetch('/api/stars/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ tier, billingPeriod }),
      });
      const data = await res.json();
      if (!data.ok || !data.invoiceLink) {
        setError(data.error ?? 'Не вдалося створити рахунок');
        setPaying(null);
        return;
      }

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
        } else if (status === 'cancelled') {
          // user closed the payment sheet — no error needed, just reset
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Щось пішло не так. Спробуй ще раз.');
      setPaying(null);
    }
  }


  const currentTier = profile?.subscription_tier ?? 'free';
  const isCanceling = profile?.subscription_status === 'canceled' && currentTier !== 'free';
  const tierRank: Record<SubscriptionTier, number> = { free: 0, stars_basic: 1, stars_pro: 2 };
  const tiers = Object.keys(TIER_INFO) as SubscriptionTier[];

  const endsAt = profile?.subscription_ends_at ? new Date(profile.subscription_ends_at) : null;
  const startsAt = profile?.subscription_start_date ? new Date(profile.subscription_start_date) : null;
  const isExpired = endsAt ? endsAt < new Date() : false;
  const daysRemaining = endsAt && !isExpired
    ? Math.ceil((endsAt.getTime() - Date.now()) / 86400000)
    : null;
  const effectiveTier: SubscriptionTier = (currentTier !== 'free' && isExpired) ? 'free' : currentTier;

  const fmtDate = (d: Date) => d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
        {/* Header skeleton — centered, matches real title layout */}
        <div className="flex flex-col items-center gap-2 py-1">
          <div className="h-8 w-36 rounded-xl bg-muted/60 animate-pulse" />
          <div className="h-3.5 w-48 rounded-lg bg-muted/40 animate-pulse" />
        </div>
        {/* Plan card skeletons */}
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-2xl border border-border/30 bg-card/60 p-4 flex flex-col gap-3"
            style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-muted/60 animate-pulse" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-4 w-24 rounded-lg bg-muted/60 animate-pulse" />
                <div className="h-3 w-36 rounded-lg bg-muted/50 animate-pulse" />
              </div>
              <div className="h-6 w-16 rounded-lg bg-muted/60 animate-pulse" />
            </div>
            <div className="h-10 w-full rounded-xl bg-muted/40 animate-pulse" />
          </div>
        ))}
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
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.35 }} className="mb-2 text-[26px] font-bold">
              Дякуємо! 🎉
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.35 }} className="mb-1 text-[17px] font-semibold text-primary">
              {TIER_INFO[thankYouTier].name} активовано
            </motion.p>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.35 }} className="text-[14px] text-muted-foreground">
              Твоя підтримка дуже важлива для нас ❤️
            </motion.p>
            <motion.button
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.3 }}
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
          <h1 className="text-[28px] font-bold leading-tight text-foreground">Підписка</h1>
          <p className="text-[13px] text-muted-foreground">Підтримай Memo та отримай більше</p>
        </div>

        {/* Current plan details card */}
        {profile && effectiveTier !== 'free' && (
          <div className={cn(
            'rounded-2xl border px-4 py-3.5 flex flex-col gap-2',
            isExpired ? 'bg-destructive/10 border-destructive/20' : 'bg-primary/5 border-primary/20'
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{TIER_INFO[effectiveTier].icon}</span>
                <p className="text-[15px] font-semibold">{TIER_INFO[effectiveTier].name}</p>
              </div>
              {isExpired ? (
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">Закінчилась</span>
              ) : isCanceling ? (
                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">Скасовується</span>
              ) : (
                <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-400">Активна</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="rounded-xl bg-muted/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground mb-0.5">Початок</p>
                <p className="text-[12px] font-medium">{startsAt ? fmtDate(startsAt) : fmtDate(new Date())}</p>
              </div>
              {endsAt && (
                <div className={cn('rounded-xl px-3 py-2', isExpired ? 'bg-destructive/10' : daysRemaining !== null && daysRemaining <= 7 ? 'bg-amber-400/10' : 'bg-muted/30')}>
                  <p className="text-[10px] text-muted-foreground mb-0.5">{isExpired ? 'Закінчилась' : isCanceling ? 'Доступ до' : 'Діє до'}</p>
                  <p className={cn('text-[12px] font-medium', isExpired ? 'text-destructive' : daysRemaining !== null && daysRemaining <= 7 ? 'text-amber-300' : '')}>
                    {fmtDate(endsAt)}
                  </p>
                </div>
              )}
              {!endsAt && (
                <div className="rounded-xl bg-muted/30 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Діє до</p>
                  <p className="text-[12px] font-medium">∞</p>
                </div>
              )}
            </div>

            {daysRemaining !== null && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  {endsAt && (
                    <div
                      className={cn('h-full rounded-full', daysRemaining <= 7 ? 'bg-amber-400' : 'bg-primary')}
                      style={{
                        width: `${Math.max(5, Math.min(100, startsAt && endsAt
                          ? (daysRemaining / Math.ceil((endsAt.getTime() - startsAt.getTime()) / 86400000)) * 100
                          : (daysRemaining / 30) * 100
                        ))}%`
                      }}
                    />
                  )}
                </div>
                <span className={cn('text-[11px] font-medium shrink-0', daysRemaining <= 7 ? 'text-amber-300' : 'text-muted-foreground')}>
                  {daysRemaining === 1 ? '1 день' : `${daysRemaining} дн.`}
                </span>
              </div>
            )}

            {isExpired && endsAt && (
              <p className="text-[12px] text-destructive/70">
                Закінчилась {fmtDate(endsAt)} · Поновіть вручну нижче
              </p>
            )}
            {isCanceling && endsAt && !isExpired && (
              <p className="text-[12px] text-amber-300/80">
                Підписка скасована · Доступ діє до {fmtDate(endsAt)}
              </p>
            )}
          </div>
        )}

        {/* Free tier simple banner */}
        {effectiveTier === 'free' && !isExpired && (
          <div className="flex items-center gap-3 rounded-2xl bg-muted/30 px-4 py-3">
            <span className="text-2xl">{TIER_INFO['free'].icon}</span>
            <div>
              <p className="text-[14px] font-semibold">{TIER_INFO['free'].name}</p>
              <p className="text-[12px] text-muted-foreground">Безкоштовно назавжди</p>
            </div>
          </div>
        )}

        {/* Usage — shown for all tiers, ∞ for Supernova */}
        <UsageSection accessToken={accessToken} currentTier={effectiveTier} />

        {/* Billing period switcher — shown below usage stats */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">Період</p>
          <BillingPeriodSwitcher selected={billingPeriod} onChange={setBillingPeriod} />

        </div>

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
                billingPeriod={billingPeriod}
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
          Telegram Stars · Поновлення вручну · Без автосписання
        </p>
      </motion.div>
    </>
  );
}
