'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAuth } from '@/lib/supabase/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { EditDrawer, getCategoryLabel, categoryBadge } from '@/components/ui/edit-drawer';

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = string;

interface GraphNode {
  id: string;
  label: string;
  category: Category;
  created_at: string;
  edge_count: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: 'branch' | 'similarity';
}

interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  category: Category;
  created_at: string;
  edge_count: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
  type: 'branch' | 'similarity';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_HEX: Record<string, string> = {
  thoughts: '#6366f1',
  ideas: '#f59e0b',
  feelings: '#ec4899',
  expenses: '#10b981',
  calories: '#f97316',
  workout: '#3b82f6',
  dreams: '#8b5cf6',
  relationships: '#f43f5e',
  health: '#14b8a6',
  sleep: '#a78bfa',
};

function categoryHex(cat: string): string {
  return CATEGORY_HEX[cat] ?? '#94a3b8';
}

function nodeRadius(edgeCount: number): number {
  return Math.min(7 + edgeCount * 2, 22);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── NodeDetailPanel ───────────────────────────────────────────────────────────

interface NodeDetailPanelProps {
  node: GraphNode | null;
  linkedNodes: GraphNode[];
  onClose: () => void;
  onUpdate: (id: string, content: string, category: string) => Promise<void>;
}

function NodeDetailPanel({ node, linkedNodes, onClose, onUpdate }: NodeDetailPanelProps) {
  const [editEntry, setEditEntry] = useState<GraphNode | null>(null);

  if (!node) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-background px-5 pt-3 shadow-xl"
        style={{
          maxHeight: '70vh', overflowY: 'auto',
          paddingBottom: 'calc(var(--tab-bar-h, 84px) + var(--bottom-inset, 0px) + 1rem)',
        }}
      >
        {/* Handle */}
        <div className="mb-3 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-muted" />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-label="Закрити"
        >
          <X size={14} />
        </button>

        {/* Category + date */}
        <div className="mb-3 flex items-center gap-2">
          <Badge className={`capitalize ${categoryBadge(node.category)}`} variant="outline">
            {getCategoryLabel(node.category)}
          </Badge>
          <time className="text-xs text-muted-foreground">{formatDate(node.created_at)}</time>
        </div>

        {/* Full content — tap to edit */}
        <p
          className="mb-4 cursor-pointer text-sm leading-relaxed text-foreground active:opacity-70"
          onClick={() => setEditEntry(node)}
        >
          {node.label}
        </p>

        {/* Linked entries — tap to edit */}
        {linkedNodes.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Пов&apos;язані записи ({linkedNodes.length}):
            </p>
            <div className="flex flex-col gap-2">
              {linkedNodes.map((n) => (
                <div
                  key={n.id}
                  className="cursor-pointer rounded-xl bg-muted/50 px-3 py-2 active:opacity-70"
                  onClick={() => setEditEntry(n)}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <Badge className={`capitalize text-[10px] ${categoryBadge(n.category)}`} variant="outline">
                      {getCategoryLabel(n.category)}
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">{n.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {editEntry && (
        <EditDrawer
          entry={{ id: editEntry.id, content: editEntry.label, category: editEntry.category }}
          onSave={async (id, content, category) => {
            await onUpdate(id, content, category);
            setEditEntry(null);
          }}
          onClose={() => setEditEntry(null)}
        />
      )}
    </>
  );
}

// ── GraphPage ─────────────────────────────────────────────────────────────────

export default function GraphPage() {
  const { accessToken } = useAuth();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [graphData, setGraphData] = useState<GraphPayload | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [linkedNodes, setLinkedNodes] = useState<GraphNode[]>([]);

  const fetchGraph = useCallback(async () => {
    if (!accessToken) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/graph', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
      }
      const payload: GraphPayload = await res.json();
      setGraphData(payload);
      setStatus('ready');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load graph');
      setStatus('error');
    }
  }, [accessToken]);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  const handleUpdate = async (id: string, content: string, category: string) => {
    if (!accessToken) return;
    await fetch('/api/entries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ id, content, category }),
    });
    fetchGraph();
  };

  // ── D3 simulation ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (status !== 'ready' || !graphData || !svgRef.current || !containerRef.current) return;

    const { nodes: rawNodes, edges: rawEdges } = graphData;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const nodes: SimNode[] = rawNodes.map((n) => ({ ...n }));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    const links: SimLink[] = rawEdges
      .filter((e) => nodeById.has(e.source) && nodeById.has(e.target))
      .map((e) => ({
        source: nodeById.get(e.source)!,
        target: nodeById.get(e.target)!,
        weight: e.weight,
        type: e.type,
      }));

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g');

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on('zoom', (event) => g.attr('transform', event.transform)),
    );

    // Edges
    const linkSel = g.append('g').attr('class', 'links')
      .selectAll('line').data(links).join('line')
      .attr('stroke', (d) => d.type === 'branch' ? '#6366f1' : '#cbd5e1')
      .attr('stroke-width', (d) => d.type === 'branch' ? 1.5 : 1)
      .attr('stroke-opacity', (d) => d.type === 'branch' ? 0.7 : 0.4)
      .attr('stroke-dasharray', (d) => d.type === 'similarity' ? '3 3' : null);

    // Nodes
    const nodeSel = g.append('g').attr('class', 'nodes')
      .selectAll('circle').data(nodes).join('circle')
      .attr('r', (d) => nodeRadius(d.edge_count))
      .attr('fill', (d) => categoryHex(d.category))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        const connected = links
          .filter((l) => (l.source as SimNode).id === d.id || (l.target as SimNode).id === d.id)
          .map((l) => {
            const otherId = (l.source as SimNode).id === d.id
              ? (l.target as SimNode).id
              : (l.source as SimNode).id;
            return rawNodes.find((n) => n.id === otherId) ?? null;
          })
          .filter((n): n is GraphNode => n !== null);
        setLinkedNodes(connected);
        setSelectedNode(d);
      });

    // Cluster labels — one label per connected component with >1 node
    const parent = new Map<string, string>(nodes.map((n) => [n.id, n.id]));
    function find(id: string): string {
      if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!));
      return parent.get(id)!;
    }
    for (const l of links) {
      const a = find((l.source as SimNode).id), b = find((l.target as SimNode).id);
      if (a !== b) parent.set(a, b);
    }
    const components = new Map<string, SimNode[]>();
    for (const n of nodes) {
      const root = find(n.id);
      if (!components.has(root)) components.set(root, []);
      components.get(root)!.push(n);
    }
    const clusterLabels: Array<{ nodes: SimNode[]; label: string }> = [];
    for (const group of components.values()) {
      if (group.length < 2) continue;
      const freq = new Map<string, number>();
      for (const n of group) freq.set(n.category, (freq.get(n.category) ?? 0) + 1);
      const topCat = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
      // Use Ukrainian label from getCategoryLabel equivalent mapping
      const UA: Record<string, string> = {
        thoughts: 'Думки', ideas: 'Ідеї', feelings: 'Почуття', expenses: 'Витрати',
        calories: 'Калорії', workout: 'Тренування', dreams: 'Сни', relationships: 'Стосунки',
        health: "Здоров'я", travel: 'Подорожі', books: 'Книги', goals: 'Цілі', sleep: 'Сон',
      };
      clusterLabels.push({ nodes: group, label: UA[topCat] ?? topCat });
    }

    const clusterLabelSel = g.append('g').attr('class', 'cluster-labels')
      .selectAll('text').data(clusterLabels).join('text')
      .text((d) => d.label)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('font-family', 'system-ui, sans-serif')
      .attr('font-weight', '600')
      .attr('fill', '#6b7280')
      .attr('pointer-events', 'none');

    // Drag
    const dragBehavior = d3.drag<SVGCircleElement, SimNode>()      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodeSel.call(dragBehavior as any);

    // Force simulation — tuned for linear/tree-like layout
    const simulation = d3.forceSimulation<SimNode>(nodes)
      .force('link',
        d3.forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => d.type === 'branch' ? 100 : 140)
          .strength((d) => d.type === 'branch' ? 1.0 : 0.2),
      )
      // Weak repulsion — nodes spread out but don't fly apart
      .force('charge', d3.forceManyBody().strength(-200).distanceMax(300))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
      // Prevent overlap
      .force('collision', d3.forceCollide<SimNode>().radius((d) => nodeRadius(d.edge_count) + 8))
      // Gentle x/y pull toward center to avoid pentagram-like spread
      .force('x', d3.forceX(width / 2).strength(0.04))
      .force('y', d3.forceY(height / 2).strength(0.04))
      .alphaDecay(0.03)
      .on('tick', () => {
        linkSel
          .attr('x1', (d) => (d.source as SimNode).x ?? 0)
          .attr('y1', (d) => (d.source as SimNode).y ?? 0)
          .attr('x2', (d) => (d.target as SimNode).x ?? 0)
          .attr('y2', (d) => (d.target as SimNode).y ?? 0);
        nodeSel.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0);
        clusterLabelSel
          .attr('x', (d) => d.nodes.reduce((s, n) => s + (n.x ?? 0), 0) / d.nodes.length)
          .attr('y', (d) => Math.min(...d.nodes.map((n) => n.y ?? 0)) - 12);
      });

    return () => { simulation.stop(); };
  }, [status, graphData]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-lg font-semibold">Граф</h1>
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        {status === 'loading' && (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="mb-3 h-7 w-7 animate-spin rounded-full border-2 border-muted border-t-foreground" />
            <p className="text-sm text-muted-foreground">Завантаження графу...</p>
          </div>
        )}
        {status === 'error' && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="mb-1 text-sm font-medium">Не вдалося завантажити граф</p>
            <p className="mb-4 text-xs text-muted-foreground">{errorMsg}</p>
            <Button size="sm" onClick={fetchGraph}>Спробувати знову</Button>
          </div>
        )}
        {status === 'ready' && graphData?.nodes.length === 0 && (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="text-sm text-muted-foreground">Немає записів для відображення.</p>
          </div>
        )}
        {status === 'ready' && (graphData?.nodes.length ?? 0) > 0 && (
          <svg ref={svgRef} className="h-full w-full" />
        )}
      </div>

      <NodeDetailPanel
        node={selectedNode}
        linkedNodes={linkedNodes}
        onClose={() => setSelectedNode(null)}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
