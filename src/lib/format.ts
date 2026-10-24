const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function dayKey(iso: string, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

export function groupByDay<T extends { created_at: string }>(items: T[], timeZone: string): { key: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const it of [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))) {
    const k = dayKey(it.created_at, timeZone);
    (map.get(k) ?? map.set(k, []).get(k)!).push(it);
  }
  return [...map].map(([key, items]) => ({ key, items })).sort((a, b) => b.key.localeCompare(a.key));
}

export function formatDay(iso: string, locale: string, timeZone: string, now: Date = new Date()): string {
  const key = dayKey(iso, timeZone);
  const today = dayKey(now.toISOString(), timeZone);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (key === today) return cap(rtf.format(0, 'day'));
  // calendar arithmetic on the local date key; 24h subtraction breaks on DST days
  const [y, m, d] = today.split('-').map(Number);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  if (key === yesterday) return cap(rtf.format(-1, 'day'));
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone,
  }).format(new Date(iso));
}

export function formatTime(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso));
}

export function formatNumber(n: number, locale: string, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, opts).format(n);
}

function validZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function userTimeZone(profile?: { settings?: Record<string, unknown> }): string {
  const tz = profile?.settings?.timezone;
  if (validZone(tz)) return tz;
  const sys = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return validZone(sys) ? sys : 'UTC';
}
