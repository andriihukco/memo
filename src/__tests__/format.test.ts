import { describe, it, expect } from 'vitest';
import { dayKey, groupByDay, formatDay, userTimeZone } from '@/lib/format';

describe('format', () => {
  it('dayKey uses the given zone', () => {
    expect(dayKey('2026-03-29T00:30:00Z', 'Europe/Kyiv')).toBe('2026-03-29');
    expect(dayKey('2026-03-28T21:30:00Z', 'Europe/Kyiv')).toBe('2026-03-28');
  });

  it('groupByDay buckets by local day, newest first', () => {
    const items = [
      { created_at: '2026-03-28T21:30:00Z' }, // 23:30 Mar 28 Kyiv
      { created_at: '2026-03-28T22:30:00Z' }, // 00:30 Mar 29 Kyiv
      { created_at: '2026-03-29T10:00:00Z' },
    ];
    const g = groupByDay(items, 'Europe/Kyiv');
    expect(g.map((x) => [x.key, x.items.length])).toEqual([['2026-03-29', 2], ['2026-03-28', 1]]);
  });

  it('formatDay handles today/yesterday via Intl', () => {
    const now = new Date('2026-06-10T12:00:00Z');
    const ar = formatDay(now.toISOString(), 'ar', 'Asia/Dubai', now);
    expect(ar).not.toBe('Today');
    expect(ar.length).toBeGreaterThan(0);
    expect(formatDay('2026-06-09T12:00:00Z', 'en', 'UTC', now).toLowerCase()).toBe('yesterday');
    expect(formatDay(now.toISOString(), 'en', 'UTC', now)).toBe('Today');
  });

  it('formatDay adds year only when it differs', () => {
    const now = new Date('2026-06-10T12:00:00Z');
    expect(formatDay('2026-05-01T12:00:00Z', 'en', 'UTC', now)).not.toContain('2026');
    expect(formatDay('2025-05-01T12:00:00Z', 'en', 'UTC', now)).toContain('2025');
  });

  it('userTimeZone validates the profile zone', () => {
    expect(userTimeZone({ settings: { timezone: 'Europe/Kyiv' } })).toBe('Europe/Kyiv');
    expect(userTimeZone({ settings: { timezone: 'Nope/Zone' } })).toBeTruthy();
    expect(userTimeZone()).toBeTruthy();
  });
});
