'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/supabase/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/20"
        onClick={() => { play('CLOSE'); onClose(); }}
        aria-hidden="true"
      />
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-background px-5 pt-3 shadow-xl"
        style={{
          maxHeight: '70vh', overflowY: 'auto',
          paddingBottom: 'calc(var(--tab-bar-h, 84px) + var(--bottom-inset, 0px) + 1rem)',
        }}
      >
        {/* Handle */}
        <div className="mb-3 flex justify-center">
          <motion.div
            className="h-1 w-10 rounded-full bg-muted"
            whileHover={{ scaleX: 1.2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          />
        </div>

        {/* Close */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => { play('CLOSE'); onClose(); }}
          className="absolute right-4 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-label="Закрити"
        >
          <X size={14} />
        </motion.button>

        {/* Category + date */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.25 }}
          className="mb-3 flex items-center gap-2"
        >
          <Badge className={cn('capitalize border text-[10px]', getCategoryColor(node.category))} variant="outline">
            {getCategoryLabel(node.category)}
          </Badge>
          <time className="text-xs text-muted-foreground">{formatDate(node.created_at)}</time>
        </motion.div>

        {/* Full content — tap to edit */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.25 }}
          className="mb-4 cursor-pointer text-sm leading-relaxed text-foreground active:opacity-70"
          onClick={() => { play('OPEN'); setEditEntry(node); }}
        >
          {node.label}
        </motion.p>

        {/* Linked entries */}
        {linkedNodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.25 }}
          >
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Пов&apos;язані записи ({linkedNodes.length}):
            </p>
            <div className="flex flex-col gap-2">
              {linkedNodes.map((n, i) => {
                const isDifferentCategory = n.category !== node.category;
                return (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.04, duration: 0.22 }}
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
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </motion.div>

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

// ── DateFilterSheet ───────────────────────────────────────────────────────────

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function startOfDay(d: Date) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function endOfDay(d: Date)   { const r = new Date(d); r.setHours(23,59,59,999); return r; }

interface DateRange { from: Date; to: Date; }

type DatePresetKey = 'all' | 'today' | 'yesterday' | 'week' | 'month' | '2weeks' | '3months' | 'year' | 'ytd' | 'custom';

interface DatePreset {
  key: DatePresetKey;
  label: string;
  sublabel: string;
  paid: boolean;
  fn: (() => DateRange | null) | null;
}

const FREE_DATE_PRESETS: DatePreset[] = [
  { key: 'today',     label: 'Сьогодні', sublabel: 'today',     paid: false, fn: () => { const n = new Date(); return { from: startOfDay(n), to: endOfDay(n) }; } },
  { key: 'yesterday', label: 'Вчора',    sublabel: 'yesterday', paid: false, fn: () => { const n = new Date(); const y = new Date(n); y.setDate(n.getDate()-1); return { from: startOfDay(y), to: endOfDay(y) }; } },
  { key: 'week',      label: '7 днів',   sublabel: 'last 7d',   paid: false, fn: () => { const n = new Date(); const f = new Date(n); f.setDate(n.getDate()-6); return { from: startOfDay(f), to: endOfDay(n) }; } },
];

const PAID_DATE_PRESETS: DatePreset[] = [
  { key: 'month',    label: '30 днів',        sublabel: 'last 30d',  paid: true, fn: () => { const n = new Date(); const f = new Date(n); f.setDate(n.getDate()-29); return { from: startOfDay(f), to: endOfDay(n) }; } },
  { key: '2weeks',   label: '2 тижні',        sublabel: 'last 14d',  paid: true, fn: () => { const n = new Date(); const f = new Date(n); f.setDate(n.getDate()-13); return { from: startOfDay(f), to: endOfDay(n) }; } },
  { key: '3months',  label: '3 місяці',       sublabel: 'last 90d',  paid: true, fn: () => { const n = new Date(); const f = new Date(n); f.setMonth(n.getMonth()-3); return { from: startOfDay(f), to: endOfDay(n) }; } },
  { key: 'year',     label: 'Рік',            sublabel: 'last 365d', paid: true, fn: () => { const n = new Date(); const f = new Date(n); f.setFullYear(n.getFullYear()-1); return { from: startOfDay(f), to: endOfDay(n) }; } },
  { key: 'ytd',      label: 'З початку року', sublabel: 'YTD',       paid: true, fn: () => { const n = new Date(); return { from: startOfDay(new Date(n.getFullYear(), 0, 1)), to: endOfDay(n) }; } },
  { key: 'all',      label: 'Весь час',       sublabel: 'all time',  paid: true, fn: () => null },
  { key: 'custom',   label: 'Свій',           sublabel: 'custom',    paid: true, fn: null },
];

function DateFilterSheet({ open, onClose, value, onChange, userTier }: {
  open: boolean; onClose: () => void;
  value: DateRange | null;
  onChange: (r: DateRange | null) => void;
  userTier: SubscriptionTier;
}) {
  const [fromStr, setFromStr] = useState(isoDate(startOfDay(new Date())));
  const [toStr, setToStr] = useState(isoDate(new Date()));
  const [selected, setSelected] = useState<DatePresetKey | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const { play } = useSound();

  const isPaid = userTier === 'stars_basic' || userTier === 'stars_pro';

  const handlePreset = (p: DatePreset) => {
    if (p.paid && !isPaid) {
      play('CAUTION');
      setPaywallOpen(true);
      return;
    }
    play('SELECT');
    if (p.fn === null && p.key !== 'custom') {
      // 'all' — null range
      setSelected(p.key);
      onChange(null);
      onClose();
      return;
    }
    if (p.key === 'custom') {
      setSelected('custom');
      return;
    }
    const r = p.fn!();
    setSelected(p.key);
    onChange(r);
    onClose();
  };

  const applyCustom = () => {
    const from = startOfDay(new Date(fromStr)), to = endOfDay(new Date(toStr));
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return;
    onChange({ from, to });
    onClose();
  };

  const ChipButton = ({ p }: { p: DatePreset }) => {
    const isSelected = selected === p.key || (p.key === 'all' && value === null && selected === null);
    const locked = p.paid && !isPaid;
    return (
      <button
        onClick={() => handlePreset(p)}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-2xl px-2 py-3 transition-all active:scale-95 min-h-[64px]',
          isSelected
            ? 'bg-primary text-primary-foreground shadow-sm'
            : locked
              ? 'bg-muted/30 text-muted-foreground/50'
              : 'bg-muted/50 text-foreground hover:bg-muted/70'
        )}
      >
        {locked && (
          <span className="absolute top-1.5 right-1.5">
            <Icon name="lock" size={10} className="text-yellow-400/80" />
          </span>
        )}
        <span className={cn('text-[14px] font-semibold leading-tight', isSelected && 'text-primary-foreground')}>
          {p.label}
        </span>
        <span className={cn('text-[10px] mt-0.5 leading-none', isSelected ? 'text-primary-foreground/70' : locked ? 'text-muted-foreground/40' : 'text-muted-foreground/70')}>
          {p.sublabel}
        </span>
      </button>
    );
  };

  return (
    <>
      <BottomSheet open={open} onClose={onClose} style={{ paddingBottom: 'calc(var(--tab-bar-h, 84px) + var(--bottom-inset, 0px) + 1rem)' }}>
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">Період</h3>
          {!isPaid && (
            <span className="flex items-center gap-1 rounded-full bg-yellow-400/15 px-2 py-0.5 text-[11px] font-medium text-yellow-400">
              <Icon name="star" size={10} />
              Nova+ для більше
            </span>
          )}
        </div>

        <div className="px-4 pb-4 flex flex-col gap-3">
          {/* Free chips */}
          <div className="grid grid-cols-3 gap-2">
            {FREE_DATE_PRESETS.map(p => <ChipButton key={p.key} p={p} />)}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border/40" />
            {!isPaid && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-yellow-400/80 flex items-center gap-1">
                <Icon name="lock" size={10} /> Nova+
              </span>
            )}
            <div className="flex-1 h-px bg-border/40" />
          </div>

          {/* Paid chips */}
          <div className={cn('grid grid-cols-3 gap-2', !isPaid && 'opacity-70')}>
            {PAID_DATE_PRESETS.map(p => <ChipButton key={p.key} p={p} />)}
          </div>

          {/* Custom date inputs */}
          <div className={cn('overflow-hidden transition-all duration-300', selected === 'custom' && isPaid ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0')}>
            <div className="flex items-center gap-2 pt-1">
              <input type="date" value={fromStr} onChange={e => setFromStr(e.target.value)}
                className="flex-1 rounded-xl border border-input bg-muted/40 px-3 py-2.5 text-[14px] focus:outline-none focus:ring-1 focus:ring-ring" />
              <span className="text-muted-foreground text-sm">–</span>
              <input type="date" value={toStr} onChange={e => setToStr(e.target.value)}
                className="flex-1 rounded-xl border border-input bg-muted/40 px-3 py-2.5 text-[14px] focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <Button className="w-full min-h-[44px] mt-2 rounded-xl" onClick={applyCustom}>Застосувати</Button>
          </div>
        </div>
      </BottomSheet>

      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        feature="date_range"
        requiredTier="stars_basic"
      />
    </>
  );
}

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

  // ── Filters ────────────────────────────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | null>(null);
  const [showDateSheet, setShowDateSheet] = useState(false);

  // ── User tier ──────────────────────────────────────────────────────────────
  // Start as 'free' so the paywall overlay shows immediately while loading.
  // It will be hidden once we confirm the user has a paid tier.
  const [userTier, setUserTier] = useState<SubscriptionTier>('free');
  const [tierLoaded, setTierLoaded] = useState(false);

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
      // Compute effective tier client-side — respect expiry
      const rawTier = (profile?.subscription_tier as SubscriptionTier) ?? 'free';
      const endsAt = profile?.subscription_ends_at ? new Date(profile.subscription_ends_at) : null;
      const isExpired = endsAt ? endsAt < new Date() : false;
      const effectiveTier: SubscriptionTier = (rawTier !== 'free' && isExpired) ? 'free' : rawTier;
      setUserTier(effectiveTier);
    } catch { /* on error, keep 'free' — paywall stays visible */ }
    finally { setTierLoaded(true); }
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

    const allNodes = graphData.nodes;
    const allEdges = graphData.edges;

    // Apply filters
    const filteredNodes = allNodes.filter(n => {
      if (selectedCategory && n.category !== selectedCategory) return false;
      if (dateRange) {
        const t = new Date(n.created_at).getTime();
        if (t < dateRange.from.getTime() || t > dateRange.to.getTime()) return false;
      }
      return true;
    });

    // Limit to 200 most-connected nodes to avoid visual overload
    const nodeSet = new Set(
      [...filteredNodes]
        .sort((a, b) => b.edge_count - a.edge_count)
        .slice(0, 200)
        .map(n => n.id)
    );

    const rawNodes = filteredNodes.filter(n => nodeSet.has(n.id));
    const rawEdges = allEdges.filter(e => nodeSet.has(e.source) && nodeSet.has(e.target));

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
        .scaleExtent([0.15, 5])
        .on('zoom', (event) => g.attr('transform', event.transform)),
    );

    // Edges
    const linkSel = g.append('g').attr('class', 'links')
      .selectAll('line').data(links).join('line')
      .attr('stroke', (d) => {
        if (d.type === 'branch') return '#818cf8';
        if (d.type === 'cross_category') return '#fbbf24';
        return '#334155';
      })
      .attr('stroke-width', (d) => d.type === 'similarity' ? 1 : 1.5)
      .attr('stroke-opacity', (d) => {
        if (d.type === 'branch') return 0.7;
        if (d.type === 'cross_category') return 0.5;
        return 0.25;
      })
      .attr('stroke-dasharray', (d) => d.type === 'similarity' ? '3 4' : null);

    // Nodes — smaller base radius, more breathing room
    const nodeSel = g.append('g').attr('class', 'nodes')
      .selectAll('circle').data(nodes).join('circle')
      .attr('r', (d) => Math.min(5 + d.edge_count * 1.5, 16))
      .attr('fill', (d) => categoryHex(d.category))
      .attr('fill-opacity', 0.9)
      .attr('stroke', '#080c14')
      .attr('stroke-width', 1.5)
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

    // Cluster labels
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
      if (group.length < 3) continue;
      const freq = new Map<string, number>();
      for (const n of group) freq.set(n.category, (freq.get(n.category) ?? 0) + 1);
      const topCat = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
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
      .attr('font-weight', '500')
      .attr('fill', '#475569')
      .attr('pointer-events', 'none');

    // Drag
    const dragBehavior = d3.drag<SVGCircleElement, SimNode>()
      .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodeSel.call(dragBehavior as any);

    // Force simulation — much stronger repulsion for breathing room
    const nodeCount = nodes.length;
    const repulsion = nodeCount > 100 ? -600 : nodeCount > 50 ? -450 : -320;

    const simulation = d3.forceSimulation<SimNode>(nodes)
      .force('link',
        d3.forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => {
            if (d.type === 'branch') return 120;
            if (d.type === 'cross_category') return 100;
            return 200;
          })
          .strength((d) => {
            if (d.type === 'branch') return 0.8;
            if (d.type === 'cross_category') return 0.4;
            return 0.08;
          }),
      )
      .force('charge', d3.forceManyBody().strength(repulsion).distanceMax(500))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.03))
      .force('collision', d3.forceCollide<SimNode>().radius((d) => Math.min(5 + d.edge_count * 1.5, 16) + 14))
      .force('x', d3.forceX(width / 2).strength(0.02))
      .force('y', d3.forceY(height / 2).strength(0.02))
      .alphaDecay(0.025)
      .on('tick', () => {
        linkSel
          .attr('x1', (d) => (d.source as SimNode).x ?? 0)
          .attr('y1', (d) => (d.source as SimNode).y ?? 0)
          .attr('x2', (d) => (d.target as SimNode).x ?? 0)
          .attr('y2', (d) => (d.target as SimNode).y ?? 0);
        nodeSel.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0);
        clusterLabelSel
          .attr('x', (d) => d.nodes.reduce((s, n) => s + (n.x ?? 0), 0) / d.nodes.length)
          .attr('y', (d) => Math.min(...d.nodes.map((n) => n.y ?? 0)) - 16);
      });

    return () => { simulation.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, graphData, selectedCategory, dateRange]);

  // Collect unique categories from graph data for filter chips
  const allCategories = graphData
    ? [...new Set(graphData.nodes.map(n => n.category))].sort()
    : [];

  const dateLabel = dateRange
    ? `${dateRange.from.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })} – ${dateRange.to.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}`
    : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header with filters */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-2 px-4 pt-5 pb-2"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Граф</h1>
          {/* Date filter button — hidden for free tier */}
          {!(tierLoaded && userTier === 'free') && (
            <button
              onClick={() => { play('OPEN'); setShowDateSheet(true); }}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors',
                dateRange
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-muted/50 text-muted-foreground border border-border/30'
              )}
            >
              <Icon name="calendar_month" size={14} />
              {dateLabel ?? 'Весь час'}
              {dateRange && (
                <button
                  onClick={e => { e.stopPropagation(); setDateRange(null); }}
                  className="ml-0.5 text-primary/60 hover:text-primary"
                >
                  <Icon name="close" size={12} />
                </button>
              )}
            </button>
          )}
        </div>

        {/* Category filter chips — hidden for free tier */}
        {!(tierLoaded && userTier === 'free') && allCategories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => { play('SELECT'); setSelectedCategory(null); }}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-colors border',
                selectedCategory === null
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/40 text-muted-foreground border-border/30'
              )}
            >
              Всі
            </button>
            {allCategories.map(cat => (
              <button
                key={cat}
                onClick={() => { play('SELECT'); setSelectedCategory(selectedCategory === cat ? null : cat); }}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-all border',
                  selectedCategory === cat
                    ? 'ring-2 ring-offset-1 ring-primary/50 scale-105'
                    : 'opacity-85 hover:opacity-100',
                  getCategoryColor(cat)
                )}
              >
                {getCategoryLabel(cat)}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {status === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full flex-col items-center justify-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="mb-3 h-7 w-7 rounded-full border-2 border-muted border-t-foreground"
              />
              <p className="text-sm text-muted-foreground">Завантаження графу...</p>
            </motion.div>
          )}
          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="flex h-full flex-col items-center justify-center px-6 text-center"
            >
              <p className="mb-1 text-sm font-medium">Не вдалося завантажити граф</p>
              <p className="mb-4 text-xs text-muted-foreground">{errorMsg}</p>
              <Button size="sm" onClick={() => { play('BUTTON'); fetchGraph(); }}>Спробувати знову</Button>
            </motion.div>
          )}
        </AnimatePresence>
        {status === 'ready' && graphData?.nodes.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex h-full flex-col items-center justify-center px-8 text-center gap-3"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30 text-4xl">
              🕸️
            </div>
            <p className="text-[15px] font-semibold">Граф ще порожній</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed max-w-xs">
              Почни вести щоденник у боті — після кількох записів тут з&apos;явиться граф зв&apos;язків між ними.
            </p>
          </motion.div>
        )}
        {status === 'ready' && (graphData?.nodes.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="h-full w-full"
          >
            <svg ref={svgRef} className="h-full w-full" />
          </motion.div>
        )}
        {/* Free tier overlay — shown when userTier is known and is 'free' */}
        <AnimatePresence>
          {tierLoaded && userTier === 'free' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-10 flex flex-col items-end justify-end"
            >
              {/* Blurred graph preview — decorative nodes */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
                {/* Fake node clusters */}
                {[
                  { x: '18%', y: '22%', size: 52, color: 'bg-indigo-500/30', delay: 0 },
                  { x: '55%', y: '15%', size: 36, color: 'bg-violet-500/25', delay: 0.05 },
                  { x: '75%', y: '35%', size: 44, color: 'bg-blue-500/30', delay: 0.1 },
                  { x: '30%', y: '50%', size: 60, color: 'bg-emerald-500/25', delay: 0.08 },
                  { x: '65%', y: '58%', size: 32, color: 'bg-amber-500/25', delay: 0.12 },
                  { x: '12%', y: '68%', size: 40, color: 'bg-pink-500/25', delay: 0.06 },
                  { x: '82%', y: '70%', size: 28, color: 'bg-cyan-500/20', delay: 0.15 },
                  { x: '45%', y: '78%', size: 48, color: 'bg-purple-500/25', delay: 0.1 },
                  { x: '22%', y: '38%', size: 24, color: 'bg-rose-500/20', delay: 0.07 },
                  { x: '60%', y: '42%', size: 20, color: 'bg-teal-500/20', delay: 0.13 },
                ].map((node, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: node.delay, type: 'spring', stiffness: 200, damping: 20 }}
                    className={`absolute rounded-full ${node.color} blur-[2px]`}
                    style={{ left: node.x, top: node.y, width: node.size, height: node.size, transform: 'translate(-50%, -50%)' }}
                  />
                ))}
                {/* Fake edges as thin lines */}
                <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
                  <line x1="18%" y1="22%" x2="30%" y2="50%" stroke="#818cf8" strokeWidth="1.5" strokeDasharray="4 3" />
                  <line x1="30%" y1="50%" x2="55%" y2="15%" stroke="#818cf8" strokeWidth="1" strokeDasharray="4 3" />
                  <line x1="55%" y1="15%" x2="75%" y2="35%" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="4 3" />
                  <line x1="75%" y1="35%" x2="65%" y2="58%" stroke="#60a5fa" strokeWidth="1" strokeDasharray="4 3" />
                  <line x1="30%" y1="50%" x2="45%" y2="78%" stroke="#34d399" strokeWidth="1.5" strokeDasharray="4 3" />
                  <line x1="65%" y1="58%" x2="45%" y2="78%" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" />
                  <line x1="12%" y1="68%" x2="30%" y2="50%" stroke="#f472b6" strokeWidth="1" strokeDasharray="4 3" />
                  <line x1="22%" y1="38%" x2="18%" y2="22%" stroke="#fb7185" strokeWidth="1" strokeDasharray="4 3" />
                  <line x1="60%" y1="42%" x2="75%" y2="35%" stroke="#2dd4bf" strokeWidth="1" strokeDasharray="4 3" />
                  <line x1="82%" y1="70%" x2="65%" y2="58%" stroke="#818cf8" strokeWidth="1" strokeDasharray="4 3" />
                </svg>
                {/* Gradient fade overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
              </div>

              {/* Bottom sheet card */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.15 }}
                className="relative w-full px-4 pb-6 pt-2"
              >
                {/* Lock badge */}
                <div className="flex justify-center mb-3">
                  <div className="flex items-center gap-1.5 rounded-full bg-yellow-400/15 border border-yellow-400/30 px-3 py-1">
                    <Icon name="lock" size={12} className="text-yellow-400" />
                    <span className="text-[12px] font-semibold text-yellow-400">Nova+</span>
                  </div>
                </div>

                <p className="text-[22px] font-bold leading-tight text-center mb-1">Граф зв&apos;язків</p>
                <p className="text-[13px] text-muted-foreground text-center mb-4 leading-relaxed">
                  Бачиш як думки та записи пов&apos;язані між собою — кластери, патерни, зв&apos;язки
                </p>

                {/* Feature pills — 2-col grid */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { emoji: '🔗', text: 'Зв\'язки між записами' },
                    { emoji: '🎨', text: 'Кластери по категоріях' },
                    { emoji: '🔍', text: 'Патерни у думках' },
                    { emoji: '✏️', text: 'Редагування з графу' },
                  ].map(({ emoji, text }, i) => (
                    <motion.div
                      key={text}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 + i * 0.05 }}
                      className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2.5"
                    >
                      <span className="text-[16px] leading-none shrink-0">{emoji}</span>
                      <span className="text-[12px] text-foreground/80 leading-tight">{text}</span>
                    </motion.div>
                  ))}
                </div>

                {/* CTA */}
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, type: 'spring', stiffness: 300, damping: 26 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { play('OPEN'); openPaywall('graph_full', undefined, undefined, 'stars_basic'); }}
                  className="w-full rounded-xl bg-yellow-400 py-3.5 text-[15px] font-semibold text-slate-950 active:opacity-90 transition-opacity"
                >
                  Розблокувати — від 250 ⭐
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            linkedNodes={linkedNodes}
            onClose={() => setSelectedNode(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            accessToken={accessToken}
          />
        )}
      </AnimatePresence>

      {/* Paywall Modal */}
      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        {...paywallProps}
      />

      {/* Date filter sheet */}
      <DateFilterSheet
        open={showDateSheet}
        onClose={() => setShowDateSheet(false)}
        value={dateRange}
        onChange={setDateRange}
        userTier={userTier}
      />
    </div>
  );
}
