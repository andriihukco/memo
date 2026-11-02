'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Check, Download, FileText, History, Lightbulb, LayoutGrid, Lock, KeyRound, Mic, NotebookPen, Network, Sparkles, Target, Zap, type LucideIcon } from 'lucide-react';
import { BILLING_PERIODS, TIER_INFO, calcPrice, type BillingPeriod, type SubscriptionTier } from '@/lib/billing/plans';
import { fill, type Dict, type SiteLocale } from '@/lib/marketing/dict';
import { cn } from '@/lib/utils';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const TIERS: SubscriptionTier[] = ['free', 'stars_basic', 'stars_pro'];
const PERIODS: BillingPeriod[] = ['monthly', 'quarterly', 'annual'];

/** Value of one Star in USD, for the money view. A placeholder until the price model is decided. */
const STAR_USD = 0.013;
const UAH_PER_USD = 41.5;

/** Feature flags per tier, mirrored from TIER_INFO in src/lib/billing/plans.ts. */
const FLAGS: Record<SubscriptionTier, string[]> = {
  free: ['encryption', 'pin'],
  stars_basic: ['aiRetro', 'aiRecs', 'goals', 'graph', 'encryption', 'pin'],
  stars_pro: ['aiRetro', 'aiRecs', 'goals', 'graph', 'priority', 'encryption', 'pin'],
};

/** One icon per feature, so no two features share a glyph. */
const ICONS: Record<string, LucideIcon> = {
  entries: NotebookPen,
  widgets: LayoutGrid,
  reports: FileText,
  history: History,
  voice: Mic,
  aiRetro: Sparkles,
  aiRecs: Lightbulb,
  goals: Target,
  graph: Network,
  priority: Zap,
  encryption: Lock,
  pin: KeyRound,
  export: Download,
};

type Feature = { key: string; label: string; icon: LucideIcon };

/** Every feature a tier includes, with the copy shown for that tier. */
function featuresOf(tier: SubscriptionTier, t: Dict['pricing']): Feature[] {
  const l = TIER_INFO[tier].limits;
  const count = (v: number, key: 'entries' | 'aiWidgets' | 'reports') =>
    fill(t.rows[key], { n: Number.isFinite(v) ? v.toLocaleString('en-US') : t.rows.unlimited });
  const history = !Number.isFinite(l.historyDays) ? t.rows.historyAll : l.historyDays >= 365 ? t.rows.historyYear : fill(t.rows.historyDays, { n: l.historyDays });
  const base: Feature[] = [
    { key: 'entries', label: count(l.entries, 'entries'), icon: ICONS.entries },
    { key: 'widgets', label: count(l.ai_widgets, 'aiWidgets'), icon: ICONS.widgets },
    { key: 'reports', label: count(l.reports, 'reports'), icon: ICONS.reports },
    { key: 'history', label: history, icon: ICONS.history },
    { key: 'voice', label: fill(t.rows.voice, { n: l.voiceMaxSeconds }), icon: ICONS.voice },
  ];
  const flags = FLAGS[tier].map((key) => ({ key, label: t.rows[key as keyof Dict['pricing']['rows']], icon: ICONS[key] }));
  return [...base, ...flags];
}

/** The features a tier adds: anything the tier below already gives, with the same copy, is left out. */
function newFeatures(tier: SubscriptionTier, lower: SubscriptionTier | null, t: Dict['pricing']): Feature[] {
  const mine = featuresOf(tier, t);
  if (!lower) return mine;
  const below = featuresOf(lower, t);
  return mine.filter((f) => !below.some((g) => g.key === f.key && g.label === f.label));
}

const LOWER: Record<SubscriptionTier, SubscriptionTier | null> = { free: null, stars_basic: 'free', stars_pro: 'stars_basic' };

export function PricingTable({ t, locale }: { t: Dict['pricing']; billingOpen: boolean; locale: SiteLocale }) {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [open, setOpen] = useState<Partial<Record<SubscriptionTier, boolean>>>({});
  const currency = locale === 'uk' ? 'UAH' : 'USD';
  // One fixed format on server and client, so the prices never differ between the two renders.
  const money = useMemo(() => {
    const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: currency === 'UAH' ? 0 : 2, minimumFractionDigits: 0 });
    return { format: (n: number) => (currency === 'UAH' ? `${fmt.format(Math.round(n))} ₴` : `$${fmt.format(Number(n.toFixed(2)))}`) };
  }, [currency]);
  const toMoney = (stars: number) => stars * STAR_USD * (currency === 'UAH' ? UAH_PER_USD : 1);
  const months = BILLING_PERIODS[period].months;

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

      <div className="grid gap-4 lg:grid-cols-3">
        {TIERS.map((tier) => {
          const info = TIER_INFO[tier];
          const lower = LOWER[tier];
          const featured = tier === 'stars_basic';
          const delta = newFeatures(tier, lower, t);
          const all = featuresOf(tier, t);
          const expanded = !!open[tier];
          const shown = expanded ? all : delta;
          const lowerName = lower ? TIER_INFO[lower].name : null;
          const perMonth = info.priceStars > 0 ? toMoney(calcPrice(info.priceStars, period) / months) : 0;
          return (
            <article
              key={tier}
              className={cn('flex flex-col rounded-4xl p-8 sm:p-10 lg:min-h-[36rem]', featured ? 'bg-foreground text-background' : 'bg-muted')}
              aria-labelledby={`plan-${tier}`}
            >
              <h2 id={`plan-${tier}`} className="title-1">{info.name}</h2>
              <p className={cn('body-6 mt-1', featured ? 'text-background/70' : 'text-muted-foreground')}>{t.plans[tier]}</p>

              {/* Prices are struck through and set to zero while billing is off. */}
              <p className="mt-8 flex items-baseline gap-3">
                {info.priceStars > 0 ? (
                  <span className={cn('heading-2 tabular-nums line-through decoration-2 opacity-40')}>{money.format(perMonth)}</span>
                ) : null}
                <span className="heading-1 tabular-nums tracking-tight">{money.format(0)}</span>
                <span className={cn('body-6', featured ? 'text-background/70' : 'text-muted-foreground')}>{t.perMonth}</span>
              </p>

              <ul className="mt-8 flex flex-col gap-3">
                {lowerName ? (
                  <li className="body-5 flex items-center gap-3 font-semibold">
                    <Check className="size-4 shrink-0" aria-hidden />
                    {fill(t.everything, { plan: lowerName })}
                  </li>
                ) : null}
                {shown.map((f) => {
                  const Icon = f.icon;
                  const repeated = expanded && !delta.some((d) => d.key === f.key && d.label === f.label);
                  return (
                    <li key={`${f.key}-${f.label}`} className={cn('body-6 flex items-center gap-3', repeated && 'opacity-50')}>
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {f.label}
                    </li>
                  );
                })}
              </ul>

              {all.length > delta.length ? (
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen((o) => ({ ...o, [tier]: !expanded }))}
                  className={cn('caption-4 mt-6 min-h-11 w-fit underline underline-offset-4', featured ? 'text-background/80' : 'text-muted-foreground', FOCUS)}
                >
                  {expanded ? t.showLess : t.seeAll}
                </button>
              ) : null}

              <div className="mt-auto pt-10">
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
    </div>
  );
}
