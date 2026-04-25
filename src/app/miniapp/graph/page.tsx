'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAuth } from '@/lib/supabase/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { EditDrawer, getCategoryLabel, getCategoryColor } from '@/components/ui/edit-drawer';
import { PaywallModal } from '@/components/ui/paywall-modal';
import { cn } from '@/lib/utils';
import type { SubscriptionTier } from '@/lib/stars/paywall';
import { useSound } from '@/lib/sound/use-sound';

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = string;

interface GraphNode {
  id: string;
  label: string;
  category: Category;
  categories: Category[];   // all categories this entry belongs to
  created_at: string;
  edge_count: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: 'branch' | 'similarity' | 'cross_category';
}

interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  category: Category;
  categories: Category[];
  created_at: string;
  edge_count: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
  type: 'branch' | 'similarity' | 'cross_category';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_HEX: Record<string, string> = {
  // Dark mode optimized: brighter, more saturated colors for visibility on dark bg
  thoughts: '#818cf8',      // indigo-400 (brighter)
  ideas: '#fbbf24',         // amber-400 (brighter)
  feelings: '#f472b6',      // pink-400 (brighter)
  expenses: '#34d399',      // emerald-400 (brighter)
  calories: '#fb923c',      // orange-400 (brighter)
  workout: '#60a5fa',       // blue-400 (brighter)
  dreams: '#a78bfa',        // violet-400 (brighter)
  relationships: '#fb7185', // rose-400 (brighter)
  health: '#2dd4bf',        // teal-400 (brighter)
  sleep: '#c084fc',         // fuchsia-400 (brighter)
  // Additional categories
  travel: '#22d3ee',        // cyan-400
  books: '#facc15',         // yellow-400
  gratitude: '#a3e635',     // lime-400
  goals: '#38bdf8',         // sky-400
  work: '#94a3b8',          // slate-400
  music: '#c084fc',         // purple-400
  social: '#f472b6',        // pink-400
  career: '#60a5fa',        // blue-400
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
  onDelete: (id: string) => Promise<void>;
  accessToken?: string | null;
}

function NodeDetailPanel({ node, linkedNodes, onClose, onUpdate, onDelete, accessToken }: NodeDetailPanelProps) {
  const [editEntry, setEditEntry] = useState<GraphNode | null>(null);
  const { play } = useSound();

  if (!node) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => { play('CLOSE'); onClose(); }} aria-hidden="true" />
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
          onClick={() => { play('CLOSE'); onClose(); }}
          className="absolute right-4 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-label="Закрити"
        >
          <X size={14} />
        </button>

        {/* Category + date */}
        <div className="mb-3 flex items-center gap-2">
          <Badge className={cn('capitalize border text-[10px]', getCategoryColor(node.category))} variant="outline">
            {getCategoryLabel(node.category)}
          </Badge>
          <time className="text-xs text-muted-foreground">{formatDate(node.created_at)}</time>
        </div>

        {/* Full content — tap to edit */}
        <p
          className="mb-4 cursor-pointer text-sm leading-relaxed text-foreground active:opacity-70"
          onClick={() => { play('OPEN'); setEditEntry(node); }}
        >
          {node.label}
        </p>

        {/* Linked entries */}
        {linkedNodes.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Пов&apos;язані записи ({linkedNodes.length}):
            </p>
            <div className="flex flex-col gap-2">
              {linkedNodes.map((n) => {
                // Only show the category badge when it differs from the selected node
                const isDifferentCategory = n.category !== node.category;
                return (
                  <div
                    key={n.id}
                    className="cursor-pointer rounded-xl bg-muted/50 px-3 py-2.5 active:opacity-70"
                    onClick={() => { play('OPEN'); setEditEntry(n); }}
                  >
                    {isDifferentCategory && (
                      <div className="mb-1.5">
                        <Badge
                          className={cn('capitalize text-[10px] border', getCategoryColor(n.category))}
                          variant="outline"
                        >
                          {getCategoryLabel(n.category)}
                        </Badge>
                      </div>
                    )}
                    <p className="text-xs text-foreground leading-relaxed">{n.label}</p>
                  </div>
                );
              })}
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
          onDelete={async (id) => {
            await onDelete(id);
            setEditEntry(null);
            onClose();
          }}
          onClose={() => setEditEntry(null)}
          accessToken={accessToken}
        />
      )}
    </>
  );
}

// ── GraphPage ─────────────────────────────────────────────────────────────────

export default function GraphPage() {
  const { accessToken } = useAuth();
  const { play } = useSound();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [graphData, setGraphData] = useState<GraphPayload | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [linkedNodes, setLinkedNodes] = useState<GraphNode[]>([]);

  // ── User tier ──────────────────────────────────────────────────────────────
  const [userTier, setUserTier] = useState<SubscriptionTier | null>(null);

  // ── Paywall state ──────────────────────────────────────────────────────────
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallProps, setPaywallProps] = useState<{
    feature: string;
    current?: number;
    limit?: number;
    requiredTier: SubscriptionTier;
  }>({ feature: 'graph_full', requiredTier: 'stars_basic' });

  const openPaywall = (feature: string, current: number | undefined, limit: number | undefined, requiredTier: SubscriptionTier) => {
    setPaywallProps({ feature, current, limit, requiredTier });
    setPaywallOpen(true);
  };

  const fetchUserTier = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return;
      const { profile } = await res.json();
      setUserTier((profile?.subscription_tier as SubscriptionTier) ?? 'free');
    } catch { /* non-critical */ }
  }, [accessToken]);

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

  useEffect(() => { fetchGraph(); fetchUserTier(); }, [fetchGraph, fetchUserTier]);

  const handleUpdate = async (id: string, content: string, category: string) => {
    if (!accessToken) return;
    await fetch('/api/entries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ id, content, category }),
    });
    fetchGraph();
  };

  const handleDelete = async (id: string) => {
    if (!accessToken) return;
    await fetch('/api/entries', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ids: [id] }),
    });
    setSelectedNode(null);
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

    // Edges — three visual styles - optimized for dark mode
    const linkSel = g.append('g').attr('class', 'links')
      .selectAll('line').data(links).join('line')
      .attr('stroke', (d) => {
        if (d.type === 'branch') return '#818cf8';        // brighter indigo for dark bg
        if (d.type === 'cross_category') return '#fbbf24'; // brighter amber for dark bg
        return '#64748b';                                  // slate-500 for similarity
      })
      .attr('stroke-width', (d) => {
        if (d.type === 'branch') return 2;
        if (d.type === 'cross_category') return 2;
        return 1.5;
      })
      .attr('stroke-opacity', (d) => {
        if (d.type === 'branch') return 0.8;
        if (d.type === 'cross_category') return 0.7;
        return 0.5;
      })
      .attr('stroke-dasharray', (d) => d.type === 'similarity' ? '4 3' : null);

    // Nodes - dark mode optimized with contrasting stroke
    const nodeSel = g.append('g').attr('class', 'nodes')
      .selectAll('circle').data(nodes).join('circle')
      .attr('r', (d) => nodeRadius(d.edge_count))
      .attr('fill', (d) => categoryHex(d.category))
      .attr('stroke', '#0f172a')  // dark slate for contrast on dark bg
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        play('OPEN');
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
      .attr('font-size', 12)
      .attr('font-family', 'system-ui, sans-serif')
      .attr('font-weight', '600')
      .attr('fill', '#94a3b8')  // lighter slate for dark mode visibility
      .attr('pointer-events', 'none');

    // Drag
    const dragBehavior = d3.drag<SVGCircleElement, SimNode>().on('start', (event, d) => {
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

    // Force simulation
    const simulation = d3.forceSimulation<SimNode>(nodes)
      .force('link',
        d3.forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => {
            if (d.type === 'branch') return 90;
            if (d.type === 'cross_category') return 70; // shorter = pulls clusters together
            return 150;
          })
          .strength((d) => {
            if (d.type === 'branch') return 1.0;
            if (d.type === 'cross_category') return 0.6; // meaningful pull, not rigid
            return 0.15;
          }),
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
            <Button size="sm" onClick={() => { play('BUTTON'); fetchGraph(); }}>Спробувати знову</Button>
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
        {/* Free tier overlay — shown when userTier is known and is 'free' */}
        {userTier === 'free' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90 backdrop-blur-md px-6">
            <div className="w-full max-w-xs flex flex-col items-center text-center">
              {/* Icon */}
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-4xl">
                🕸️
              </div>

              {/* Title */}
              <p className="text-[22px] font-bold leading-tight mb-1">Граф зв&apos;язків</p>
              <p className="text-[14px] text-muted-foreground mb-5">
                Візуалізуй, як твої думки та записи пов&apos;язані між собою
              </p>

              {/* Feature list */}
              <div className="w-full rounded-2xl bg-muted/30 border border-border/30 px-4 py-3 mb-5 flex flex-col gap-2.5 text-left">
                {[
                  { emoji: '🔗', text: 'Зв\'язки між записами' },
                  { emoji: '🎨', text: 'Кольорові кластери по категоріях' },
                  { emoji: '🔍', text: 'Пошук патернів у думках' },
                  { emoji: '✏️', text: 'Редагування записів прямо з графу' },
                  { emoji: '🌐', text: 'Інтерактивна навігація' },
                ].map(({ emoji, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <span className="text-[18px] leading-none shrink-0">{emoji}</span>
                    <span className="text-[14px] text-foreground/80">{text}</span>
                  </div>
                ))}
              </div>

              {/* Tier badge */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🌟</span>
                <span className="text-[13px] text-muted-foreground">Доступно з плану <span className="font-semibold text-foreground">Memo Nova</span></span>
              </div>

              {/* CTA */}
              <Button
                className="w-full min-h-[48px] text-[15px] font-semibold"
                onClick={() => { play('OPEN'); openPaywall('graph_full', undefined, undefined, 'stars_basic'); }}
              >
                Перейти на Nova — 250 ⭐
              </Button>
            </div>
          </div>
        )}
      </div>

      <NodeDetailPanel
        node={selectedNode}
        linkedNodes={linkedNodes}
        onClose={() => setSelectedNode(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        accessToken={accessToken}
      />

      {/* Paywall Modal */}
      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        {...paywallProps}
      />
    </div>
  );
}
