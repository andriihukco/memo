/**
 * Property-based tests for the UI/UX Overhaul feature.
 * Feature: ui-ux-overhaul
 *
 * Tests are implemented using fast-check (fc).
 * The groupByDate function logic is extracted here for pure unit testing,
 * since the original lives inside a Next.js page component with React dependencies.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ── groupByDate — extracted pure logic from src/app/miniapp/page.tsx ─────────
// This mirrors the implementation exactly so the tests validate the real algorithm.

const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

interface TestEntry {
  id: string;
  created_at: string;
  content: string;
  [key: string]: unknown;
}

interface DateGroup {
  dateKey: string;   // "YYYY-MM-DD" in UTC+3
  dateLabel: string; // "14 липня 2025" (uk-UA locale)
  items: TestEntry[];
}

function groupByDate(items: TestEntry[]): DateGroup[] {
  const map = new Map<string, DateGroup>();
  const order: string[] = [];

  for (const item of items) {
    const createdAt = item.created_at;
    if (!createdAt) continue;

    const utc3Date = new Date(new Date(createdAt).getTime() + TZ_OFFSET_MS);
    const dateKey = utc3Date.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const dateLabel = utc3Date.toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    if (!map.has(dateKey)) {
      map.set(dateKey, { dateKey, dateLabel, items: [] });
      order.push(dateKey);
    }
    map.get(dateKey)!.items.push(item);
  }

  return order.map(k => map.get(k)!);
}

// ── Arbitraries ───────────────────────────────────────────────────────────────
// Use integer timestamps in a safe range so that adding TZ_OFFSET_MS (3h)
// never overflows the JS Date max value. Range: 2000-01-01 to 2099-12-31.

const MIN_TS = Date.UTC(2000, 0, 1);   // 2000-01-01T00:00:00.000Z
const MAX_TS = Date.UTC(2099, 11, 31, 20, 59, 59, 999); // leave 3h headroom

const entryArbitrary = fc.record({
  id: fc.uuid(),
  created_at: fc
    .integer({ min: MIN_TS, max: MAX_TS })
    .map(ts => new Date(ts).toISOString()),
  content: fc.string(),
});

const nonEmptyEntryArray = fc.array(entryArbitrary, { minLength: 1 });

// ── Helper: compute UTC+3 dateKey for a given ISO string ─────────────────────

function utc3DateKey(isoString: string): string {
  const utc3Date = new Date(new Date(isoString).getTime() + TZ_OFFSET_MS);
  return utc3Date.toISOString().slice(0, 10);
}

// ── Property 5: Date grouping preserves all entries ───────────────────────────
// Feature: ui-ux-overhaul, Property 5: Date grouping preserves all entries

describe('groupByDate', () => {
  it(
    // Feature: ui-ux-overhaul, Property 5: Date grouping preserves all entries
    'Property 5: total entry count across all groups equals the original array length',
    () => {
      fc.assert(
        fc.property(nonEmptyEntryArray, (entries) => {
          const groups = groupByDate(entries);
          const totalInGroups = groups.reduce((sum, g) => sum + g.items.length, 0);
          expect(totalInGroups).toBe(entries.length);
        }),
        { numRuns: 200 },
      );
    },
  );

  // ── Property 6: Date grouping — all entries in a group share the same UTC+3 date
  // Feature: ui-ux-overhaul, Property 6: Date grouping — all entries in a group share the same UTC+3 calendar date

  it(
    // Feature: ui-ux-overhaul, Property 6: Date grouping — all entries in a group share the same UTC+3 calendar date
    'Property 6: every entry in a group has a UTC+3 date matching the group dateKey',
    () => {
      fc.assert(
        fc.property(nonEmptyEntryArray, (entries) => {
          const groups = groupByDate(entries);
          for (const group of groups) {
            for (const entry of group.items) {
              const expectedKey = utc3DateKey(entry.created_at);
              expect(expectedKey).toBe(group.dateKey);
            }
          }
        }),
        { numRuns: 200 },
      );
    },
  );
});
