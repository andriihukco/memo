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
  /** Saves an entry and returns it (null offline), so a quick log can offer Undo. */
  add: (content: string, category: string, extra?: NewEntryExtra) => Promise<Entry | null>;
  remove: (id: string) => Promise<void>;
  /** Edits an entry's text or category. */
  update: (id: string, patch: { content?: string; category?: string }) => Promise<void>;
  /** Creates a category when `name` is omitted, otherwise renames its label and recolours it. */
  saveCategory: (input: { name?: string; label: string; color: string }) => Promise<void>;
  /** Deletes a category; its entries move to "uncategorized". */
  removeCategory: (name: string) => Promise<void>;
  /** Moves every entry of `source` into `target`, then drops `source`. */
  mergeCategory: (source: string, target: string) => Promise<void>;
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
    async (content: string, category: string, extra: NewEntryExtra = {}): Promise<Entry | null> => {
      const metadata = extra.occurredAt ? { occurred_at: extra.occurredAt.toISOString() } : null;
      if (!live || !token) {
        const now = new Date().toISOString();
        setEntries((prev) => [
          { id: `local-${Date.now()}`, content, category, metadata, bot_reply: null, thread_id: null, reply_to_entry_id: null, created_at: now },
          ...prev,
        ]);
        return null;
      }
      const { entry } = await api.createEntry(token, content, category, metadata);
      // A correction returns the entry it fixed, which may already be in the list.
      setEntries((prev) => (prev.some((e) => e.id === entry.id) ? prev.map((e) => (e.id === entry.id ? entry : e)) : [entry, ...prev]));
      if (extra.reminder) {
        await api.createReminder(token, content, extra.reminder.at.toISOString(), extra.reminder.repeat);
      }
      return entry;
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

  const update = useCallback(
    async (id: string, patch: { content?: string; category?: string }) => {
      if (!live || !token || id.startsWith('local-') || id.startsWith('d')) {
        setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
        return;
      }
      const { entry } = await api.updateEntry(token, id, patch);
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...entry, content: entry.content ?? patch.content ?? e.content } : e)));
    },
    [live, token],
  );

  const saveCategory = useCallback(
    async ({ name, label, color }: { name?: string; label: string; color: string }) => {
      if (!live || !token) {
        if (name) {
          setCategories((prev) => prev.map((c) => (c.name === name ? { ...c, label_ua: label, color } : c)));
        } else {
          const slug = label.trim().toLowerCase().replace(/\s+/g, '_');
          setCategories((prev) => [...prev, { name: slug, label_ua: label, color }]);
        }
        return;
      }
      if (name) {
        const { category } = await api.updateCategory(token, name, { label_ua: label, color });
        setCategories((prev) => prev.map((c) => (c.name === name ? category : c)));
      } else {
        const { category } = await api.createCategory(token, label, color);
        setCategories((prev) => [...prev, category]);
      }
    },
    [live, token],
  );

  const removeCategory = useCallback(
    async (name: string) => {
      if (!live || !token) {
        setCategories((prev) => prev.filter((c) => c.name !== name));
        setEntries((prev) => prev.map((e) => (e.category === name ? { ...e, category: 'uncategorized' } : e)));
        return;
      }
      await api.deleteCategory(token, name);
      await refresh();
    },
    [live, token, refresh],
  );

  const mergeCategory = useCallback(
    async (source: string, target: string) => {
      if (!live || !token) {
        setCategories((prev) => prev.filter((c) => c.name !== source));
        setEntries((prev) => prev.map((e) => (e.category === source ? { ...e, category: target } : e)));
        return;
      }
      await api.mergeCategories(token, source, target);
      await refresh();
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
    () => ({
      entries, categories, reports, widgets, loading, error, refresh, add, remove, update,
      saveCategory, removeCategory, mergeCategory, addWidget, addReport,
    }),
    [
      entries, categories, reports, widgets, loading, error, refresh, add, remove, update,
      saveCategory, removeCategory, mergeCategory, addWidget, addReport,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntries(): EntryStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEntries must be used inside EntryStoreProvider');
  return ctx;
}
