/**
 * Tests for the UsageWarningBanner component logic.
 * Feature: pre-launch / REQ-09 — Soft Limit Warning
 *
 * Tests are implemented using Vitest + fast-check (fc).
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getUsageWarningVariant } from '@/lib/usage-warning';

// ── Unit tests — specific examples ───────────────────────────────────────────

describe('getUsageWarningVariant', () => {
  // Below 80% — no banner
  it('returns null when usage is below 80%', () => {
    expect(getUsageWarningVariant(0, 300)).toBeNull();
    expect(getUsageWarningVariant(100, 300)).toBeNull();
    expect(getUsageWarningVariant(239, 300)).toBeNull(); // 79.6%
  });

  // Exactly 80% — warning
  it('returns "warning" at exactly 80%', () => {
    expect(getUsageWarningVariant(240, 300)).toBe('warning'); // 80%
  });

  // 80–89% range — warning
  it('returns "warning" between 80% and 89%', () => {
    expect(getUsageWarningVariant(250, 300)).toBe('warning'); // 83.3%
    expect(getUsageWarningVariant(265, 300)).toBe('warning'); // 88.3%
    expect(getUsageWarningVariant(269, 300)).toBe('warning'); // 89.6%
  });

  // Exactly 90% — critical
  it('returns "critical" at exactly 90%', () => {
    expect(getUsageWarningVariant(270, 300)).toBe('critical'); // 90%
  });

  // 90–99% range — critical
  it('returns "critical" between 90% and 99%', () => {
    expect(getUsageWarningVariant(280, 300)).toBe('critical'); // 93.3%
    expect(getUsageWarningVariant(295, 300)).toBe('critical'); // 98.3%
    expect(getUsageWarningVariant(299, 300)).toBe('critical'); // 99.6%
  });

  // At 100% — null (paywall modal handles this)
  it('returns null at exactly 100%', () => {
    expect(getUsageWarningVariant(300, 300)).toBeNull();
  });

  // Over 100% — null
  it('returns null when over 100%', () => {
    expect(getUsageWarningVariant(350, 300)).toBeNull();
  });

  // Zero limit — null (avoid division by zero)
  it('returns null when limit is 0', () => {
    expect(getUsageWarningVariant(0, 0)).toBeNull();
    expect(getUsageWarningVariant(5, 0)).toBeNull();
  });

  // Reports limit (5 free reports)
  it('handles small limits correctly (reports: limit=5)', () => {
    expect(getUsageWarningVariant(3, 5)).toBeNull();  // 60%
    expect(getUsageWarningVariant(4, 5)).toBe('warning'); // 80%
    expect(getUsageWarningVariant(5, 5)).toBeNull();  // 100% — paywall
  });
});

// ── Property-based tests ──────────────────────────────────────────────────────

/**
 * Validates: Requirements REQ-09
 * Property 1: variant is always null, 'warning', or 'critical'
 */
describe('getUsageWarningVariant — property tests', () => {
  it(
    // Validates: Requirements REQ-09
    'Property 1: result is always null, "warning", or "critical"',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10_000 }),
          fc.integer({ min: 1, max: 10_000 }),
          (current, limit) => {
            const result = getUsageWarningVariant(current, limit);
            expect([null, 'warning', 'critical']).toContain(result);
          },
        ),
        { numRuns: 500 },
      );
    },
  );

  /**
   * Validates: Requirements REQ-09
   * Property 2: when pct < 80, result is always null
   */
  it(
    // Validates: Requirements REQ-09
    'Property 2: returns null when usage is below 80% of limit',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10_000 }).chain((limit) =>
            fc.record({
              limit: fc.constant(limit),
              // current must be < 80% of limit
              current: fc.integer({ min: 0, max: Math.floor(limit * 0.799) }),
            }),
          ),
          ({ current, limit }) => {
            expect(getUsageWarningVariant(current, limit)).toBeNull();
          },
        ),
        { numRuns: 500 },
      );
    },
  );

  /**
   * Validates: Requirements REQ-09
   * Property 3: when 80% <= pct < 90%, result is always 'warning'
   */
  it(
    // Validates: Requirements REQ-09
    'Property 3: returns "warning" when usage is between 80% and 89% of limit',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 10_000 }).chain((limit) => {
            const min80 = Math.ceil(limit * 0.8);
            const max89 = Math.floor(limit * 0.8999);
            // Only run if there's a valid integer range in [80%, 90%)
            if (min80 > max89) return fc.constant(null);
            return fc.record({
              limit: fc.constant(limit),
              current: fc.integer({ min: min80, max: max89 }),
            });
          }),
          (args) => {
            if (args === null) return; // skip degenerate cases
            expect(getUsageWarningVariant(args.current, args.limit)).toBe('warning');
          },
        ),
        { numRuns: 500 },
      );
    },
  );

  /**
   * Validates: Requirements REQ-09
   * Property 4: when 90% <= pct < 100%, result is always 'critical'
   */
  it(
    // Validates: Requirements REQ-09
    'Property 4: returns "critical" when usage is between 90% and 99% of limit',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 10_000 }).chain((limit) => {
            const min90 = Math.ceil(limit * 0.9);
            const max99 = limit - 1;
            if (min90 > max99) return fc.constant(null);
            return fc.record({
              limit: fc.constant(limit),
              current: fc.integer({ min: min90, max: max99 }),
            });
          }),
          (args) => {
            if (args === null) return;
            expect(getUsageWarningVariant(args.current, args.limit)).toBe('critical');
          },
        ),
        { numRuns: 500 },
      );
    },
  );

  /**
   * Validates: Requirements REQ-09
   * Property 5: when pct >= 100%, result is always null (paywall handles it)
   */
  it(
    // Validates: Requirements REQ-09
    'Property 5: returns null when usage is at or above 100% of limit',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10_000 }).chain((limit) =>
            fc.record({
              limit: fc.constant(limit),
              current: fc.integer({ min: limit, max: limit + 1_000 }),
            }),
          ),
          ({ current, limit }) => {
            expect(getUsageWarningVariant(current, limit)).toBeNull();
          },
        ),
        { numRuns: 500 },
      );
    },
  );
});
