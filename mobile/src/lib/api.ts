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

/** A file or link attached to an entry. Files carry a signed `url`; music carries `meta.url`. */
export interface EntryMedia {
  id: string;
  kind: 'photo' | 'video' | 'audio' | 'music';
  url?: string | null;
  mime?: string | null;
  duration_s?: number | null;
  meta?: { url?: string; provider?: string } | null;
}

export interface Entry {
  id: string;
  content: string;
  category: string;
  metadata: { dashboard_metrics?: Metric[]; occurred_at?: string; kind?: 'quote'; sticker?: string } | null;
  bot_reply: string | null;
  thread_id: string | null;
  reply_to_entry_id: string | null;
  created_at: string;
  media?: EntryMedia[];
}

export type RepeatRule = 'none' | 'daily' | 'weekly';

export interface Reminder {
  id: string;
  text: string;
  scheduled_at: string;
  repeat: RepeatRule;
  status: 'pending' | 'sent' | 'cancelled';
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
  /** Set by the server-built retro (weekly). */
  summary?: string;
  insights?: { type: string; text: string; emoji: string }[];
}

/** A goal is a daily or weekly target for one numeric metric. Same shape as the Mini App. */
export interface Goal {
  id: string;
  name: string;
  metric: string;
  unit: string;
  target: number;
  period: 'day' | 'week';
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

/** Knowledge graph payload from GET /api/graph (same shape as the web app). */
export interface GraphNode {
  id: string;
  label: string;
  category: string;
  categories: string[];
  created_at: string;
  edge_count: number;
}
export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: 'branch' | 'similarity' | 'cross_category';
}
export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const api = {
  getGraph: (token: string) => request<GraphPayload>('/api/graph', token),
  listEntries: (token: string, opts: { category?: string | null; before?: string | null } = {}) => {
    const q = new URLSearchParams({ limit: '30' });
    if (opts.category) q.set('category', opts.category);
    if (opts.before) q.set('before', opts.before);
    return request<EntriesPage>(`/api/entries?${q}`, token);
  },
  createEntry: (token: string, content: string, category: string, metadata?: Entry['metadata']) =>
    request<{ entry: Entry }>('/api/entries', token, {
      method: 'POST',
      body: JSON.stringify({ content, category, ...(metadata ? { metadata } : {}) }),
    }),
  /** Attach a photo or a video to an entry. The file is a React Native `{ uri, name, type }`. */
  attachFile: async (token: string, entryId: string, kind: 'photo' | 'video', file: { uri: string; name: string; type: string }) => {
    if (!API_URL) throw new ApiError(0, 'API_URL is not configured');
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file as unknown as Blob);
    const res = await fetch(`${API_URL}/api/entries/${entryId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
  },
  /** Attach a music link. Only the supported services are accepted by the server. */
  attachMusic: (token: string, entryId: string, url: string) =>
    request<{ media: EntryMedia }>(`/api/entries/${entryId}/media`, token, {
      method: 'POST',
      body: JSON.stringify({ kind: 'music', url }),
    }),
  /** Audio note: the recording is classified and saved like a typed entry. */
  uploadAudio: async (token: string, file: { uri: string; name: string; type: string }, durationS: number) => {
    if (!API_URL) throw new ApiError(0, 'API_URL is not configured');
    const form = new FormData();
    form.append('file', file as unknown as Blob);
    form.append('duration_s', String(durationS));
    const res = await fetch(`${API_URL}/api/entries/audio`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
    }
  },
  createReminder: (token: string, text: string, remindAt: string, repeat: RepeatRule) =>
    request<{ reminder: Reminder }>('/api/reminders', token, {
      method: 'POST',
      body: JSON.stringify({ text, remind_at: remindAt, repeat }),
    }),
  deleteEntry: (token: string, id: string) =>
    request<{ ok: true }>(`/api/entries?id=${encodeURIComponent(id)}`, token, { method: 'DELETE' }),
  listCategories: (token: string) => request<{ categories: Category[] }>('/api/categories', token),
  createCategory: (token: string, label: string, color: string) =>
    request<{ category: Category }>('/api/categories', token, {
      method: 'POST',
      body: JSON.stringify({ label_ua: label, color }),
    }),
  updateCategory: (token: string, name: string, patch: { label_ua?: string; color?: string }) =>
    request<{ category: Category }>('/api/categories', token, {
      method: 'PATCH',
      body: JSON.stringify({ name, ...patch }),
    }),
  deleteCategory: (token: string, name: string) =>
    request<{ ok: true; reassigned: number }>(`/api/categories/${encodeURIComponent(name)}`, token, { method: 'DELETE' }),
  mergeCategories: (token: string, source: string, target: string) =>
    request<{ ok: true; reassigned: number }>('/api/categories/merge', token, {
      method: 'POST',
      body: JSON.stringify({ source, target }),
    }),
  listReports: (token: string) => request<{ reports: Report[] }>('/api/reports', token),
  listWidgets: (token: string) => request<{ widgets: Widget[] }>('/api/widgets', token),
  createWidget: (token: string, direct: Widget) =>
    request<{ widget: Widget }>('/api/widgets', token, { method: 'POST', body: JSON.stringify({ direct }) }),
  createReport: (token: string, periodType: string) =>
    request<{ report: Report }>('/api/reports', token, { method: 'POST', body: JSON.stringify({ period_type: periodType }) }),
  usage: (token: string) => request<Record<string, unknown>>('/api/profile/usage', token),
  getSettings: (token: string) => request<{ language: string; theme: string }>('/api/profile/settings', token),
  setLanguage: (token: string, language: string) =>
    request<{ ok?: boolean }>('/api/profile/settings', token, { method: 'PATCH', body: JSON.stringify({ language }) }),
  getReferral: (token: string) => request<{ link: string; code: string }>('/api/profile/referral', token),
  sendExport: (token: string) => request<{ ok?: boolean }>('/api/profile/export/send', token, { method: 'POST' }),
  deleteAccount: (token: string) => request<{ ok?: boolean }>('/api/profile/delete', token, { method: 'DELETE' }),
  listGoals: (token: string) => request<{ goals: Goal[] }>('/api/goals', token),
  saveGoals: (token: string, goals: Goal[]) =>
    request<{ goals: Goal[] }>('/api/goals', token, { method: 'PUT', body: JSON.stringify({ goals }) }),
  listEntriesBefore: (token: string, before: string | null) => {
    const q = new URLSearchParams({ limit: '50' });
    if (before) q.set('before', before);
    return request<EntriesPage>(`/api/entries?${q}`, token);
  },
  updateEntry: (token: string, id: string, patch: { content?: string; category?: string }) =>
    request<{ entry: Entry }>('/api/entries', token, { method: 'PATCH', body: JSON.stringify({ id, ...patch }) }),
};
