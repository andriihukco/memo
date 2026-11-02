import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import type { GraphEdge, GraphNode } from './api';

/**
 * Knowledge graph maths, shared by the native graph screen and its tests.
 * Layout is the same force model as the web graph (src/components/legacy/pages/graph.tsx):
 * branch links are short and strong, similarity links long and weak, and the whole thing is
 * centred. The layout runs to rest up front, so the screen draws a settled picture.
 */

export type LayoutNode = GraphNode & SimulationNodeDatum & { x: number; y: number };
export type LayoutLink = SimulationLinkDatum<LayoutNode> & { type: GraphEdge['type']; weight: number };

/** Node radius, as on web: grows with the number of links, capped. */
export const radiusOf = (edgeCount: number) => Math.min(5 + edgeCount * 1.5, 16);

/** Keep the most connected nodes, like the web view, so a large history stays readable. */
export const MAX_NODES = 200;

export function limitNodes(nodes: GraphNode[], edges: GraphEdge[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const keep = new Set([...nodes].sort((a, b) => b.edge_count - a.edge_count).slice(0, MAX_NODES).map((n) => n.id));
  return {
    nodes: nodes.filter((n) => keep.has(n.id)),
    edges: edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
  };
}

/** Period filter, measured back from `now`. 'all' keeps everything. */
export type Period = 'all' | 'today' | 'week' | 'month';

export function inPeriod(createdAt: string, period: Period, now: Date): boolean {
  if (period === 'all') return true;
  const t = new Date(createdAt).getTime();
  if (period === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return t >= start.getTime();
  }
  const days = period === 'week' ? 7 : 30;
  return t >= now.getTime() - days * 24 * 60 * 60 * 1000;
}

/** Runs the force simulation to rest and returns positioned nodes and links. Deterministic for a given input. */
export function layoutGraph(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): { nodes: LayoutNode[]; links: LayoutLink[] } {
  const layoutNodes: LayoutNode[] = nodes.map((n, i) => {
    // Start on a circle so the result does not depend on random initial positions.
    const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
    const r = Math.min(width, height) * 0.3;
    return { ...n, x: width / 2 + Math.cos(angle) * r, y: height / 2 + Math.sin(angle) * r };
  });
  const byId = new Map(layoutNodes.map((n) => [n.id, n]));
  const links: LayoutLink[] = edges
    .filter((e) => byId.has(e.source) && byId.has(e.target))
    .map((e) => ({ source: byId.get(e.source)!, target: byId.get(e.target)!, type: e.type, weight: e.weight }));

  const nodeCount = layoutNodes.length;
  const repulsion = nodeCount > 100 ? -600 : nodeCount > 50 ? -450 : -320;

  const sim = forceSimulation<LayoutNode>(layoutNodes)
    .force('link', forceLink<LayoutNode, LayoutLink>(links)
      .distance((d) => (d.type === 'branch' ? 120 : d.type === 'cross_category' ? 100 : 200))
      .strength((d) => (d.type === 'branch' ? 0.8 : d.type === 'cross_category' ? 0.4 : 0.08)))
    .force('charge', forceManyBody<LayoutNode>().strength(repulsion).distanceMax(500))
    .force('center', forceCenter(width / 2, height / 2).strength(0.03))
    .force('collision', forceCollide<LayoutNode>().radius((d) => radiusOf(d.edge_count) + 14))
    .force('x', forceX(width / 2).strength(0.02))
    .force('y', forceY(height / 2).strength(0.02))
    .stop();

  // Enough ticks to settle; more for big graphs.
  const ticks = Math.min(400, 120 + nodeCount);
  for (let i = 0; i < ticks; i++) sim.tick();
  return { nodes: layoutNodes, links };
}

/** Ids connected to `id` by any edge, not including `id`. */
export function neighborsOf(id: string, edges: GraphEdge[]): Set<string> {
  const out = new Set<string>();
  for (const e of edges) {
    if (e.source === id) out.add(e.target);
    else if (e.target === id) out.add(e.source);
  }
  return out;
}

/**
 * Clusters: connected components with at least three nodes, named after their most common category.
 * Same rule as the web labels.
 */
export function clusterLabels(nodes: LayoutNode[], edges: GraphEdge[]): { x: number; y: number; category: string }[] {
  const parent = new Map(nodes.map((n) => [n.id, n.id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  for (const e of edges) {
    if (!parent.has(e.source) || !parent.has(e.target)) continue;
    const a = find(e.source);
    const b = find(e.target);
    if (a !== b) parent.set(a, b);
  }
  const groups = new Map<string, LayoutNode[]>();
  for (const n of nodes) {
    const root = find(n.id);
    groups.set(root, [...(groups.get(root) ?? []), n]);
  }
  const labels: { x: number; y: number; category: string }[] = [];
  for (const group of groups.values()) {
    if (group.length < 3) continue;
    const freq = new Map<string, number>();
    for (const n of group) freq.set(n.category, (freq.get(n.category) ?? 0) + 1);
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
    labels.push({
      x: group.reduce((s, n) => s + n.x, 0) / group.length,
      y: Math.min(...group.map((n) => n.y)) - 16,
      category: top,
    });
  }
  return labels;
}

/** Scale and offset that fit every node in the viewport, with padding. */
export function fitView(nodes: LayoutNode[], width: number, height: number, padding = 40): { scale: number; x: number; y: number } {
  if (nodes.length === 0) return { scale: 1, x: 0, y: 0 };
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const w = Math.max(Math.max(...xs) - Math.min(...xs), 60);
  const h = Math.max(Math.max(...ys) - Math.min(...ys), 60);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const scale = Math.min(2.5, Math.max(0.3, Math.min((width - padding * 2) / w, (height - padding * 2) / h)));
  return { scale, x: width / 2 - scale * cx, y: height / 2 - scale * cy };
}
