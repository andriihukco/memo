import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildToday, type TodayEntry } from '@/lib/today';
import type { Goal } from '@/lib/goals';

const KYIV = 'Europe/Kyiv';
const NOW = new Date('2026-11-08T12:00:00Z');
const e = (id: string, at: string, metrics: unknown[] = [], extra: Record<string, unknown> = {}): TodayEntry => ({
  id, content: id, category: 'health', created_at: at, metadata: { dashboard_metrics: metrics, ...extra },
});
const waterGoal: Goal = { id: 'g', name: 'Water', metric: 'water', unit: 'glasses', target: 8, period: 'day' };
const stepsGoal: Goal = { id: 's', name: 'Steps', metric: 'steps', unit: 'steps', target: 8000, period: 'day' };

describe('buildToday', () => {
  it('sums today, matches the day goal in base units, and lists today newest first', () => {
    const view = buildToday(
      [
        e('yesterday', '2026-11-07T10:00:00Z', [{ key: 'water_ml', value: 1000 }]),
        e('morning', '2026-11-08T06:00:00Z', [{ key: 'water_ml', value: 500 }]),
        e('noon', '2026-11-08T10:00:00Z', [{ key: 'water', value: 2, unit: 'glasses' }]),
      ],
      [waterGoal],
      NOW,
      'en',
      KYIV,
    );
    expect(view.entries.map((x) => x.id)).toEqual(['noon', 'morning']);
    expect(view.tiles[0]).toMatchObject({ key: 'water_ml', value: 1000, unit: 'ml', label: 'Water', goal: { target: 2000, ratio: 0.5, met: false } });
  });

  it('shows a zero tile for a day goal with nothing logged, goals first', () => {
    const view = buildToday([e('a', '2026-11-08T08:00:00Z', [{ key: 'mood_score', value: 7 }])], [stepsGoal], NOW, 'uk', KYIV);
    expect(view.tiles.map((t) => [t.key, t.value])).toEqual([['steps_count', 0], ['mood_score', 7]]);
    expect(view.tiles[1].label).toBe('Настрій');
  });

  it('counts a back-dated entry on the day it happened', () => {
    const view = buildToday([e('late', '2026-11-08T09:00:00Z', [{ key: 'water_ml', value: 250 }], { occurred_at: '2026-11-07T20:00:00Z' })], [], NOW, 'en', KYIV);
    expect(view.entries).toEqual([]);
    expect(view.tiles).toEqual([]);
  });

  it('mobile/src/lib/today.ts matches src/lib/today.ts', () => {
    const root = join(__dirname, '..', '..');
    expect(readFileSync(join(root, 'mobile/src/lib/today.ts'), 'utf8')).toBe(readFileSync(join(root, 'src/lib/today.ts'), 'utf8'));
  });
});
