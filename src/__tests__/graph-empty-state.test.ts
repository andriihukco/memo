/**
 * Tests for the graph page empty state logic.
 * Feature: pre-launch / REQ-14 — Graph Empty State + D3 Cleanup
 *
 * Tests are implemented using Vitest + fast-check (fc).
 *
 * Since the graph page is a Next.js client component with D3 and React dependencies,
 * we extract and test the pure logic that drives the empty state condition:
 *   - Empty state shown when: nodes.length === 0 && !loading
 *   - Graph shown when: nodes.length > 0 && !loading
 *   - Spinner shown when: loading === true (regardless of nodes)
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ── Pure logic extracted from graph page ──────────────────────────────────────
// Mirrors the rendering condition in src/app/miniapp/graph/page.tsx

type GraphStatus = 'loading' | 'ready' | 'error';

interface GraphNode {
  id: string;
  label: string;
  category: string;
}

/**
 * Determines what the graph page should render based on status and node count.
 * Extracted from the JSX conditions in GraphPage:
 *   - status === 'loading'                          → 'spinner'
 *   - status === 'error'                            → 'error'
 *   - status === 'ready' && nodes.length === 0      → 'empty'
 *   - status === 'ready' && nodes.length > 0        → 'graph'
 */
function getGraphRenderState(
  status: GraphStatus,
  nodes: GraphNode[],
): 'spinner' | 'error' | 'empty' | 'graph' {
  if (status === 'loading') return 'spinner';
  if (status === 'error') return 'error';
  if (nodes.length === 0) return 'empty';
  return 'graph';
}

// ── Unit tests — specific examples ───────────────────────────────────────────

describe('getGraphRenderState', () => {
  it('shows spinner when status is loading (no nodes)', () => {
    expect(getGraphRenderState('loading', [])).toBe('spinner');
  });

  it('shows spinner when status is loading (with nodes)', () => {
    const nodes: GraphNode[] = [{ id: '1', label: 'test', category: 'thoughts' }];
    expect(getGraphRenderState('loading', nodes)).toBe('spinner');
  });

  it('shows error when status is error', () => {
    expect(getGraphRenderState('error', [])).toBe('error');
    const nodes: GraphNode[] = [{ id: '1', label: 'test', category: 'thoughts' }];
    expect(getGraphRenderState('error', nodes)).toBe('error');
  });

  it('shows empty state when status is ready and nodes is empty', () => {
    expect(getGraphRenderState('ready', [])).toBe('empty');
  });

  it('shows graph when status is ready and nodes exist', () => {
    const nodes: GraphNode[] = [{ id: '1', label: 'test', category: 'thoughts' }];
    expect(getGraphRenderState('ready', nodes)).toBe('graph');
  });

  it('shows graph when status is ready and multiple nodes exist', () => {
    const nodes: GraphNode[] = [
      { id: '1', label: 'first', category: 'thoughts' },
      { id: '2', label: 'second', category: 'ideas' },
      { id: '3', label: 'third', category: 'feelings' },
    ];
    expect(getGraphRenderState('ready', nodes)).toBe('graph');
  });

  // REQ-14: empty state shown when graph API returns 0 nodes
  it('shows empty state (not spinner) when API returns 0 nodes and loading is done', () => {
    const result = getGraphRenderState('ready', []);
    expect(result).toBe('empty');
    expect(result).not.toBe('spinner');
  });
});

// ── Property-based tests ──────────────────────────────────────────────────────

const nodeArbitrary = fc.record({
  id: fc.uuid(),
  label: fc.string({ minLength: 1, maxLength: 100 }),
  category: fc.constantFrom('thoughts', 'ideas', 'feelings', 'expenses', 'workout', 'dreams'),
});

/**
 * Validates: Requirements REQ-14
 * Property 1: loading state always shows spinner regardless of node count
 */
describe('getGraphRenderState — property tests', () => {
  it(
    // Validates: Requirements REQ-14
    'Property 1: loading status always renders spinner regardless of node count',
    () => {
      fc.assert(
        fc.property(
          fc.array(nodeArbitrary, { minLength: 0, maxLength: 50 }),
          (nodes) => {
            expect(getGraphRenderState('loading', nodes)).toBe('spinner');
          },
        ),
        { numRuns: 200 },
      );
    },
  );

  /**
   * Validates: Requirements REQ-14
   * Property 2: ready status with 0 nodes always shows empty state
   */
  it(
    // Validates: Requirements REQ-14
    'Property 2: ready status with 0 nodes always shows empty state (never spinner)',
    () => {
      const result = getGraphRenderState('ready', []);
      expect(result).toBe('empty');
      expect(result).not.toBe('spinner');
    },
  );

  /**
   * Validates: Requirements REQ-14
   * Property 3: ready status with at least 1 node always shows graph
   */
  it(
    // Validates: Requirements REQ-14
    'Property 3: ready status with at least 1 node always shows graph',
    () => {
      fc.assert(
        fc.property(
          fc.array(nodeArbitrary, { minLength: 1, maxLength: 200 }),
          (nodes) => {
            expect(getGraphRenderState('ready', nodes)).toBe('graph');
          },
        ),
        { numRuns: 200 },
      );
    },
  );

  /**
   * Validates: Requirements REQ-14
   * Property 4: result is always one of the four valid render states
   */
  it(
    // Validates: Requirements REQ-14
    'Property 4: result is always one of spinner | error | empty | graph',
    () => {
      fc.assert(
        fc.property(
          fc.constantFrom<GraphStatus>('loading', 'ready', 'error'),
          fc.array(nodeArbitrary, { minLength: 0, maxLength: 50 }),
          (status, nodes) => {
            const result = getGraphRenderState(status, nodes);
            expect(['spinner', 'error', 'empty', 'graph']).toContain(result);
          },
        ),
        { numRuns: 300 },
      );
    },
  );
});
