/**
 * Period filter utility for dashboard goal tracking.
 * Extracted as a pure module so it can be imported in tests without JSX.
 */

export interface Entry {
  id: string;
  content: string;
  category: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/*
 * Day boundaries in the viewer's own time zone (the browser's). Kyiv is UTC+2 in winter and UTC+3
 * in summer, so a fixed offset put late-evening entries on the wrong day for half the year.
 */
export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

/** When the entry happened: occurred_at when set, otherwise when it was saved. */
function happenedAt(e: Entry): number {
  const occurred = e.metadata?.occurred_at;
  const t = typeof occurred === 'string' ? new Date(occurred).getTime() : NaN;
  return Number.isNaN(t) ? new Date(e.created_at).getTime() : t;
}

/**
 * Filters entries to those within the given period window.
 *
 * - 'day'       → entries from startOfDay(now) to endOfDay(now)
 * - 'week'      → entries from 7 days ago to now
 * - 'month'     → entries from 30 days ago to now
 * - undefined / 'all' → all entries (no filter)
 */
export function filterEntriesByPeriod(entries: Entry[], period?: string): Entry[] {
  const now = new Date();
  if (!period || period === 'all') return entries;
  if (period === 'day') {
    const from = startOfDay(now);
    const to = endOfDay(now);
    return entries.filter(e => {
      const t = happenedAt(e);
      return t >= from.getTime() && t <= to.getTime();
    });
  }
  if (period === 'week') {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return entries.filter(e => happenedAt(e) >= from.getTime());
  }
  if (period === 'month') {
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return entries.filter(e => happenedAt(e) >= from.getTime());
  }
  return entries;
}
