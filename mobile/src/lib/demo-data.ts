import type { Category, Entry, Report } from './api';

/** Shown when no API is configured, so every screen still renders. */
const now = Date.now();
const day = 86_400_000;

const sample = (
  id: string,
  daysAgo: number,
  hour: number,
  category: string,
  content: string,
  metrics: Entry['metadata'] = null,
): Entry => {
  const d = new Date(now - daysAgo * day);
  d.setHours(hour, 0, 0, 0);
  return {
    id,
    content,
    category,
    metadata: metrics,
    bot_reply: null,
    thread_id: null,
    reply_to_entry_id: null,
    created_at: d.toISOString(),
  };
};

export const DEMO_ENTRIES: Entry[] = [
  sample('d1', 0, 8, 'food', 'Oatmeal with berries and coffee', { dashboard_metrics: [{ key: 'calories', label: 'Calories', value: 420, unit: 'kcal', aggregate: 'sum' }] }),
  sample('d2', 0, 9, 'sport', 'Morning run in the park', { dashboard_metrics: [{ key: 'distance', label: 'Distance', value: 5.2, unit: 'km', aggregate: 'sum' }] }),
  sample('d3', 0, 14, 'reminder', 'Remind me to call mom tomorrow at 6'),
  sample('d4', 1, 22, 'sleep', 'Slept well, woke up rested', { dashboard_metrics: [{ key: 'sleep', label: 'Sleep', value: 7.5, unit: 'h', aggregate: 'last' }] }),
  sample('d5', 1, 13, 'feeling', 'Feeling calm and focused today'),
  sample('d6', 2, 19, 'money', 'Groceries at the market', { dashboard_metrics: [{ key: 'amount', label: 'Spent', value: 640, unit: 'UAH', aggregate: 'sum' }] }),
  sample('d7', 3, 11, 'thought', 'Idea: a weekly review ritual on Sundays'),
];

export const DEMO_CATEGORIES: Category[] = [
  { name: 'food', label_ua: 'Їжа', color: 'amber' },
  { name: 'sport', label_ua: 'Спорт', color: 'green' },
  { name: 'sleep', label_ua: 'Сон', color: 'indigo' },
  { name: 'money', label_ua: 'Гроші', color: 'teal' },
  { name: 'reminder', label_ua: 'Нагадування', color: 'rose' },
  { name: 'feeling', label_ua: 'Відчуття', color: 'pink' },
  { name: 'thought', label_ua: 'Думки', color: 'blue' },
];

export const DEMO_REPORTS: Report[] = [
  {
    id: 'r1',
    title: 'Weekly review',
    period: 'Last 7 days',
    created_at: new Date(now - 2 * day).toISOString(),
    body: 'Sleep improved on weekdays. Movement was steady. Spending clustered on Saturdays.',
  },
];
