import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canonicalKey, collectPoints, dailyValues, dayKeyBefore, localDayKey, normalizeMetric, normalizeMetrics,
  todayTotals, totals, unitLabel, type MetricEntry,
} from '@/lib/metrics';
import { finalizeMetrics, waterMl } from '@/lib/metric-extract';

const KYIV = 'Europe/Kyiv';
const entry = (created_at: string, dashboard_metrics: unknown[], extra: Record<string, unknown> = {}): MetricEntry => ({
  created_at,
  metadata: { dashboard_metrics, ...extra },
});

describe('waterMl', () => {
  it.each([
    ['I drank 2 glasses of water', 500],
    ['2 cups of water', 500],
    ['a glass of water', 250],
    ['drank glass of cold water', 250],
    ['випив дві склянки води', 500],
    ['склянку теплої води', 250],
    ['пляшку води', 500],
    ['1,5 л води', 1500],
    ['500ml water', 500],
    ['water 750 ml', 750],
    ['води: 2 л', 2000],
    ['2 cups of coffee and a glass of water', 250],
    ['a glass of water, then another 2 glasses of water', 750],
  ])('%s → %i ml', (text, ml) => {
    expect(waterMl(text)).toBe(ml);
  });

  it('ignores text without countable water', () => {
    expect(waterMl('2 cups of coffee')).toBeNull();
    expect(waterMl('drank some water')).toBeNull();
    expect(waterMl('waterfall hike 5 km')).toBeNull();
  });
});

describe('normalizeMetric', () => {
  it('maps aliases and converts units into the base unit', () => {
    expect(normalizeMetric({ key: 'water', value: 2, unit: 'склянки' })).toMatchObject({ key: 'water_ml', value: 500, unit: 'ml', aggregate: 'sum' });
    expect(normalizeMetric({ key: 'water_ml', value: 1.5, unit: 'л' })).toMatchObject({ key: 'water_ml', value: 1500 });
    expect(normalizeMetric({ key: 'sleep', value: 450, unit: 'min' })).toMatchObject({ key: 'sleep_hours', value: 7.5, aggregate: 'avg' });
    expect(normalizeMetric({ key: 'calories', value: 420, unit: 'ккал' })).toMatchObject({ key: 'kcal_intake', value: 420, unit: 'kcal' });
    expect(normalizeMetric({ key: 'Body Weight', value: 72.4, unit: 'кг' })).toMatchObject({ key: 'weight_kg', aggregate: 'last' });
  });

  it('keeps the canonical combine rule over what the model sent', () => {
    expect(normalizeMetric({ key: 'water_ml', value: 250, aggregate: 'last' })?.aggregate).toBe('sum');
  });

  it('keeps unknown measures as sent and drops invalid values', () => {
    expect(normalizeMetric({ key: 'pages_read', value: 30, unit: 'pages', aggregate: 'sum' })).toMatchObject({ key: 'pages_read', value: 30, unit: 'pages' });
    expect(normalizeMetric({ key: 'water_ml', value: Number.NaN })).toBeNull();
  });

  it('merges two spellings of one measure in a single entry', () => {
    expect(normalizeMetrics([{ key: 'water', value: 250, unit: 'ml' }, { key: 'water_ml', value: 250, unit: 'ml' }])).toEqual([
      expect.objectContaining({ key: 'water_ml', value: 500 }),
    ]);
  });

  it('shows units in the user language', () => {
    expect(unitLabel('ml', 'uk')).toBe('мл');
    expect(unitLabel('ml', 'en')).toBe('ml');
    expect(canonicalKey('Water ML')).toBe('water_ml');
  });
});

describe('daily totals', () => {
  it('adds two logs of water into one day total (the bot and the web alike)', () => {
    const entries = [
      entry('2026-11-08T07:00:00Z', [{ key: 'water_ml', value: 250, unit: 'ml' }]),
      entry('2026-11-08T09:00:00Z', [{ key: 'water', value: 1, unit: 'glass' }]),
    ];
    expect(todayTotals(entries, new Date('2026-11-08T12:00:00Z'), KYIV)).toEqual([
      expect.objectContaining({ key: 'water_ml', value: 500, count: 2 }),
    ]);
  });

  it('lets a set correction replace the running total, then adds on top', () => {
    const entries = [
      entry('2026-11-08T07:00:00Z', [{ key: 'water_ml', value: 250 }]),
      entry('2026-11-08T08:00:00Z', [{ key: 'water_ml', value: 250 }]),
      entry('2026-11-08T10:00:00Z', [{ key: 'water_ml', value: 2000, mode: 'set' }]),
      entry('2026-11-08T11:00:00Z', [{ key: 'water_ml', value: 250 }]),
    ];
    const points = collectPoints(entries, KYIV);
    expect(dailyValues(points, 'water_ml').get('2026-11-08')).toBe(2250);
  });

  it('places entries on the local day and honours occurred_at', () => {
    // 22:30 UTC on the 7th is 00:30 on the 8th in Kyiv.
    const late = entry('2026-11-07T22:30:00Z', [{ key: 'water_ml', value: 250 }]);
    // Typed today, but it happened yesterday.
    const backdated = entry('2026-11-08T10:00:00Z', [{ key: 'water_ml', value: 500 }], { occurred_at: '2026-11-07T15:00:00Z' });
    const points = collectPoints([late, backdated], KYIV);
    const perDay = dailyValues(points, 'water_ml');
    expect(perDay.get('2026-11-08')).toBe(250);
    expect(perDay.get('2026-11-07')).toBe(500);
  });

  it('averages sleep per day and keeps the latest weight', () => {
    const entries = [
      entry('2026-11-06T06:00:00Z', [{ key: 'sleep_hours', value: 6 }, { key: 'weight_kg', value: 73 }]),
      entry('2026-11-07T06:00:00Z', [{ key: 'sleep_hours', value: 8 }, { key: 'weight_kg', value: 72.5 }]),
    ];
    const week = new Set([0, 1, 2, 3, 4, 5, 6].map((i) => dayKeyBefore(new Date('2026-11-08T12:00:00Z'), i, KYIV)));
    const result = totals(collectPoints(entries, KYIV), week);
    expect(result.find((t) => t.key === 'sleep_hours')?.value).toBe(7);
    expect(result.find((t) => t.key === 'weight_kg')?.value).toBe(72.5);
  });

  it('counts days across month ends', () => {
    expect(dayKeyBefore(new Date('2026-12-01T10:00:00Z'), 1, KYIV)).toBe('2026-11-30');
    expect(localDayKey(new Date('2026-11-30T23:30:00Z'), KYIV)).toBe('2026-12-01');
  });
});

describe('finalizeMetrics', () => {
  it('replaces the model water guess with the counted servings', () => {
    const out = finalizeMetrics('2 cups of water', [{ key: 'water_ml', value: 400, unit: 'ml' }]);
    expect(out).toEqual([expect.objectContaining({ key: 'water_ml', value: 500 })]);
  });

  it('adds water when the model missed it and keeps other metrics', () => {
    const out = finalizeMetrics('coffee and a glass of water', [{ key: 'caffeine', value: 63, unit: 'mg' }]);
    expect(out.map((m) => m.key).sort()).toEqual(['caffeine_mg', 'water_ml']);
  });
});

describe('mobile mirror', () => {
  it('mobile/src/lib/metrics.ts matches src/lib/metrics.ts', () => {
    const root = join(__dirname, '..', '..');
    const web = readFileSync(join(root, 'src/lib/metrics.ts'), 'utf8');
    const mobile = readFileSync(join(root, 'mobile/src/lib/metrics.ts'), 'utf8');
    expect(mobile).toBe(web);
  });

  it('mobile/src/lib/goals.ts matches src/lib/goals.ts', () => {
    const root = join(__dirname, '..', '..');
    expect(readFileSync(join(root, 'mobile/src/lib/goals.ts'), 'utf8')).toBe(readFileSync(join(root, 'src/lib/goals.ts'), 'utf8'));
  });
});
