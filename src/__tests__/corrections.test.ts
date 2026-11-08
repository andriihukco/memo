import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/lib/ai', () => ({ aiEnabled: () => false }));
vi.mock('@/lib/classifier', () => ({ extractEntryMetrics: vi.fn() }));

import { applyCorrection } from '@/lib/logging/corrections';
import { collectPoints, dailyValues } from '@/lib/metrics';

type Row = { id: string; user_id: string; category: string; content: string; metadata: Record<string, unknown>; created_at: string };

/** Just enough of the Supabase query builder for applyCorrection, backed by an array. */
function fakeDb(rows: Row[]) {
  let seq = 0;
  const from = () => {
    const filters: Array<(r: Row) => boolean> = [];
    let op: 'select' | 'insert' | 'update' = 'select';
    let payload: Record<string, unknown> = {};
    let single = false;
    const run = () => {
      if (op === 'insert') {
        const row = { id: `new-${++seq}`, created_at: new Date().toISOString(), ...payload } as Row;
        rows.push(row);
        return { data: single ? row : [row], error: null };
      }
      const hits = rows.filter((r) => filters.every((f) => f(r)));
      if (op === 'update') {
        hits.forEach((r) => Object.assign(r, payload));
        return { data: hits, error: null };
      }
      const sorted = [...hits].sort((a, b) => b.created_at.localeCompare(a.created_at));
      return { data: single ? sorted[0] ?? null : sorted, error: null };
    };
    const b = {
      select: () => b,
      insert: (p: Record<string, unknown>) => ((op = 'insert'), (payload = p), b),
      update: (p: Record<string, unknown>) => ((op = 'update'), (payload = p), b),
      eq: (k: keyof Row, v: unknown) => (filters.push((r) => r[k] === v), b),
      gte: (k: keyof Row, v: string) => (filters.push((r) => String(r[k]) >= v), b),
      order: () => b,
      limit: () => b,
      single: () => ((single = true), b),
      then: (res: (v: unknown) => unknown) => Promise.resolve(run()).then(res),
    };
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

const NOW = new Date('2026-11-08T12:00:00Z');
const water = (id: string, at: string, value: number): Row => ({
  id, user_id: 'u1', category: 'health', content: 'water', created_at: at,
  metadata: { dashboard_metrics: [{ key: 'water_ml', label: 'Water', value, unit: 'ml', aggregate: 'sum' }] },
});

describe('applyCorrection', () => {
  it('fixes the value on the latest entry that has the metric ("actually it was 3 glasses")', async () => {
    const rows = [water('a', '2026-11-08T08:00:00Z', 250), water('b', '2026-11-08T10:00:00Z', 500)];
    const out = await applyCorrection(fakeDb(rows), {
      userId: 'u1', actionType: 'update_entry', params: { metric_key: 'water', value: 3, unit: 'glasses' }, text: 'actually 3 glasses', cryptoKey: null, now: NOW,
    });
    expect(out).toMatchObject({ ok: true, kind: 'metric_updated', entryId: 'b', metric: { key: 'water_ml', value: 750 } });
    expect(rows.find((r) => r.id === 'a')!.metadata.dashboard_metrics).toEqual([expect.objectContaining({ value: 250 })]);
    const day = dailyValues(collectPoints(rows, 'Europe/Kyiv'), 'water_ml').get('2026-11-08');
    expect(day).toBe(1000);
  });

  it('saves a set-total entry that replaces the day total', async () => {
    const rows = [water('a', '2026-11-08T08:00:00Z', 250), water('b', '2026-11-08T09:00:00Z', 250)];
    const out = await applyCorrection(fakeDb(rows), {
      userId: 'u1', actionType: 'set_metric_total', params: { metric_key: 'water_ml', value: 2, unit: 'l' }, text: 'today 2 l in total', cryptoKey: null, now: NOW,
    });
    expect(out).toMatchObject({ ok: true, kind: 'total_set', category: 'health' });
    const day = dailyValues(collectPoints(rows, 'Europe/Kyiv'), 'water_ml').get('2026-11-08');
    expect(day).toBe(2000);
  });

  it('reports not_found when nothing recent has the metric and no new text was given', async () => {
    const out = await applyCorrection(fakeDb([]), {
      userId: 'u1', actionType: 'update_entry', params: { metric_key: 'sleep_hours', value: 7 }, text: 'not 8 but 7', cryptoKey: null, now: NOW,
    });
    expect(out).toEqual({ ok: false, reason: 'not_found' });
  });

  it('rejects a correction with nothing to change', async () => {
    const out = await applyCorrection(fakeDb([]), {
      userId: 'u1', actionType: 'update_entry', params: {}, text: 'fix it', cryptoKey: null, now: NOW,
    });
    expect(out).toEqual({ ok: false, reason: 'no_changes' });
  });

  it('replaces the text of the latest entry in the category and re-reads its numbers', async () => {
    const rows = [water('a', '2026-11-08T08:00:00Z', 250)];
    const out = await applyCorrection(fakeDb(rows), {
      userId: 'u1', actionType: 'update_entry', params: { category: 'health', new_content: 'drank 2 glasses of water' }, text: '', cryptoKey: null, now: NOW,
    });
    expect(out).toMatchObject({ ok: true, kind: 'content_updated', entryId: 'a' });
    expect(rows[0].content).toBe('drank 2 glasses of water');
    expect(rows[0].metadata.dashboard_metrics).toEqual([expect.objectContaining({ key: 'water_ml', value: 500 })]);
  });
});
