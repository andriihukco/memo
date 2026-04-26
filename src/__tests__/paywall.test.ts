/**
 * Unit tests for calcPrice() in src/lib/stars/paywall.ts.
 *
 * Covers:
 *  - All tier × billing period combinations
 *  - Discount correctness (quarterly = -15%, annual = -30%)
 *  - Integer rounding (Math.round)
 */

import { describe, it, expect } from 'vitest';
import { calcPrice, BILLING_PERIODS, TIER_INFO, type BillingPeriod } from '@/lib/stars/paywall';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('calcPrice()', () => {
  // ── Monthly (no discount) ─────────────────────────────────────────────────

  it('monthly: no discount — returns baseStars × 1', () => {
    expect(calcPrice(100, 'monthly')).toBe(100);
    expect(calcPrice(250, 'monthly')).toBe(250);
    expect(calcPrice(500, 'monthly')).toBe(500);
  });

  // ── Quarterly (−15%) ─────────────────────────────────────────────────────

  it('quarterly: applies 15% discount over 3 months', () => {
    // 100 × 3 × 0.85 = 255
    expect(calcPrice(100, 'quarterly')).toBe(255);
    // 250 × 3 × 0.85 = 637.5 → Math.round → 638
    expect(calcPrice(250, 'quarterly')).toBe(638);
    // 500 × 3 × 0.85 = 1275
    expect(calcPrice(500, 'quarterly')).toBe(1275);
  });

  it('quarterly: discount is exactly 15%', () => {
    const base = 200;
    const result = calcPrice(base, 'quarterly');
    const expected = Math.round(base * 3 * (1 - 15 / 100));
    expect(result).toBe(expected);
  });

  // ── Annual (−30%) ─────────────────────────────────────────────────────────

  it('annual: applies 30% discount over 12 months', () => {
    // 100 × 12 × 0.70 = 840
    expect(calcPrice(100, 'annual')).toBe(840);
    // 250 × 12 × 0.70 = 2100
    expect(calcPrice(250, 'annual')).toBe(2100);
    // 500 × 12 × 0.70 = 4200
    expect(calcPrice(500, 'annual')).toBe(4200);
  });

  it('annual: discount is exactly 30%', () => {
    const base = 300;
    const result = calcPrice(base, 'annual');
    const expected = Math.round(base * 12 * (1 - 30 / 100));
    expect(result).toBe(expected);
  });

  // ── Integer rounding ──────────────────────────────────────────────────────

  it('always returns an integer (Math.round)', () => {
    const bases = [1, 7, 13, 99, 101, 333, 999];
    const periods: BillingPeriod[] = ['monthly', 'quarterly', 'annual'];
    for (const base of bases) {
      for (const period of periods) {
        const result = calcPrice(base, period);
        expect(Number.isInteger(result)).toBe(true);
      }
    }
  });

  it('rounds 0.5 up (standard Math.round behaviour)', () => {
    // Find a base that produces a .5 fractional before rounding
    // quarterly: base × 3 × 0.85 = base × 2.55
    // base=2: 2 × 2.55 = 5.1 → 5
    // base=10: 10 × 2.55 = 25.5 → 26
    expect(calcPrice(10, 'quarterly')).toBe(26);
  });

  // ── All tier × billing period combinations ────────────────────────────────

  it('stars_basic (250 stars/month) × all billing periods', () => {
    const base = TIER_INFO.stars_basic.priceStars; // 250
    expect(calcPrice(base, 'monthly')).toBe(250);
    expect(calcPrice(base, 'quarterly')).toBe(638);  // 250×3×0.85 = 637.5 → 638
    expect(calcPrice(base, 'annual')).toBe(2100);    // 250×12×0.70 = 2100
  });

  it('stars_pro (500 stars/month) × all billing periods', () => {
    const base = TIER_INFO.stars_pro.priceStars; // 500
    expect(calcPrice(base, 'monthly')).toBe(500);
    expect(calcPrice(base, 'quarterly')).toBe(1275); // 500×3×0.85 = 1275
    expect(calcPrice(base, 'annual')).toBe(4200);    // 500×12×0.70 = 4200
  });

  it('free tier (0 stars/month) × all billing periods returns 0', () => {
    const base = TIER_INFO.free.priceStars; // 0
    expect(calcPrice(base, 'monthly')).toBe(0);
    expect(calcPrice(base, 'quarterly')).toBe(0);
    expect(calcPrice(base, 'annual')).toBe(0);
  });

  // ── BILLING_PERIODS metadata consistency ──────────────────────────────────

  it('BILLING_PERIODS has correct discountPct values', () => {
    expect(BILLING_PERIODS.monthly.discountPct).toBe(0);
    expect(BILLING_PERIODS.quarterly.discountPct).toBe(15);
    expect(BILLING_PERIODS.annual.discountPct).toBe(30);
  });

  it('calcPrice result is consistent with BILLING_PERIODS metadata', () => {
    const periods: BillingPeriod[] = ['monthly', 'quarterly', 'annual'];
    const base = 100;
    for (const period of periods) {
      const { months, discountPct } = BILLING_PERIODS[period];
      const expected = Math.round(base * months * (1 - discountPct / 100));
      expect(calcPrice(base, period)).toBe(expected);
    }
  });
});
