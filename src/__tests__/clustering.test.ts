/**
 * Property-based tests for clusterEntries() using fast-check.
 *
 * Since clusterEntries() is DB-coupled, we mock Supabase and test the
 * observable behavior: the branch_id assignments written to the DB.
 *
 * Properties tested:
 *  1. Idempotency — applying clusterEntries twice produces the same branch_id
 *     assignments as applying it once.
 *  2. Cluster count bound — the number of distinct clusters never exceeds the
 *     number of input entries.
 *
 * **Validates: Requirements 18 (property-based tests for clusterEntries)**
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

// ── Mock env ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/env', () => ({
  env: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test_service_role_key',
    GEMINI_API_KEY: 'test_gemini_key',
  },
}));

// ── Supabase mock infrastructure ──────────────────────────────────────────────

// We capture the branch_id updates written by clusterEntries so we can
// verify idempotency and cluster count properties.

interface EntryRow {
  id: string;
  content: string;
  category: string;
  metadata: Record<string, unknown>;
  embedding: string | null;
  branch_id: string | null;
  created_at: string;
}

// Shared state for the mock — reset before each test
let mockEntries: EntryRow[] = [];
let branchIdUpdates: Map<string, string> = new Map(); // entryId → branchId

// Similarity function: two entries are "similar" if they share the same category
// This gives us deterministic, controllable clustering for property tests.
function findSimilarEntries(
  entries: EntryRow[],
  embedding: string,
  excludeId: string,
  topK: number
): Array<{ id: string; similarity: number }> {
  // embedding encodes the category as a simple string
  const category = embedding;
  return entries
    .filter((e) => e.id !== excludeId && e.embedding === category)
    .slice(0, topK)
    .map((e) => ({ id: e.id, similarity: 0.9 })); // above 0.75 threshold
}

const mockRpc = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockNot = vi.fn();
const mockIn = vi.fn();

function buildMockChain() {
  // Chainable mock that resolves at the end
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'not', 'in', 'update', 'single', 'maybeSingle'];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  return chain;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'entries') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                not: vi.fn(() =>
                  Promise.resolve({ data: mockEntries, error: null })
                ),
              })),
            })),
          })),
          update: vi.fn((updates: { branch_id?: string }) => ({
            in: vi.fn((col: string, ids: string[]) => {
              // Record the branch_id assignment
              if (updates.branch_id && col === 'id') {
                for (const id of ids) {
                  branchIdUpdates.set(id, updates.branch_id);
                  // Also update mockEntries so second run sees the branch_ids
                  const entry = mockEntries.find((e) => e.id === id);
                  if (entry) entry.branch_id = updates.branch_id;
                }
              }
              return Promise.resolve({ error: null });
            }),
          })),
        };
      }
      if (table === 'insights') {
        return {
          update: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ error: null })),
          })),
        };
      }
      return buildMockChain();
    }),
    rpc: vi.fn((name: string, params: { p_embedding: string; p_exclude_id: string; p_top_k: number }) => {
      if (name === 'find_similar_entries') {
        const similar = findSimilarEntries(
          mockEntries,
          params.p_embedding,
          params.p_exclude_id,
          params.p_top_k
        );
        return Promise.resolve({ data: similar, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    }),
  })),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { clusterEntries } from '@/lib/processing/loop';

// ── Arbitraries ───────────────────────────────────────────────────────────────

// Use a small set of categories so entries cluster meaningfully
const CATEGORIES = ['calories', 'workout', 'sleep', 'health', 'thoughts'];

const MIN_TS = Date.UTC(2024, 0, 1);
const MAX_TS = Date.UTC(2025, 0, 1);

const entryArbitrary = fc.record({
  id: fc.uuid(),
  content: fc.string({ minLength: 1, maxLength: 50 }),
  category: fc.constantFrom(...CATEGORIES),
  metadata: fc.constant({}),
  // embedding = category string (our mock similarity uses this)
  embedding: fc.constantFrom(...CATEGORIES),
  branch_id: fc.constant(null) as fc.Arbitrary<string | null>,
  created_at: fc.integer({ min: MIN_TS, max: MAX_TS })
    .map((ts) => new Date(ts).toISOString()),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('clusterEntries() — property-based tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntries = [];
    branchIdUpdates = new Map();
  });

  it(
    // **Validates: Requirements 18**
    'Property: cluster count bound — distinct branch_ids ≤ number of input entries',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(entryArbitrary, { minLength: 3, maxLength: 50 }),
          async (entries) => {
            // Reset state
            mockEntries = entries.map((e) => ({ ...e, branch_id: null }));
            branchIdUpdates = new Map();

            await clusterEntries('test-user-id');

            const distinctBranchIds = new Set(branchIdUpdates.values());
            // Cluster count must not exceed entry count
            expect(distinctBranchIds.size).toBeLessThanOrEqual(entries.length);
          }
        ),
        { numRuns: 50 }
      );
    }
  );

  it(
    // **Validates: Requirements 18**
    'Property: idempotency — applying clusterEntries twice yields same branch_id assignments',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(entryArbitrary, { minLength: 3, maxLength: 30 }),
          async (entries) => {
            // ── First run ──────────────────────────────────────────────────
            mockEntries = entries.map((e) => ({ ...e, branch_id: null }));
            branchIdUpdates = new Map();

            await clusterEntries('test-user-id');

            // Capture first-run assignments
            const firstRunAssignments = new Map(branchIdUpdates);

            // ── Second run (entries now have branch_ids from first run) ────
            // mockEntries already has branch_ids updated by the first run
            branchIdUpdates = new Map();

            await clusterEntries('test-user-id');

            const secondRunAssignments = new Map(branchIdUpdates);

            // For every entry that was assigned a branch_id in the first run,
            // the second run must assign the same branch_id (idempotency).
            // Entries that were NOT clustered in run 1 should also not be
            // clustered in run 2 (they remain null).
            for (const [entryId, branchId] of firstRunAssignments) {
              const secondBranchId = secondRunAssignments.get(entryId);
              // The second run should assign the same branch_id
              expect(secondBranchId).toBe(branchId);
            }

            // Entries not clustered in run 1 should not be newly clustered in run 2
            for (const [entryId] of secondRunAssignments) {
              expect(firstRunAssignments.has(entryId)).toBe(true);
            }
          }
        ),
        { numRuns: 30 }
      );
    }
  );

  it('does not cluster when fewer than 3 entries exist', async () => {
    mockEntries = [
      {
        id: 'a',
        content: 'entry a',
        category: 'calories',
        metadata: {},
        embedding: 'calories',
        branch_id: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 'b',
        content: 'entry b',
        category: 'calories',
        metadata: {},
        embedding: 'calories',
        branch_id: null,
        created_at: new Date().toISOString(),
      },
    ];
    branchIdUpdates = new Map();

    await clusterEntries('test-user-id');

    // With < 3 entries, clusterEntries returns early — no updates
    expect(branchIdUpdates.size).toBe(0);
  });

  it('assigns distinct branch_ids to entries in different categories', async () => {
    // 3 calories entries + 3 workout entries → 2 clusters
    mockEntries = [
      { id: 'c1', content: 'cal 1', category: 'calories', metadata: {}, embedding: 'calories', branch_id: null, created_at: new Date().toISOString() },
      { id: 'c2', content: 'cal 2', category: 'calories', metadata: {}, embedding: 'calories', branch_id: null, created_at: new Date().toISOString() },
      { id: 'c3', content: 'cal 3', category: 'calories', metadata: {}, embedding: 'calories', branch_id: null, created_at: new Date().toISOString() },
      { id: 'w1', content: 'wkt 1', category: 'workout', metadata: {}, embedding: 'workout', branch_id: null, created_at: new Date().toISOString() },
      { id: 'w2', content: 'wkt 2', category: 'workout', metadata: {}, embedding: 'workout', branch_id: null, created_at: new Date().toISOString() },
      { id: 'w3', content: 'wkt 3', category: 'workout', metadata: {}, embedding: 'workout', branch_id: null, created_at: new Date().toISOString() },
    ];
    branchIdUpdates = new Map();

    await clusterEntries('test-user-id');

    const calBranchIds = new Set(['c1', 'c2', 'c3'].map((id) => branchIdUpdates.get(id)).filter(Boolean));
    const wktBranchIds = new Set(['w1', 'w2', 'w3'].map((id) => branchIdUpdates.get(id)).filter(Boolean));

    // Each group should have exactly one branch_id
    expect(calBranchIds.size).toBe(1);
    expect(wktBranchIds.size).toBe(1);

    // The two groups should have different branch_ids
    const [calId] = calBranchIds;
    const [wktId] = wktBranchIds;
    expect(calId).not.toBe(wktId);
  });
});
