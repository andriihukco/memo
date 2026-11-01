import { describe, it, expect } from 'vitest';
import { buildLocalRetro, dayStreak, goalProgress, type Goal, type MetricPoint } from '@/lib/goals';

const NOW = new Date('2026-11-10T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const at = (daysAgo: number, value: number, key = 'steps'): MetricPoint => ({
  date: new Date(NOW.getTime() - daysAgo * DAY),
  key,
  value,
});
const stepsDay: Goal = { id: 'g1', name: 'Steps', metric: 'steps', unit: 'steps', target: 8000, period: 'day' };
const stepsWeek: Goal = { ...stepsDay, id: 'g2', period: 'week', target: 40000 };

describe('goalProgress', () => {
  it('uses today for day goals', () => {
    const p = goalProgress(stepsDay, [at(0, 5000), at(1, 9000)], NOW);
    expect(p.current).toBe(5000);
    expect(p.met).toBe(false);
    expect(p.ratio).toBeCloseTo(0.625);
  });

  it('sums the last 7 days for week goals and caps the ratio at 1', () => {
    const p = goalProgress(stepsWeek, [at(0, 10000), at(3, 20000), at(6, 15000), at(8, 99999)], NOW);
    expect(p.current).toBe(45000);
    expect(p.met).toBe(true);
    expect(p.ratio).toBe(1);
  });

  it('ignores other metrics', () => {
    expect(goalProgress(stepsDay, [at(0, 500, 'sleep')], NOW).current).toBe(0);
  });
});

describe('dayStreak', () => {
  it('counts consecutive met days ending today', () => {
    expect(dayStreak(stepsDay, [at(0, 9000), at(1, 8000), at(2, 8500), at(3, 100)], NOW)).toBe(3);
  });

  it('does not break the streak while today is still unmet', () => {
    expect(dayStreak(stepsDay, [at(1, 8000), at(2, 8000)], NOW)).toBe(2);
  });

  it('is zero for week goals', () => {
    expect(dayStreak(stepsWeek, [at(0, 99999)], NOW)).toBe(0);
  });
});

describe('buildLocalRetro', () => {
  const from = new Date(NOW.getTime() - 7 * DAY);
  const points = [at(0, 9000), at(1, 4000), at(2, 8500)];

  it('builds the five sections from numbers only', () => {
    const r = buildLocalRetro({ from, to: NOW, entryCount: 3, entryDays: 3, points, goals: [stepsDay] }, NOW);
    expect(r.insights.map((i) => i.type)).toEqual([
      'went_well',
      'didnt_go_well',
      'start_stop_continue',
      'experiment',
      'lesson',
    ]);
    expect(r.went_well).toContain('Steps: 9000 steps (target 8000)');
    expect(r.summary).toBe('3 entries on 3 of 7 days. 1 of 1 goals met.');
    expect(r.period_type).toBe('weekly');
  });

  it('reports missed goals and suggests a next step', () => {
    const r = buildLocalRetro({ from, to: NOW, entryCount: 1, entryDays: 1, points: [], goals: [stepsDay] }, NOW);
    expect(r.went_well).toBe('No goal was met in this period.');
    expect(r.didnt_go_well).toContain('Steps: 0 of 8000 steps');
    expect(r.experiment).toContain('Steps');
  });
});
