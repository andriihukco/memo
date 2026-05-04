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

// UTC+3 aware helpers — all boundaries computed in user's local timezone
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  const local = new Date(d.getTime() + TZ_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - TZ_OFFSET_MS);
}

export function endOfDay(d: Date): Date {
  const local = new Date(d.getTime() + TZ_OFFSET_MS);
  local.setUTCHours(23, 59, 59, 999);
  return new Date(local.getTime() - TZ_OFFSET_MS);
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
      const t = new Date(e.created_at).getTime();
      return t >= from.getTime() && t <= to.getTime();
    });
  }
  if (period === 'week') {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return entries.filter(e => new Date(e.created_at).getTime() >= from.getTime());
  }
  if (period === 'month') {
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return entries.filter(e => new Date(e.created_at).getTime() >= from.getTime());
  }
  return entries;
}
