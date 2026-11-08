/**
 * Turns what someone typed on the web into what the bot would have saved: a category, canonical
 * metrics and goals, or a correction of an earlier entry. Same classifier, same fixed rules
 * (src/lib/metric-extract.ts), so "2 glasses of water" means 500 ml wherever it was typed.
 */
import { classify, extractEntryMetrics, type DashboardMetric, type GoalMetric } from '@/lib/classifier';
import { finalizeMetrics } from '@/lib/metric-extract';
import { detectCategory } from '@/lib/auto-category';
import { aiEnabled } from '@/lib/ai';
import type { KnownCategory } from '@/lib/category-config';

export type Enriched =
  | {
      kind: 'entry';
      category: string;
      /** Set when the classifier made a new category the user does not have yet. */
      newCategory: { name: string; label: string } | null;
      metrics: DashboardMetric[];
      goals: GoalMetric[];
      metadata: Record<string, unknown>;
    }
  | { kind: 'correction'; actionType: 'update_entry' | 'set_metric_total'; params: Record<string, unknown> };

/** Without AI: the keyword category and the fixed rules only. */
function plain(content: string, picked: string | undefined, metadata: Record<string, unknown>): Enriched {
  return {
    kind: 'entry',
    category: picked ?? detectCategory(content).category,
    newCategory: null,
    metrics: finalizeMetrics(content, []),
    goals: [],
    metadata,
  };
}

/**
 * @param picked the category the user chose. When set, only metrics are extracted.
 * @param allowCorrection false for entries with attachments, which are always new entries.
 */
export async function enrichWebEntry(opts: {
  content: string;
  picked?: string;
  metadata?: Record<string, unknown>;
  categories: KnownCategory[];
  allowCorrection?: boolean;
}): Promise<Enriched> {
  const { content, picked, categories, allowCorrection = true } = opts;
  const metadata = opts.metadata ?? {};
  if (!aiEnabled()) return plain(content, picked, metadata);

  try {
    if (picked) {
      const extracted = await extractEntryMetrics(picked, content, metadata);
      return { kind: 'entry', category: picked, newCategory: null, metrics: extracted.dashboard_metrics, goals: extracted.goal_metrics, metadata: extracted.metadata };
    }

    const result = await classify(content, undefined, categories);
    if (
      allowCorrection &&
      result.intent === 'action' &&
      (result.action_type === 'update_entry' || result.action_type === 'set_metric_total')
    ) {
      return { kind: 'correction', actionType: result.action_type, params: result.action_params };
    }

    // Everything typed into the journal is kept, even a question or a greeting.
    const parts = result.entries.length > 0 ? result.entries : [];
    if (parts.length === 0) return plain(content, undefined, metadata);
    const first = parts[0];
    // One web note stays one entry. Metrics from every topic in it are kept (food + run).
    const metrics = finalizeMetrics(content, parts.flatMap((p) => p.dashboard_metrics));
    return {
      kind: 'entry',
      category: first.category,
      newCategory: first.is_new_category ? { name: first.category, label: first.category_label } : null,
      metrics,
      goals: parts.flatMap((p) => p.goal_metrics),
      metadata: { ...(first.metadata as Record<string, unknown>), ...metadata },
    };
  } catch (err) {
    console.error('[enrichWebEntry] falling back to plain save:', err);
    return plain(content, picked, metadata);
  }
}
