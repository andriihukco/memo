/**
 * Property-based tests for the smart-bot-reply feature.
 * Feature: smart-bot-reply
 *
 * Tests are implemented using fast-check (fc) and vitest.
 * generateConverseReply is mocked to avoid real AI calls.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

// Mock the AI backend before importing the module under test
vi.mock('@/lib/bot/converse', () => ({
  generateConverseReply: vi.fn(),
}));

import { generateConverseReply } from '@/lib/bot/converse';
import type { DashboardMetric, EntryPayload } from '@/lib/classifier';
import {
  buildLogSummary,
  buildFallbackReply,
  buildSmartReplyPrompt,
  orderMetrics,
  PRIMARY_METRIC_KEYS,
  generateSmartReply,
  type SmartReplyOptions,
} from '@/lib/bot/smart-reply';
import { sanitizeMarkdown } from '@/lib/utils';

// ── Arbitraries & helpers ─────────────────────────────────────────────────────

/** Arbitrary for a valid DashboardMetric */
function arbitraryDashboardMetric(): fc.Arbitrary<DashboardMetric> {
  return fc.record({
    key: fc.oneof(
      // Mix of primary and secondary keys
      fc.constantFrom(
        'kcal_intake', 'protein_g', 'distance_km', 'sleep_hours',
        'expense_amount', 'mood_score', 'weight_kg', 'alcohol_units',
        'caffeine_mg', 'active_min',
      ),
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z][a-z0-9_]*$/.test(s)),
    ),
    // Labels come from the AI in natural language — exclude markdown special chars
    // (*, _, `) that sanitizeMarkdown would strip, since real labels never contain them.
    label: fc.string({ minLength: 1, maxLength: 30 }).filter(s => !/[*_`]/.test(s)),
    value: fc.float({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
    // Units also come from the AI — exclude markdown special chars
    unit: fc.string({ minLength: 0, maxLength: 10 }).filter(s => !/[*_`]/.test(s)),
    aggregate: fc.constantFrom('sum', 'avg', 'last') as fc.Arbitrary<'sum' | 'avg' | 'last'>,
  });
}

/** Helper to create a minimal EntryPayload */
function makeEntry(overrides: Partial<EntryPayload> = {}): EntryPayload {
  return {
    category: 'calories',
    category_label: 'Калорії',
    is_new_category: false,
    content: 'test content',
    metadata: {},
    dashboard_metrics: [],
    goal_metrics: [],
    ...overrides,
  };
}

/** Arbitrary for an EntryPayload with at least one metric */
function arbitraryEntryPayloadWithMetrics(): fc.Arbitrary<EntryPayload> {
  return fc.record({
    category: fc.constantFrom('calories', 'workout', 'sleep', 'health', 'expenses'),
    category_label: fc.string({ minLength: 1, maxLength: 20 }),
    is_new_category: fc.boolean(),
    content: fc.string({ minLength: 1, maxLength: 100 }),
    metadata: fc.constant({}),
    dashboard_metrics: fc.array(arbitraryDashboardMetric(), { minLength: 1, maxLength: 5 }),
    goal_metrics: fc.constant([]),
  });
}

/** Helper to create SmartReplyOptions */
function makeSmartReplyOptions(overrides: Partial<SmartReplyOptions> = {}): SmartReplyOptions {
  return {
    entries: [makeEntry()],
    userMessage: 'test message',
    userCtx: { tone: '', memory: {} },
    intent: 'save_entry',
    ...overrides,
  };
}

// ── Reset mocks between tests ─────────────────────────────────────────────────

beforeEach(() => vi.clearAllMocks());

// ── Pure function property tests (no mocking needed) ─────────────────────────

describe('buildLogSummary', () => {
  it(
    // Feature: smart-bot-reply, Property 1: buildLogSummary renders every metric as label: value unit
    'Property 1: renders every metric label in the summary',
    () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryDashboardMetric(), { minLength: 1, maxLength: 10 }),
          (metrics) => {
            const entry = makeEntry({ dashboard_metrics: metrics });
            const summary = buildLogSummary(entry);
            return metrics
              .filter(m => isFinite(m.value) && !isNaN(m.value))
              .every(m => {
                const label = m.label || m.key;
                return summary.includes(label);
              });
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    // Feature: smart-bot-reply, Property 3: buildLogSummary contains no emoji characters
    'Property 3: contains no emoji characters',
    () => {
      const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
      fc.assert(
        fc.property(
          fc.array(arbitraryDashboardMetric(), { minLength: 1, maxLength: 10 }),
          (metrics) => {
            const entry = makeEntry({ dashboard_metrics: metrics });
            return !EMOJI_REGEX.test(buildLogSummary(entry));
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    // Feature: smart-bot-reply, Property 4: buildLogSummary output is unchanged by sanitizeMarkdown
    'Property 4: output is unchanged by sanitizeMarkdown (idempotent)',
    () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryDashboardMetric(), { minLength: 1, maxLength: 10 }),
          (metrics) => {
            const entry = makeEntry({ dashboard_metrics: metrics });
            const summary = buildLogSummary(entry);
            return sanitizeMarkdown(summary) === summary;
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});

describe('orderMetrics', () => {
  it(
    // Feature: smart-bot-reply, Property 2: orderMetrics places primary keys before secondary keys
    'Property 2: places primary keys before secondary keys',
    () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryDashboardMetric(), { minLength: 2, maxLength: 10 })
            .filter(
              ms =>
                ms.some(m => PRIMARY_METRIC_KEYS.has(m.key)) &&
                ms.some(m => !PRIMARY_METRIC_KEYS.has(m.key)),
            ),
          (metrics) => {
            const ordered = orderMetrics(metrics);
            const lastPrimaryIdx = ordered.map(m => PRIMARY_METRIC_KEYS.has(m.key)).lastIndexOf(true);
            const firstSecondaryIdx = ordered.findIndex(m => !PRIMARY_METRIC_KEYS.has(m.key));
            return lastPrimaryIdx < firstSecondaryIdx;
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});

describe('buildFallbackReply', () => {
  it(
    // Feature: smart-bot-reply, Property 8: buildFallbackReply contains category_label and a metric value
    'Property 8: contains category_label and a metric value for entries with metrics',
    () => {
      fc.assert(
        fc.property(
          arbitraryEntryPayloadWithMetrics(),
          (entry) => {
            const fallback = buildFallbackReply([entry]);
            const hasLabel = fallback.includes(entry.category_label);
            const hasValue = entry.dashboard_metrics.some(m => {
              const displayValue = String(parseFloat(m.value.toFixed(1)));
              return fallback.includes(displayValue);
            });
            return hasLabel && hasValue;
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    // Feature: smart-bot-reply, Property 9: buildFallbackReply content portion is at most 60 chars
    'Property 9: content portion is at most 60 chars for entries without metrics',
    () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 500 }),
          (content) => {
            const entry = makeEntry({ content, dashboard_metrics: [] });
            const fallback = buildFallbackReply([entry]);
            // The content portion is everything after "<category_label>: " and before " ✓"
            const prefix = entry.category_label + ': ';
            const suffix = ' ✓';
            const contentPortion = fallback.startsWith(prefix)
              ? fallback.slice(prefix.length, fallback.length - suffix.length)
              : fallback;
            return contentPortion.length <= 60;
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});

describe('buildSmartReplyPrompt', () => {
  it(
    // Feature: smart-bot-reply, Property 10: buildSmartReplyPrompt includes thread context as substring
    'Property 10: includes thread context as substring',
    () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          (threadCtx) => {
            const options = makeSmartReplyOptions({ threadCtx });
            const prompt = buildSmartReplyPrompt(options);
            return prompt.includes(threadCtx);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});

// ── Tests requiring mocked generateConverseReply ──────────────────────────────

describe('generateSmartReply', () => {
  it(
    // Feature: smart-bot-reply, Property 6: generateSmartReply returns a single non-empty string for any entry count
    'Property 6: returns a single non-empty string for any entry count',
    async () => {
      vi.mocked(generateConverseReply).mockResolvedValue('AI відповідь.');
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbitraryEntryPayloadWithMetrics(), { minLength: 1, maxLength: 5 }),
          async (entries) => {
            const result = await generateSmartReply(makeSmartReplyOptions({ entries }));
            return typeof result.text === 'string' && result.text.length > 0;
          },
        ),
        { numRuns: 50 },
      );
    },
  );

  it('returns usedFallback: true and non-empty text when AI throws', async () => {
    vi.mocked(generateConverseReply).mockRejectedValue(new Error('AI error'));
    const entry = makeEntry({
      category_label: 'Калорії',
      dashboard_metrics: [
        {
          key: 'kcal_intake',
          label: 'Калорії',
          value: 525,
          unit: 'ккал',
          aggregate: 'sum',
        },
      ],
    });
    const result = await generateSmartReply(makeSmartReplyOptions({ entries: [entry] }));
    expect(result.usedFallback).toBe(true);
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('returns non-empty string when entries is empty', async () => {
    vi.mocked(generateConverseReply).mockResolvedValue('AI відповідь.');
    const result = await generateSmartReply(makeSmartReplyOptions({ entries: [] }));
    expect(result.text.length).toBeGreaterThan(0);
  });
});
