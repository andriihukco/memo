import { startOfDay, endOfDay } from '@/lib/dashboard/period-filter';

export type DateRange = 'all' | 'today' | 'yesterday' | 'week' | 'month' | '2weeks' | '3months' | 'year' | 'ytd' | 'custom';

export interface DateFilter {
  range: DateRange;
  from: Date;
  to: Date;
}

export interface GoalMetricAgg {
  key: string;
  label: string;
  target: number;
  unit: string;
  icon?: string;
  period?: string;
}

export interface CustomWidget {
  id: string;
  title: string;
  description?: string;
  metric_key: string;
  unit: string;
  icon?: string;
  emoji?: string;
  iconColor?: string;
  color?: string;
  aggregate: 'sum' | 'avg' | 'last';
  category?: string;
  goal?: number;
  period?: string;
  created_at: string;
}

export interface MeasureOption {
  id: string;
  emoji: string;
  label: string;
  sublabel: string;
  defaultUnit: string;
  defaultAggregate: 'sum' | 'avg' | 'last';
  defaultEmoji: string;
  defaultColor: string;
  category: string;
  metricKey: string;
  directWidget?: Omit<CustomWidget, 'created_at'>;
}

// UTC+3 aware helpers
export function rangeFor(r: DateRange): { from: Date; to: Date } {
  const now = new Date();
  if (r === 'all') return { from: new Date('2020-01-01'), to: endOfDay(now) };
  if (r === 'today') return { from: startOfDay(now), to: endOfDay(now) };
  if (r === 'yesterday') { const y = new Date(now); y.setDate(now.getDate() - 1); return { from: startOfDay(y), to: endOfDay(y) }; }
  if (r === 'week') { const f = new Date(now); f.setDate(now.getDate() - 6); return { from: startOfDay(f), to: endOfDay(now) }; }
  if (r === 'month') { const f = new Date(now); f.setDate(now.getDate() - 29); return { from: startOfDay(f), to: endOfDay(now) }; }
  if (r === '2weeks') { const f = new Date(now); f.setDate(now.getDate() - 13); return { from: startOfDay(f), to: endOfDay(now) }; }
  if (r === '3months') { const f = new Date(now); f.setMonth(now.getMonth() - 3); return { from: startOfDay(f), to: endOfDay(now) }; }
  if (r === 'year') { const f = new Date(now); f.setFullYear(now.getFullYear() - 1); return { from: startOfDay(f), to: endOfDay(now) }; }
  if (r === 'ytd') { const f = new Date(now.getFullYear(), 0, 1); return { from: startOfDay(f), to: endOfDay(now) }; }
  return { from: startOfDay(now), to: endOfDay(now) };
}

export function fmtDate(d: Date) {
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function getRangeLabels(t: (key: string) => string): Record<DateRange, string> {
  return {
    all: t('miniapp.dashboard.range.all'),
    today: t('miniapp.dashboard.range.today'),
    yesterday: t('miniapp.dashboard.range.yesterday'),
    week: t('miniapp.dashboard.range.week'),
    month: t('miniapp.dashboard.range.month'),
    '2weeks': t('miniapp.dashboard.range.2weeks'),
    '3months': t('miniapp.dashboard.range.3months'),
    year: t('miniapp.dashboard.range.year'),
    ytd: t('miniapp.dashboard.range.ytd'),
    custom: t('miniapp.dashboard.range.custom'),
  };
}
