/**
 * Pure utility for usage warning threshold logic.
 * Extracted from UsageWarningBanner so it can be unit-tested without JSX.
 */

export type UsageWarningVariant = 'warning' | 'critical';

/**
 * Determine which warning variant to show based on usage percentage.
 * Returns null when no banner should be shown.
 *
 * pct >= 80 && pct < 90  → 'warning'  (amber chip)
 * pct >= 90 && pct < 100 → 'critical' (amber banner with CTA)
 * pct >= 100             → null (existing paywall modal handles this)
 * pct < 80               → null
 */
export function getUsageWarningVariant(
  current: number,
  limit: number,
): UsageWarningVariant | null {
  if (limit <= 0) return null;
  const pct = (current / limit) * 100;
  if (pct >= 100) return null;
  if (pct >= 90) return 'critical';
  if (pct >= 80) return 'warning';
  return null;
}
