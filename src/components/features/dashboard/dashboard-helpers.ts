import type { Entry } from '@/lib/dashboard/period-filter';
import type { GoalMetricAgg } from './dashboard-types';
import { ICON_COLORS, METRIC_EMOJI } from './dashboard-constants';

export function getIconColor(id?: string) {
  return ICON_COLORS.find(c => c.id === id) ?? ICON_COLORS[0];
}

export function aggregateGoals(entries: Entry[]): GoalMetricAgg[] {
  // Latest goal per key wins
  const map = new Map<string, GoalMetricAgg>();
  for (const entry of [...entries].reverse()) {
    const goals = entry.metadata.goal_metrics as GoalMetricAgg[] | undefined;
    if (!Array.isArray(goals)) continue;
    for (const g of goals) {
      map.set(g.key, g);
    }
  }
  return [...map.values()];
}

export function metricEmoji(key: string, fallback?: string): string {
  return METRIC_EMOJI[key] ?? fallback ?? '📊';
}
