/**
 * Plan prices in whole US dollars: the single source of truth for billing.
 *
 * Checkout charges in UAH, USD or EUR. Other currencies are converted from
 * these values for display only.
 *
 * Three plans: Spark (free) on the left, Nova in the middle, highlighted as
 * "Most popular", and Supernova on the right. Supernova is priced high on
 * purpose, so Nova looks like the clear value.
 *
 * Longer billing periods use round totals close to the discounts in the
 * business model: quarterly −15%, annual −30%.
 *
 * Proposed on 2026-10-24. Not yet confirmed.
 */

export type PaidTier = "stars_basic" | "stars_pro";
export type BillingPeriod = "monthly" | "quarterly" | "annual";

export const HIGHLIGHTED_TIER: PaidTier = "stars_basic";

/** Price in whole USD for each paid tier and billing period. */
export const PRICES_USD: Record<PaidTier, Record<BillingPeriod, number>> = {
  stars_basic: { monthly: 5, quarterly: 13, annual: 42 }, // Memo Nova
  stars_pro: { monthly: 12, quarterly: 31, annual: 100 }, // Memo Supernova
};

/** Months covered by one payment for each billing period. */
export const PERIOD_MONTHS: Record<BillingPeriod, number> = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
};

/** Price in whole USD for a tier and billing period. */
export function priceUsd(tier: PaidTier, period: BillingPeriod): number {
  return PRICES_USD[tier][period];
}

/** Monthly equivalent, for "per month" labels. Rounded to whole dollars. */
export function monthlyEquivalentUsd(tier: PaidTier, period: BillingPeriod): number {
  return Math.round(PRICES_USD[tier][period] / PERIOD_MONTHS[period]);
}
