import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type Category, type Entry, type Report, type RepeatRule, type Widget } from './api';
import { DEMO_CATEGORIES, DEMO_ENTRIES, DEMO_REPORTS } from './demo-data';
import { useSession } from './session';

/** Optional details the composer can set on top of text and category. */
export interface NewEntryExtra {
  /** When it happened, if different from now. */
  occurredAt?: Date;
  /** A reminder for the same text. */
  reminder?: { at: Date; repeat: RepeatRule };
}

interface EntryStore {
  entries: Entry[];
  categories: Category[];
  reports: Report[];
  widgets: Widget[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  add: (content: string, category: string, extra?: NewEntryExtra) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addWidget: (widget: Widget) => Promise<void>;
  addReport: (periodType: string) => Promise<void>;
}

const Ctx = createContext<EntryStore | null>(null);

/**
 * One source of truth for the Journal, Widgets and Insights screens.
 * Live when signed in against the API; otherwise demo data that still
 * behaves like the real thing (add and delete update the lists).
 */
export function EntryStoreProvider({ children }: { children: ReactNode }) {
  const { token, live } = useSession();
  const [entries, setEntries] = useState<Entry[]>(DEMO_ENTRIES);
  const [categories, setCategories] = useState<Category[]>(DEMO_CATEGORIES);
  const [reports, setReports] = useState<Report[]>(DEMO_REPORTS);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!live || !token) {
      setEntries(DEMO_ENTRIES);
      setCategories(DEMO_CATEGORIES);
      setReports(DEMO_REPORTS);
      setWidgets([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [page, cats, reps, wids] = await Promise.all([
        api.listEntries(token),
        api.listCategories(token),
        api.listReports(token),
        api.listWidgets(token),
      ]);
      setEntries(page.entries);
      setCategories(cats.categories);
      setReports(reps.reports);
      setWidgets(wids.widgets);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    } finally {
      setLoading(false);
    }
  }, [live, token]);

  useEffect(() => {
    // Initial load: refresh() sets loading state before its await. Intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (content: string, category: string, extra: NewEntryExtra = {}) => {
      const metadata = extra.occurredAt ? { occurred_at: extra.occurredAt.toISOString() } : null;
      if (!live || !token) {
        const now = new Date().toISOString();
        setEntries((prev) => [
          { id: `local-${Date.now()}`, content, category, metadata, bot_reply: null, thread_id: null, reply_to_entry_id: null, created_at: now },
          ...prev,
        ]);
        return;
      }
      const { entry } = await api.createEntry(token, content, category, metadata);
      setEntries((prev) => [entry, ...prev]);
      if (extra.reminder) {
        await api.createReminder(token, content, extra.reminder.at.toISOString(), extra.reminder.repeat);
      }
    },
    [live, token],
  );

  const remove = useCallback(
    async (id: string) => {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (live && token && !id.startsWith('local-') && !id.startsWith('d')) {
        await api.deleteEntry(token, id).catch(() => refresh());
      }
    },
    [live, token, refresh],
  );

  const addWidget = useCallback(
    async (widget: Widget) => {
      if (!live || !token) {
        setWidgets((prev) => [...prev, { ...widget, id: widget.id || `local-${Date.now()}` }]);
        return;
      }
      const { widget: saved } = await api.createWidget(token, widget);
      setWidgets((prev) => [...prev, saved]);
    },
    [live, token],
  );

  const addReport = useCallback(
    async (periodType: string) => {
      if (!live || !token) {
        setReports((prev) => [
          {
            id: `local-${Date.now()}`,
            title: periodType,
            period: periodType,
            created_at: new Date().toISOString(),
            body: 'Demo retrospective. Sign in to generate a real one.',
          },
          ...prev,
        ]);
        return;
      }
      const { report } = await api.createReport(token, periodType);
      setReports((prev) => [report, ...prev]);
    },
    [live, token],
  );

  const value = useMemo(
    () => ({ entries, categories, reports, widgets, loading, error, refresh, add, remove, addWidget, addReport }),
    [entries, categories, reports, widgets, loading, error, refresh, add, remove, addWidget, addReport],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntries(): EntryStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEntries must be used inside EntryStoreProvider');
  return ctx;
}
