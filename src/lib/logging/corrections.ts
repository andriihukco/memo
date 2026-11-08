/**
 * Corrections, shared by the bot and the web, so a fix typed anywhere changes the numbers everywhere.
 *
 * - update_entry ("actually it was 3 glasses"): finds the latest recent entry that has that metric
 *   and changes its value. With new text, the text is replaced (encrypted) and its metrics re-read.
 * - set_metric_total ("2 l in total today"): saves an entry whose metric has `mode: "set"`, which
 *   replaces the day's running total from that moment (see src/lib/metrics.ts).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { encryptField } from '@/lib/crypto';
import { canonicalKey, normalizeMetric, normalizeMetrics, toBaseUnit, type Metric } from '@/lib/metrics';
import { categoryForMetric, finalizeMetrics } from '@/lib/metric-extract';
import { extractEntryMetrics } from '@/lib/classifier';
import { aiEnabled } from '@/lib/ai';

export type CorrectionResult =
  | { ok: true; kind: 'metric_updated' | 'content_updated' | 'total_set'; entryId: string; metric: Metric | null; content: string | null; category: string }
  | { ok: false; reason: 'not_found' | 'no_changes' | 'error' };

/** How far back an "actually…" correction looks for the entry it fixes. */
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;

interface Row {
  id: string;
  category: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export async function applyCorrection(
  sb: SupabaseClient,
  opts: {
    userId: string;
    actionType: 'update_entry' | 'set_metric_total';
    params: Record<string, unknown>;
    /** What the user typed, kept as the text of a set-total entry. */
    text: string;
    cryptoKey: CryptoKey | null;
    now?: Date;
  },
): Promise<CorrectionResult> {
  const { userId, params, text, cryptoKey } = opts;
  const now = opts.now ?? new Date();
  const seal = async (plain: string) => (cryptoKey ? encryptField(plain, cryptoKey) : plain);

  if (opts.actionType === 'set_metric_total') {
    const metric = normalizeMetric({ key: str(params.metric_key) ?? '', value: num(params.value) ?? NaN, unit: str(params.unit) ?? undefined, label: str(params.label) ?? undefined });
    if (!metric) return { ok: false, reason: 'no_changes' };
    const category = categoryForMetric(metric.key);
    const { data, error } = await sb
      .from('entries')
      .insert({
        user_id: userId,
        content: await seal(text.trim()),
        category,
        metadata: { dashboard_metrics: [{ ...metric, mode: 'set' }], correction: 'set_total', occurred_at: now.toISOString() },
        raw_media_url: null,
      })
      .select('id')
      .single();
    if (error || !data) return { ok: false, reason: 'error' };
    return { ok: true, kind: 'total_set', entryId: data.id as string, metric: { ...metric, mode: 'set' }, content: null, category };
  }

  // update_entry
  const key = str(params.metric_key) ? canonicalKey(str(params.metric_key)!) : null;
  const value = num(params.value);
  const newContent = str(params.new_content);
  const wantedCategory = str(params.new_category) ?? str(params.category);
  if ((!key || value === null) && !newContent) return { ok: false, reason: 'no_changes' };

  let query = sb
    .from('entries')
    .select('id, category, metadata, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  const entryId = str(params.entry_id);
  query = entryId ? query.eq('id', entryId) : query.gte('created_at', new Date(now.getTime() - LOOKBACK_MS).toISOString());
  const { data: rows, error: loadErr } = await query;
  if (loadErr) return { ok: false, reason: 'error' };
  const recent = (rows ?? []) as Row[];

  // Prefer the latest entry that carries the metric being fixed; otherwise the latest in the category.
  const hasMetric = (r: Row) => !!key && normalizeMetrics(r.metadata?.dashboard_metrics).some((m) => m.key === key);
  const target =
    recent.find(hasMetric) ??
    (newContent ? recent.find((r) => !wantedCategory || r.category === wantedCategory) : undefined);
  if (!target) return { ok: false, reason: 'not_found' };

  const meta = { ...(target.metadata ?? {}) };
  let metrics = normalizeMetrics(meta.dashboard_metrics);
  const updates: Record<string, unknown> = {};
  let changed: Metric | null = null;

  if (newContent) {
    updates.content = await seal(newContent);
    updates.embedding_status = 'pending';
    // Re-read numbers from the corrected text; keep the old ones if nothing could be read.
    const reread = aiEnabled()
      ? (await extractEntryMetrics(target.category, newContent).catch(() => null))?.dashboard_metrics ?? []
      : finalizeMetrics(newContent, []);
    if (reread.length > 0) metrics = normalizeMetrics(reread);
  }

  if (key && value !== null) {
    const unit = str(params.unit) ?? undefined;
    const base = toBaseUnit(key, value, unit);
    const existing = metrics.find((m) => m.key === key);
    if (existing) {
      metrics = metrics.map((m) => (m.key === key ? { ...m, value: Math.round(base * 100) / 100 } : m));
    } else {
      const added = normalizeMetric({ key, value, unit });
      if (added) metrics = [...metrics, added];
    }
    changed = metrics.find((m) => m.key === key) ?? null;
  }

  updates.metadata = { ...meta, dashboard_metrics: metrics, corrected_at: now.toISOString() };

  const { error } = await sb.from('entries').update(updates).eq('id', target.id).eq('user_id', userId);
  if (error) return { ok: false, reason: 'error' };
  return {
    ok: true,
    kind: changed ? 'metric_updated' : 'content_updated',
    entryId: target.id,
    metric: changed,
    content: newContent,
    category: target.category,
  };
}
