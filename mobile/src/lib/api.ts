/**
 * Thin client for the existing Memo API routes (same contract the Mini App uses).
 * Base URL comes from EXPO_PUBLIC_API_URL. Without it the app runs on demo data.
 */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export interface Metric {
  key: string;
  label: string;
  value: number;
  unit: string;
  aggregate: 'sum' | 'avg' | 'last';
}

export interface Entry {
  id: string;
  content: string;
  category: string;
  metadata: { dashboard_metrics?: Metric[] } | null;
  bot_reply: string | null;
  thread_id: string | null;
  reply_to_entry_id: string | null;
  created_at: string;
}

export interface Category {
  name: string;
  label_ua: string;
  color: string;
}

export interface Report {
  id: string;
  title: string;
  period: string;
  created_at: string;
  body: string;
}

export interface Widget {
  id: string;
  title: string;
  metric_key: string;
  unit: string;
  emoji: string;
  iconColor: string;
  aggregate: 'sum' | 'avg' | 'last';
  goal?: number;
  period?: 'day' | 'week' | 'month';
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'API_URL is not configured');
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface EntriesPage {
  entries: Entry[];
  has_more: boolean;
  next_cursor: string | null;
}

export const api = {
  listEntries: (token: string, opts: { category?: string | null; before?: string | null } = {}) => {
    const q = new URLSearchParams({ limit: '30' });
    if (opts.category) q.set('category', opts.category);
    if (opts.before) q.set('before', opts.before);
    return request<EntriesPage>(`/api/entries?${q}`, token);
  },
  createEntry: (token: string, content: string, category: string) =>
    request<{ entry: Entry }>('/api/entries', token, {
      method: 'POST',
      body: JSON.stringify({ content, category }),
    }),
  deleteEntry: (token: string, id: string) =>
    request<{ ok: true }>(`/api/entries?id=${encodeURIComponent(id)}`, token, { method: 'DELETE' }),
  listCategories: (token: string) => request<{ categories: Category[] }>('/api/categories', token),
  listReports: (token: string) => request<{ reports: Report[] }>('/api/reports', token),
  listWidgets: (token: string) => request<{ widgets: Widget[] }>('/api/widgets', token),
  createWidget: (token: string, direct: Widget) =>
    request<{ widget: Widget }>('/api/widgets', token, { method: 'POST', body: JSON.stringify({ direct }) }),
  createReport: (token: string, periodType: string) =>
    request<{ report: Report }>('/api/reports', token, { method: 'POST', body: JSON.stringify({ period_type: periodType }) }),
  usage: (token: string) => request<Record<string, unknown>>('/api/profile/usage', token),
};
