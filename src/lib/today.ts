/**
 * What the Today screen shows, from entries and goals: one tile per metric logged today (with the
 * day goal for that metric, when there is one), tiles for day goals with nothing logged yet, and
 * today's entries newest first. Pure, so web and tests share it; Expo mirrors it in
 * mobile/src/lib/today.ts (checked by src/__tests__/today.test.ts).
 */
import { CANON, canonicalKey, entryTime, localDayKey, metricLabel, toBaseUnit, todayTotals, type Aggregate, type MetricEntry } from './metrics';
import type { Goal } from './goals';

export interface TodayTile {
  key: string;
  label: string;
  value: number;
  unit: string;
  icon?: string;
  aggregate: Aggregate;
  goal: { target: number; ratio: number; met: boolean } | null;
}

export interface TodayEntry extends MetricEntry {
  id: string;
  content: string;
  category: string;
}

export interface TodayView<E extends TodayEntry> {
  tiles: TodayTile[];
  entries: E[];
}

export function buildToday<E extends TodayEntry>(entries: E[], goals: Goal[], now: Date, locale: string, timeZone?: string): TodayView<E> {
  const today = localDayKey(now, timeZone);
  const todays = entries
    .filter((e) => localDayKey(entryTime(e), timeZone) === today)
    .sort((a, b) => entryTime(b).getTime() - entryTime(a).getTime());

  // Day goals keyed by canonical metric, with the target in the metric's base unit
  // (a goal of "8 glasses" of water becomes 2000 ml, to compare with the ml total).
  const dayGoals = new Map<string, { name: string; target: number; unit: string }>();
  for (const g of goals) {
    if (g.period !== 'day' || !(g.target > 0)) continue;
    const key = canonicalKey(g.metric);
    dayGoals.set(key, { name: g.name, target: toBaseUnit(key, g.target, g.unit), unit: CANON[key]?.unit ?? g.unit });
  }

  const goalFor = (key: string, value: number) => {
    const g = dayGoals.get(key);
    if (!g) return null;
    return { target: g.target, ratio: Math.min(1, value / g.target), met: value >= g.target };
  };

  const tiles: TodayTile[] = todayTotals(todays, now, timeZone).map((m) => ({
    key: m.key,
    label: metricLabel(m.key, locale, m.label),
    value: m.value,
    unit: m.unit,
    icon: m.icon,
    aggregate: m.aggregate,
    goal: goalFor(m.key, m.value),
  }));

  // Goals for today with nothing logged yet still get a tile, at zero.
  for (const [key, g] of dayGoals) {
    if (tiles.some((t) => t.key === key)) continue;
    tiles.push({ key, label: metricLabel(key, locale, g.name), value: 0, unit: g.unit, aggregate: 'sum', goal: goalFor(key, 0) });
  }

  // Goals first (rings to close), then everything else in the order totals() gives.
  tiles.sort((a, b) => Number(!!b.goal) - Number(!!a.goal));
  return { tiles, entries: todays };
}
