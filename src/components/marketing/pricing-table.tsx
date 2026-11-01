'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check } from 'lucide-react';
import { BILLING_PERIODS, TIER_INFO, calcPrice, type BillingPeriod, type SubscriptionTier } from '@/lib/billing/plans';
import { fill, type Dict } from '@/lib/marketing/dict';
import { cn } from '@/lib/utils';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const TIERS: SubscriptionTier[] = ['free', 'stars_basic', 'stars_pro'];

/** Feature flags per tier, mirrored from TIER_INFO in src/lib/billing/plans.ts. */
const FLAGS: Record<SubscriptionTier, (keyof Dict['pricing']['rows'])[]> = {
  free: ['encryption', 'pin'],
  stars_basic: ['aiRetro', 'aiRecs', 'goals', 'graph', 'encryption', 'pin'],
  stars_pro: ['aiRetro', 'aiRecs', 'goals', 'graph', 'priority', 'encryption', 'pin'],
};

function limitRows(tier: SubscriptionTier, t: Dict['pricing']['rows']) {
  const l = TIER_INFO[tier].limits;
  const n = (v: number, key: 'entries' | 'aiWidgets' | 'reports') =>
    fill(t[key], { n: Number.isFinite(v) ? v.toLocaleString('en-US') : t.unlimited });
  const history = !Number.isFinite(l.historyDays) ? t.historyAll : l.historyDays >= 365 ? t.historyYear : fill(t.historyDays, { n: l.historyDays });
  return [n(l.entries, 'entries'), n(l.ai_widgets, 'aiWidgets'), n(l.reports, 'reports'), history, fill(t.voice, { n: l.voiceMaxSeconds })];
}

export function PricingTable({ t, billingOpen }: { t: Dict['pricing']; billingOpen: boolean }) {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const periods: BillingPeriod[] = ['monthly', 'quarterly', 'annual'];

  return (
    <div>
      <div role="radiogroup" aria-label={t.title} className="mx-auto flex w-fit gap-1 rounded-full border bg-card p-1">
        {periods.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={period === p}
            onClick={() => setPeriod(p)}
            className={cn(
              'body-5 flex min-h-11 items-center gap-2 rounded-full px-4 transition-colors duration-300 ease-base',
              period === p ? 'bg-foreground text-background' : 'text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground',
              FOCUS,
            )}
          >
            {t[p]}
            {BILLING_PERIODS[p].badge ? <span className="caption-3 tabular-nums opacity-80">{BILLING_PERIODS[p].badge}</span> : null}
          </button>
        ))}
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {TIERS.map((tier) => {
          const info = TIER_INFO[tier];
          const total = calcPrice(info.priceStars, period);
          const months = BILLING_PERIODS[period].months;
          const featured = tier === 'stars_basic';
          return (
            <article
              key={tier}
              className={cn('flex flex-col rounded-3xl border bg-card p-6 sm:p-8', featured && 'border-foreground')}
              aria-labelledby={`plan-${tier}`}
            >
              <h2 id={`plan-${tier}`} className="title-1">{info.name}</h2>
              <p className="body-6 mt-1 text-muted-foreground">{t.plans[tier]}</p>
              <p className="mt-6 flex items-baseline gap-2">
                {info.priceStars === 0 ? (
                  <span className="heading-4">{t.free}</span>
                ) : (
                  <>
                    <span className="heading-4 tabular-nums">{Math.round(total / months).toLocaleString('en-US')} ⭐</span>
                    <span className="body-6 text-muted-foreground">{t.perMonth}</span>
                  </>
                )}
              </p>
              <p className="caption-5 mt-1 min-h-4 text-muted-foreground tabular-nums">
                {info.priceStars > 0 && months > 1 ? fill(t.billed, { total: total.toLocaleString('en-US'), months }) : null}
              </p>
              <ul className="mt-6 flex flex-col gap-2">
                {[...limitRows(tier, t.rows), ...FLAGS[tier].map((k) => t.rows[k])].map((row) => (
                  <li key={row} className="body-6 flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {row}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                {billingOpen && tier !== 'free' ? (
                  <p className="caption-4 mb-3 text-muted-foreground">{t.current}</p>
                ) : null}
                <Link
                  href="/login"
                  className={cn(
                    'button-md flex min-h-12 items-center justify-center rounded-full px-6 transition-transform duration-300 ease-base active:scale-[0.98]',
                    featured ? 'bg-primary text-primary-foreground' : 'border bg-background',
                    FOCUS,
                  )}
                >
                  {t.cta}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
