/**
 * Unit tests for filterEntriesByPeriod
 * Feature: goal-tracking-fix
 *
 * Tests are implemented using vitest.
 */

import { describe, it, expect } from 'vitest';
import { filterEntriesByPeriod } from '@/lib/dashboard/period-filter';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(id: string, createdAt: Date) {
  return {
    id,
    content: 'test',
    category: 'health',
    metadata: {},
    created_at: createdAt.toISOString(),
  };
}

/** Returns a Date that is `days` days ago from now */
function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/** Returns a Date that is `hours` hours ago from now */
function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('filterEntriesByPeriod', () => {
  // ── 5.2 period: 'day' ──────────────────────────────────────────────────────

  describe("period: 'day'", () => {
    it('includes an entry created 1 hour ago (today)', () => {
      const entry = makeEntry('a', hoursAgo(1));
      const result = filterEntriesByPeriod([entry], 'day');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a');
    });

    it('excludes an entry created 25 hours ago (yesterday)', () => {
      const entry = makeEntry('b', hoursAgo(25));
      const result = filterEntriesByPeriod([entry], 'day');
      expect(result).toHaveLength(0);
    });

    it('includes today entries and excludes yesterday entries', () => {
      const today = makeEntry('today', hoursAgo(2));
      const yesterday = makeEntry('yesterday', hoursAgo(26));
      const result = filterEntriesByPeriod([today, yesterday], 'day');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('today');
    });
  });

  // ── 5.3 period: 'week' ─────────────────────────────────────────────────────

  describe("period: 'week'", () => {
    it('includes an entry from 6 days ago', () => {
      const entry = makeEntry('c', daysAgo(6));
      const result = filterEntriesByPeriod([entry], 'week');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c');
    });

    it('excludes an entry from 8 days ago', () => {
      const entry = makeEntry('d', daysAgo(8));
      const result = filterEntriesByPeriod([entry], 'week');
      expect(result).toHaveLength(0);
    });

    it('includes entries within 7 days and excludes older ones', () => {
      const recent = makeEntry('recent', daysAgo(3));
      const old = makeEntry('old', daysAgo(8));
      const result = filterEntriesByPeriod([recent, old], 'week');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('recent');
    });
  });

  // ── 5.4 period: 'month' ────────────────────────────────────────────────────

  describe("period: 'month'", () => {
    it('includes an entry from 29 days ago', () => {
      const entry = makeEntry('e', daysAgo(29));
      const result = filterEntriesByPeriod([entry], 'month');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('e');
    });

    it('excludes an entry from 31 days ago', () => {
      const entry = makeEntry('f', daysAgo(31));
      const result = filterEntriesByPeriod([entry], 'month');
      expect(result).toHaveLength(0);
    });

    it('includes entries within 30 days and excludes older ones', () => {
      const recent = makeEntry('recent', daysAgo(15));
      const old = makeEntry('old', daysAgo(31));
      const result = filterEntriesByPeriod([recent, old], 'month');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('recent');
    });
  });

  // ── 5.5 period: undefined and 'all' ───────────────────────────────────────

  describe("period: undefined and 'all'", () => {
    it('returns all entries when period is undefined', () => {
      const entries = [
        makeEntry('x', daysAgo(0)),
        makeEntry('y', daysAgo(60)),
        makeEntry('z', daysAgo(365)),
      ];
      const result = filterEntriesByPeriod(entries, undefined);
      expect(result).toHaveLength(3);
    });

    it("returns all entries when period is 'all'", () => {
      const entries = [
        makeEntry('x', daysAgo(0)),
        makeEntry('y', daysAgo(60)),
        makeEntry('z', daysAgo(365)),
      ];
      const result = filterEntriesByPeriod(entries, 'all');
      expect(result).toHaveLength(3);
    });

    it('returns empty array when input is empty (undefined period)', () => {
      expect(filterEntriesByPeriod([], undefined)).toHaveLength(0);
    });

    it("returns empty array when input is empty ('all' period)", () => {
      expect(filterEntriesByPeriod([], 'all')).toHaveLength(0);
    });
  });
});

// ── Task 6: GoalsTab period-scoped progress ───────────────────────────────────
//
// Tests the combined behavior of filterEntriesByPeriod + aggregateMetrics,
// which is exactly the logic GoalsTab uses to compute per-goal progress.

import { aggregateMetrics } from '@/lib/dashboard/aggregate-metrics';

/**
 * Builds an Entry with a single dashboard_metric of type 'sum'.
 */
function makeMetricEntry(
  id: string,
  createdAt: Date,
  metricKey: string,
  value: number,
  unit = 'units',
): ReturnType<typeof makeEntry> {
  return {
    id,
    content: 'test',
    category: 'health',
    metadata: {
      dashboard_metrics: [
        { key: metricKey, label: metricKey, value, unit, aggregate: 'sum' },
      ],
    },
    created_at: createdAt.toISOString(),
  };
}

/**
 * Simulates the GoalsTab pct computation:
 *   periodEntries = filterEntriesByPeriod(allEntries, period)
 *   actual        = aggregateMetrics(periodEntries).find(m => m.key === metricKey)
 *   pct           = actual ? Math.min(100, Math.round(actual.value / target * 100)) : 0
 */
function computeGoalPct(
  allEntries: ReturnType<typeof makeEntry>[],
  metricKey: string,
  target: number,
  period?: string,
): number {
  const periodEntries = filterEntriesByPeriod(allEntries, period);
  const actual = aggregateMetrics(periodEntries).find(m => m.key === metricKey);
  return actual ? Math.min(100, Math.round((actual.value / target) * 100)) : 0;
}

describe('GoalsTab period-scoped progress', () => {
  // ── 6.1 Monthly goal: entries spread across 3 months ─────────────────────

  describe('6.1 monthly goal — entries spread across 3 months', () => {
    it('uses only last-30-days entries for pct, not all-time sum', () => {
      // 60 km from 2 months ago (outside 30-day window)
      const old1 = makeMetricEntry('old1', daysAgo(60), 'distance_km', 30);
      const old2 = makeMetricEntry('old2', daysAgo(45), 'distance_km', 30);
      // 15 km within the last 30 days
      const recent1 = makeMetricEntry('r1', daysAgo(10), 'distance_km', 10);
      const recent2 = makeMetricEntry('r2', daysAgo(5), 'distance_km', 5);

      const allEntries = [old1, old2, recent1, recent2];
      const target = 100;

      const pct = computeGoalPct(allEntries, 'distance_km', target, 'month');

      // Only last-30-days: 10 + 5 = 15 km → 15%
      expect(pct).toBe(15);
      // Must NOT use all-time sum (75 km → 75%)
      expect(pct).not.toBe(75);
    });

    it('returns 0 when all entries are older than 30 days', () => {
      const old1 = makeMetricEntry('old1', daysAgo(35), 'distance_km', 50);
      const old2 = makeMetricEntry('old2', daysAgo(60), 'distance_km', 50);

      const pct = computeGoalPct([old1, old2], 'distance_km', 100, 'month');
      expect(pct).toBe(0);
    });
  });

  // ── 6.2 Daily goal: entries from yesterday and today ─────────────────────

  describe('6.2 daily goal — entries from yesterday and today', () => {
    it('uses only today entries for pct, not yesterday entries', () => {
      // 1500 ml today
      const todayEntry = makeMetricEntry('today', hoursAgo(2), 'water_ml', 1500, 'ml');
      // 3000 ml yesterday (should be excluded)
      const yesterdayEntry = makeMetricEntry('yesterday', hoursAgo(26), 'water_ml', 3000, 'ml');

      const allEntries = [todayEntry, yesterdayEntry];
      const target = 2000;

      const pct = computeGoalPct(allEntries, 'water_ml', target, 'day');

      // Only today: 1500 ml → 75%
      expect(pct).toBe(75);
      // Must NOT use all-time sum (4500 ml → 100% capped)
      expect(pct).not.toBe(100);
    });

    it('returns 0 when there are no entries today', () => {
      const yesterdayEntry = makeMetricEntry('yesterday', hoursAgo(26), 'water_ml', 2000, 'ml');

      const pct = computeGoalPct([yesterdayEntry], 'water_ml', 2000, 'day');
      expect(pct).toBe(0);
    });
  });

  // ── 6.3 Widget goal with period: 'week' ───────────────────────────────────

  describe("6.3 widget goal with period: 'week'", () => {
    it('uses only last-7-days entries for pct, not older entries', () => {
      // 20000 steps from 10 days ago (outside 7-day window)
      const oldEntry = makeMetricEntry('old', daysAgo(10), 'steps_count', 20000);
      // 5000 steps within the last 7 days
      const recentEntry = makeMetricEntry('recent', daysAgo(3), 'steps_count', 5000);

      const allEntries = [oldEntry, recentEntry];
      const target = 50000;

      const pct = computeGoalPct(allEntries, 'steps_count', target, 'week');

      // Only last-7-days: 5000 steps → 10%
      expect(pct).toBe(10);
      // Must NOT use all-time sum (25000 steps → 50%)
      expect(pct).not.toBe(50);
    });

    it('includes entries from exactly 6 days ago', () => {
      const entry = makeMetricEntry('e', daysAgo(6), 'steps_count', 10000);
      const pct = computeGoalPct([entry], 'steps_count', 100000, 'week');
      expect(pct).toBe(10);
    });
  });

  // ── 6.4 Goal with no matching entries in period ───────────────────────────

  describe('6.4 goal with no matching entries in period', () => {
    it('returns pct = 0 when no entries exist at all', () => {
      const pct = computeGoalPct([], 'water_ml', 2000, 'day');
      expect(pct).toBe(0);
    });

    it('returns pct = 0 when entries exist but none match the metric key', () => {
      const entry = makeMetricEntry('e', hoursAgo(1), 'steps_count', 5000);
      const pct = computeGoalPct([entry], 'water_ml', 2000, 'day');
      expect(pct).toBe(0);
    });

    it('returns pct = 0 when entries exist but are outside the period', () => {
      const entry = makeMetricEntry('e', daysAgo(5), 'water_ml', 2000, 'ml');
      const pct = computeGoalPct([entry], 'water_ml', 2000, 'day');
      expect(pct).toBe(0);
    });

    it('does not throw when entries array is empty', () => {
      expect(() => computeGoalPct([], 'distance_km', 100, 'month')).not.toThrow();
    });

    it('does not throw when no entries match the period', () => {
      const entry = makeMetricEntry('e', daysAgo(60), 'distance_km', 50);
      expect(() => computeGoalPct([entry], 'distance_km', 100, 'day')).not.toThrow();
    });
  });

  // ── 6.5 Goal where period entries exceed target: pct capped at 100 ────────

  describe('6.5 goal where period entries exceed target — pct capped at 100', () => {
    it('caps pct at 100 when actual value exceeds target', () => {
      // 5000 ml today, target is 2000 ml
      const entry = makeMetricEntry('e', hoursAgo(1), 'water_ml', 5000, 'ml');
      const pct = computeGoalPct([entry], 'water_ml', 2000, 'day');
      expect(pct).toBe(100);
    });

    it('caps pct at 100 when multiple entries sum to more than target', () => {
      const e1 = makeMetricEntry('e1', daysAgo(2), 'steps_count', 40000);
      const e2 = makeMetricEntry('e2', daysAgo(1), 'steps_count', 40000);
      // 80000 steps in last 7 days, target 50000 → would be 160% without cap
      const pct = computeGoalPct([e1, e2], 'steps_count', 50000, 'week');
      expect(pct).toBe(100);
    });

    it('returns exactly 100 when actual equals target', () => {
      const entry = makeMetricEntry('e', hoursAgo(1), 'water_ml', 2000, 'ml');
      const pct = computeGoalPct([entry], 'water_ml', 2000, 'day');
      expect(pct).toBe(100);
    });
  });
});

// ── Task 8: Widget API validation ────────────────────────────────────────────
//
// Tests POST /api/widgets validation of goal and period fields in the `direct`
// branch. Validation happens before any DB write, so we mock auth + profile
// fetch and focus on the HTTP status codes.

import { vi, beforeEach } from 'vitest';

// ── Mocks (hoisted so they apply before the route module is imported) ─────────

const mockWidgetsFrom = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockWidgetsFrom,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
    },
  })),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  rateLimitResponse: vi.fn(),
}));

vi.mock('@/lib/stars/paywall', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stars/paywall')>();
  return {
    ...actual,
    getEffectiveTier: vi.fn(() => Promise.resolve('stars_pro')),
  };
});

// ── Setup Supabase mock for widgets route ─────────────────────────────────────
//
// The POST handler calls:
//   supabase.from('profiles').select('id, settings').single()  → profile
//   supabase.from('profiles').update(...).eq(...)              → save widget
//
// We return a profile with no existing custom_widgets and a stars_pro tier
// (Infinity widget limit) so the only thing that can cause a 400 is validation.

function setupWidgetsMocks() {
  mockWidgetsFrom.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test-user-id', settings: { custom_widgets: [] } },
            error: null,
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupWidgetsMocks();
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test_anon_key';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
  process.env.GEMINI_API_KEY = 'test_gemini_key';
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function callWidgetsPost(body: unknown): Promise<Response> {
  const { POST } = await import('@/app/api/widgets/route');
  const req = new Request('http://localhost/api/widgets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer valid_jwt_token',
    },
    body: JSON.stringify(body),
  });
  return POST(req);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/widgets — goal/period validation', () => {
  // 8.1 goal: 0 with valid period → 400
  it('8.1 returns 400 when direct.goal is 0 (zero is not positive)', async () => {
    const res = await callWidgetsPost({ direct: { id: 'x', goal: 0, period: 'month' } });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('goal must be a positive number');
  });

  // 8.2 goal: -5 with valid period → 400
  it('8.2 returns 400 when direct.goal is negative (-5)', async () => {
    const res = await callWidgetsPost({ direct: { id: 'x', goal: -5, period: 'week' } });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('goal must be a positive number');
  });

  // 8.3 valid goal with invalid period 'year' → 400
  it('8.3 returns 400 when direct.period is "year" (not in allowed list)', async () => {
    const res = await callWidgetsPost({ direct: { id: 'x', goal: 10, period: 'year' } });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('period must be one of: day, week, month');
  });

  // 8.4 valid goal and valid period → 200
  it('8.4 returns 200 when direct.goal is positive and direct.period is valid', async () => {
    const res = await callWidgetsPost({ direct: { id: 'x', goal: 10, period: 'month' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('widget');
    expect(json.widget.id).toBe('x');
  });

  // 8.5 no goal/period fields → 200 (validation not triggered)
  it('8.5 returns 200 when direct has no goal or period (validation not triggered)', async () => {
    const res = await callWidgetsPost({ direct: { id: 'x' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('widget');
    expect(json.widget.id).toBe('x');
  });
});

// ── Task 7: Extended GOAL_KEYWORDS regex ──────────────────────────────────────
//
// Verifies that the extended GOAL_KEYWORDS regex in src/lib/classifier.ts
// matches all new Ukrainian and English goal phrases, preserves all original
// patterns, and does not match neutral strings.

import { GOAL_KEYWORDS } from '@/lib/classifier';

describe('GOAL_KEYWORDS — extended regex', () => {
  // ── 7.1–7.4 New Ukrainian patterns ────────────────────────────────────────

  it('7.1 matches "Планую пробігти 100 км" (планую)', () => {
    expect(GOAL_KEYWORDS.test('Планую пробігти 100 км')).toBe(true);
  });

  it('7.2 matches "Маю намір схуднути на 5 кг" (намір)', () => {
    expect(GOAL_KEYWORDS.test('Маю намір схуднути на 5 кг')).toBe(true);
  });

  it('7.3 matches "Маю ціль випивати 2 літри води" (маю ціль)', () => {
    expect(GOAL_KEYWORDS.test('Маю ціль випивати 2 літри води')).toBe(true);
  });

  it('7.4 matches "Цільовий показник — 10 000 кроків" (цільовий)', () => {
    expect(GOAL_KEYWORDS.test('Цільовий показник — 10 000 кроків')).toBe(true);
  });

  // ── 7.5–7.7 New English patterns ──────────────────────────────────────────

  it("7.5 matches \"I'm trying to drink 2 litres of water daily\" (trying to)", () => {
    expect(GOAL_KEYWORDS.test("I'm trying to drink 2 litres of water daily")).toBe(true);
  });

  it('7.6 matches "Working on reading 20 books this year" (working on)', () => {
    expect(GOAL_KEYWORDS.test('Working on reading 20 books this year')).toBe(true);
  });

  it('7.7 matches "aim to run 5km every day" (aim to)', () => {
    expect(GOAL_KEYWORDS.test('aim to run 5km every day')).toBe(true);
  });

  // ── 7.8 Original patterns still match ─────────────────────────────────────

  describe('7.8 original patterns still match', () => {
    it('matches "ціль" (Ukrainian: goal)', () => {
      expect(GOAL_KEYWORDS.test('Моя ціль — 10 000 кроків')).toBe(true);
    });

    it('matches "хочу" (Ukrainian: I want)', () => {
      expect(GOAL_KEYWORDS.test('Хочу пробігти марафон')).toBe(true);
    });

    it('matches "мета" (Ukrainian: aim/goal)', () => {
      expect(GOAL_KEYWORDS.test('Мета на місяць — схуднути')).toBe(true);
    });

    it('matches "goal" (English)', () => {
      expect(GOAL_KEYWORDS.test('My goal is to run 5km daily')).toBe(true);
    });

    it('matches "target" (English)', () => {
      expect(GOAL_KEYWORDS.test('Target: 10000 steps per day')).toBe(true);
    });

    it('matches "want to" (English)', () => {
      expect(GOAL_KEYWORDS.test('I want to lose 5 kg')).toBe(true);
    });

    it('matches "plan to" (English)', () => {
      expect(GOAL_KEYWORDS.test('I plan to read 20 books this year')).toBe(true);
    });

    it('matches "прочита" (Ukrainian: read/will read)', () => {
      expect(GOAL_KEYWORDS.test('Хочу прочитати 20 книг')).toBe(true);
    });

    it('matches "пробіг" (Ukrainian: run/ran)', () => {
      expect(GOAL_KEYWORDS.test('Пробіг 5 км сьогодні')).toBe(true);
    });

    it('matches "схудн" (Ukrainian: lose weight)', () => {
      expect(GOAL_KEYWORDS.test('Хочу схуднути на 10 кг')).toBe(true);
    });

    it('matches "набра" (Ukrainian: gain)', () => {
      expect(GOAL_KEYWORDS.test('Хочу набрати 5 кг м\'язів')).toBe(true);
    });

    it('matches "зробит" (Ukrainian: do/accomplish)', () => {
      expect(GOAL_KEYWORDS.test('Хочу зробити 100 присідань')).toBe(true);
    });
  });

  // ── 7.9 Neutral string does not match ─────────────────────────────────────

  it('7.9 does not match neutral string "Сьогодні гарна погода"', () => {
    expect(GOAL_KEYWORDS.test('Сьогодні гарна погода')).toBe(false);
  });

  it('does not match other neutral strings', () => {
    expect(GOAL_KEYWORDS.test('Поїв борщ на обід')).toBe(false);
    expect(GOAL_KEYWORDS.test('Today was a good day')).toBe(false);
    expect(GOAL_KEYWORDS.test('Went for a walk in the park')).toBe(false);
  });
});
