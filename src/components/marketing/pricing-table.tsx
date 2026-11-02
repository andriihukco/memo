'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { BILLING_PERIODS, TIER_INFO, calcPrice, type BillingPeriod, type SubscriptionTier } from '@/lib/billing/plans';
import { fill, type Dict, type SiteLocale } from '@/lib/marketing/dict';
import { cn } from '@/lib/utils';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const TIERS: SubscriptionTier[] = ['free', 'stars_basic', 'stars_pro'];
const PERIODS: BillingPeriod[] = ['monthly', 'quarterly', 'annual'];

/**
 * Assumptions for the money view. Telegram Stars are priced in Stars, so the USD value of one Star
 * is an input the owner sets. The defaults are placeholders and are shown as such on the page.
 */
const DEFAULT_STAR_USD = 0.013;
const DEFAULT_UAH_PER_USD = 41.5;

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

export function PricingTable({ t, billingOpen, locale }: { t: Dict['pricing']; billingOpen: boolean; locale: SiteLocale }) {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [starUsd, setStarUsd] = useState(DEFAULT_STAR_USD);
  const [uahPerUsd, setUahPerUsd] = useState(DEFAULT_UAH_PER_USD);
  const [cost, setCost] = useState('');

  const currency = locale === 'uk' ? 'UAH' : 'USD';
  const money = useMemo(
    () => new Intl.NumberFormat(locale === 'uk' ? 'uk-UA' : 'en-US', { style: 'currency', currency, maximumFractionDigits: currency === 'UAH' ? 0 : 2 }),
    [locale, currency],
  );
  /** Stars to the chosen currency. */
  const toMoney = (stars: number) => stars * starUsd * (currency === 'UAH' ? uahPerUsd : 1);
  const months = BILLING_PERIODS[period].months;

  const rows = TIERS.filter((tier) => TIER_INFO[tier].priceStars > 0).map((tier) => {
    const base = TIER_INFO[tier].priceStars;
    const total = calcPrice(base, period);
    const perMonthStars = total / months;
    const monthlyTotal = base * months;
    return {
      tier,
      total,
      perMonthStars,
      saved: monthlyTotal - total,
      perMonthMoney: toMoney(perMonthStars),
      totalMoney: toMoney(total),
    };
  });

  const costNum = Number(cost);
  const hasCost = cost.trim() !== '' && Number.isFinite(costNum);

  return (
    <div className="flex flex-col gap-16">
      {/* Period switch */}
      <div role="radiogroup" aria-label={t.title} className="mx-auto flex w-fit gap-1 rounded-full bg-muted p-1">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={period === p}
            onClick={() => setPeriod(p)}
            className={cn(
              'body-5 flex min-h-11 items-center gap-2 rounded-full px-5 transition-colors duration-300 ease-base',
              period === p ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground',
              FOCUS,
            )}
          >
            {t[p]}
            {BILLING_PERIODS[p].badge ? <span className="caption-3 tabular-nums text-primary">{BILLING_PERIODS[p].badge}</span> : null}
          </button>
        ))}
      </div>

      {/* Plans: one column each, the price large and the features under it. */}
      <div className="grid gap-4 lg:grid-cols-3">
        {TIERS.map((tier) => {
          const info = TIER_INFO[tier];
          const row = rows.find((r) => r.tier === tier);
          const featured = tier === 'stars_basic';
          return (
            <article
              key={tier}
              className={cn('flex flex-col rounded-4xl p-8 sm:p-10', featured ? 'bg-foreground text-background' : 'bg-muted')}
              aria-labelledby={`plan-${tier}`}
            >
              <h2 id={`plan-${tier}`} className="title-1">{info.name}</h2>
              <p className={cn('body-6 mt-1', featured ? 'text-background/70' : 'text-muted-foreground')}>{t.plans[tier]}</p>
              <p className="mt-8 flex items-baseline gap-2">
                {row ? (
                  <>
                    <span className="heading-2 tabular-nums">{money.format(row.perMonthMoney)}</span>
                    <span className={cn('body-6', featured ? 'text-background/70' : 'text-muted-foreground')}>{t.perMonth}</span>
                  </>
                ) : (
                  <span className="heading-2">{t.free}</span>
                )}
              </p>
              {row && months > 1 ? (
                <p className={cn('caption-4 mt-2 tabular-nums', featured ? 'text-background/70' : 'text-muted-foreground')}>
                  {money.format(row.totalMoney)} · {fill(t.billed, { total: row.total.toLocaleString('en-US'), months })}
                </p>
              ) : null}
              <ul className="mt-8 flex flex-col gap-3">
                {[...limitRows(tier, t.rows), ...FLAGS[tier].map((k) => t.rows[k])].map((line) => (
                  <li key={line} className="body-6 flex items-start gap-3">
                    <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-10">
                {billingOpen && tier !== 'free' ? <p className={cn('caption-4 mb-3', featured ? 'text-background/70' : 'text-muted-foreground')}>{t.current}</p> : null}
                <Link
                  href="/login"
                  className={cn(
                    'btn-shimmer button-md flex min-h-12 items-center justify-center rounded-full px-6 transition-transform duration-300 ease-base active:scale-[0.98]',
                    featured ? 'bg-background text-foreground' : 'bg-primary text-primary-foreground',
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

      {/* Unit economics: the same numbers for you and for us, with the assumptions in view. */}
      <div className="rounded-4xl bg-muted p-8 sm:p-12">
        <h2 className="heading-4">{t.calc.title}</h2>
        <p className="body-3 mt-3 max-w-2xl text-muted-foreground">{t.calc.sub}</p>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="body-5">{t.calc.costLabel}</span>
              <input
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className={cn('min-h-11 rounded-2xl border bg-background px-4 text-base tabular-nums', FOCUS)}
                placeholder="0"
              />
              <span className="caption-5 text-muted-foreground">{t.calc.costHint}</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-2">
                <span className="caption-4">{t.calc.starRateLabel}</span>
                <input
                  inputMode="decimal"
                  value={starUsd}
                  onChange={(e) => setStarUsd(Number(e.target.value) || 0)}
                  className={cn('min-h-11 rounded-2xl border bg-background px-4 tabular-nums', FOCUS)}
                />
              </label>
              {currency === 'UAH' ? (
                <label className="flex flex-col gap-2">
                  <span className="caption-4">{t.calc.fxLabel}</span>
                  <input
                    inputMode="decimal"
                    value={uahPerUsd}
                    onChange={(e) => setUahPerUsd(Number(e.target.value) || 0)}
                    className={cn('min-h-11 rounded-2xl border bg-background px-4 tabular-nums', FOCUS)}
                  />
                </label>
              ) : null}
            </div>
            <p className="caption-5 text-muted-foreground">{t.calc.assumption}</p>
          </div>

          <div className="grid gap-3">
            {rows.map((r) => (
              <div key={r.tier} className="flex items-center justify-between gap-4 rounded-2xl bg-background p-5">
                <div>
                  <p className="title-3">{TIER_INFO[r.tier].name}</p>
                  <p className="caption-5 text-muted-foreground">
                    {t.calc.youPay}: {money.format(r.totalMoney)}
                    {r.saved > 0 ? ` · −${money.format(toMoney(r.saved))}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="title-2 tabular-nums">{money.format(r.perMonthMoney)}</p>
                  <p className="caption-5 text-muted-foreground">
                    {hasCost ? (
                      <>
                        {t.calc.margin}: <span className="tabular-nums">{money.format(r.perMonthMoney - costNum)}</span>
                      </>
                    ) : (
                      t.calc.noCost
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-3 md:grid-cols-2">
          <p className="body-5 rounded-2xl bg-background p-5">{t.calc.bestUser}</p>
          <p className="body-5 rounded-2xl bg-background p-5">{t.calc.bestDev}</p>
        </div>
      </div>
    </div>
  );
}
