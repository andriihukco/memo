import { describe, expect, it } from 'vitest';
import { clusterLabels, fitView, inPeriod, layoutGraph, limitNodes, neighborsOf, MAX_NODES } from '../graph';
import type { GraphEdge, GraphNode } from '../api';

const node = (id: string, category: string, edgeCount = 0, createdAt = '2026-10-30T12:00:00Z'): GraphNode => ({
  id,
  label: `entry ${id}`,
  category,
  categories: [category],
  created_at: createdAt,
  edge_count: edgeCount,
});

const nodes = [node('a', 'workout', 2), node('b', 'workout', 2), node('c', 'workout', 1), node('d', 'ideas', 0)];
const edges: GraphEdge[] = [
  { source: 'a', target: 'b', weight: 1, type: 'branch' },
  { source: 'b', target: 'c', weight: 0.6, type: 'similarity' },
  { source: 'a', target: 'c', weight: 0.5, type: 'similarity' },
];

describe('graph layout', () => {
  it('places every node at a finite position inside a sane range', () => {
    const { nodes: laid, links } = layoutGraph(nodes, edges, 400, 460);
    expect(laid).toHaveLength(4);
    for (const n of laid) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
    expect(links).toHaveLength(3);
  });

  it('is deterministic for the same input', () => {
    const first = layoutGraph(nodes, edges, 400, 460).nodes.map((n) => [n.x, n.y]);
    const second = layoutGraph(nodes, edges, 400, 460).nodes.map((n) => [n.x, n.y]);
    expect(second).toEqual(first);
  });

  it('drops edges that point at nodes outside the set', () => {
    const { links } = layoutGraph(nodes, [...edges, { source: 'a', target: 'zzz', weight: 1, type: 'branch' }], 400, 460);
    expect(links).toHaveLength(3);
  });
});

describe('neighbours and clusters', () => {
  it('lists the nodes linked to a given node, without itself', () => {
    expect([...neighborsOf('a', edges)].sort()).toEqual(['b', 'c']);
    expect(neighborsOf('d', edges).size).toBe(0);
  });

  it('labels only groups of three or more, named after the most common category', () => {
    const laid = layoutGraph(nodes, edges, 400, 460).nodes;
    const labels = clusterLabels(laid, edges);
    expect(labels).toHaveLength(1);
    expect(labels[0].category).toBe('workout');
  });
});

describe('period and limits', () => {
  const now = new Date('2026-11-01T12:00:00Z');

  it('keeps entries inside the chosen period', () => {
    expect(inPeriod('2026-10-30T12:00:00Z', 'week', now)).toBe(true);
    expect(inPeriod('2026-09-01T12:00:00Z', 'week', now)).toBe(false);
    expect(inPeriod('2026-09-01T12:00:00Z', 'all', now)).toBe(true);
  });

  it('keeps the most connected nodes when there are too many', () => {
    const many = Array.from({ length: MAX_NODES + 20 }, (_, i) => node(`n${i}`, 'ideas', i));
    const kept = limitNodes(many, []).nodes;
    expect(kept).toHaveLength(MAX_NODES);
    expect(kept.some((n) => n.id === `n${MAX_NODES + 19}`)).toBe(true);
  });
});

describe('fit view', () => {
  it('returns a finite scale and offset for a laid-out graph', () => {
    const laid = layoutGraph(nodes, edges, 400, 460).nodes;
    const v = fitView(laid, 400, 460);
    expect(v.scale).toBeGreaterThan(0);
    expect(Number.isFinite(v.x) && Number.isFinite(v.y)).toBe(true);
  });
});
