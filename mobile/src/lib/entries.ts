import type { Entry } from './api';

/** When the entry happened: the user's chosen time if set, otherwise when it was saved. */
export function entryTime(e: Entry): string {
  return e.metadata?.occurred_at ?? e.created_at;
}

/** Local calendar day key, so "today" follows the phone's timezone. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface DaySection {
  key: string;
  entries: Entry[];
}

/** Groups entries (newest first by entryTime) into local-day sections. */
export function groupByDay(entries: Entry[]): DaySection[] {
  const sections: DaySection[] = [];
  for (const e of entries) {
    const key = dayKey(entryTime(e));
    const last = sections[sections.length - 1];
    if (last && last.key === key) last.entries.push(e);
    else sections.push({ key, entries: [e] });
  }
  return sections;
}

/** Counts entries per category, most frequent first. */
export function categoryCounts(entries: Entry[]): { category: string; count: number }[] {
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.category, (map.get(e.category) ?? 0) + 1);
  return [...map.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}

/** Consecutive days with at least one entry, ending today (or yesterday). */
export function currentStreak(entries: Entry[], today = new Date()): number {
  const days = new Set(entries.map((e) => dayKey(e.created_at)));
  let streak = 0;
  const cursor = new Date(today);
  if (!days.has(dayKey(cursor.toISOString()))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor.toISOString()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
