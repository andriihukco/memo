/**
 * Metric aggregation utility for dashboard goal tracking.
 * Extracted as a pure module so it can be imported in tests without JSX.
 */

import type { DashboardMetric } from '@/lib/classifier';
import type { Entry } from '@/lib/dashboard/period-filter';

export interface AggregatedMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  icon?: string;
  aggregate: 'sum' | 'avg' | 'last';
  count: number;
}

/**
 * Aggregates dashboard_metrics from an array of entries.
 * For each metric key, values are combined according to the metric's aggregate type:
 * - 'sum'  → total of all values
 * - 'avg'  → mean of all values
 * - 'last' → most recent value
 *
 * Also includes a fallback for sleep entries that lack dashboard_metrics.
 */
export function aggregateMetrics(entries: Entry[]): AggregatedMetric[] {
  const map = new Map<string, { metric: DashboardMetric; values: number[] }>();

  for (const entry of entries) {
    const metrics = entry.metadata.dashboard_metrics as DashboardMetric[] | undefined;

    if (Array.isArray(metrics) && metrics.length > 0) {
      for (const m of metrics) {
        if (!map.has(m.key)) map.set(m.key, { metric: m, values: [] });
        map.get(m.key)!.values.push(m.value);
        map.get(m.key)!.metric = m;
      }
    } else if (entry.category === 'sleep') {
      // Fallback: parse sleep hours from content when dashboard_metrics is missing
      // Handles: "8 годин", "8 hours", "8h", time ranges like "00:30→08:30"
      const content = entry.content.toLowerCase();
      let hours: number | null = null;

      // Direct mention: "8 годин", "7.5 hours", "8h"
      const directMatch = content.match(/(\d+(?:[.,]\d+)?)\s*(?:год(?:ин)?|hours?|h\b)/);
      if (directMatch) {
        hours = parseFloat(directMatch[1].replace(',', '.'));
      }

      // Time range: "00:30" to "08:30" — calculate difference
      if (!hours) {
        const times = content.match(/(\d{1,2}):(\d{2})/g);
        if (times && times.length >= 2) {
          const [h1, m1] = times[0].split(':').map(Number);
          const [h2, m2] = times[times.length - 1].split(':').map(Number);
          let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (diff < 0) diff += 24 * 60; // crossed midnight
          hours = Math.round((diff / 60) * 10) / 10;
        }
      }

      if (hours && hours > 0 && hours <= 24) {
        const key = 'sleep_hours';
        if (!map.has(key)) map.set(key, { metric: { key, label: 'Сон', value: hours, unit: 'год', icon: 'moon', aggregate: 'avg' }, values: [] });
        map.get(key)!.values.push(hours);
      }
    }
  }

  const result: AggregatedMetric[] = [];
  for (const [key, { metric, values }] of map) {
    let value: number;
    if (metric.aggregate === 'sum') value = values.reduce((a, b) => a + b, 0);
    else if (metric.aggregate === 'avg') value = values.reduce((a, b) => a + b, 0) / values.length;
    else value = values[values.length - 1];
    result.push({ key, label: metric.label, value: Math.round(value * 10) / 10, unit: metric.unit, icon: metric.icon, aggregate: metric.aggregate, count: values.length });
  }

  const order = { sum: 0, avg: 1, last: 2 };
  return result.sort((a, b) => order[a.aggregate] - order[b.aggregate]);
}
