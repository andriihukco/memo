import { memo, useEffect, useMemo, useRef, useState, type ElementRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeSyntheticEvent, type NativeTouchEvent } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { Text } from '../theme/typography';
import { t } from '../i18n';
import { api, type GraphPayload } from '../lib/api';
import { useSession } from '../lib/session';
import { useEntries } from '../lib/entry-store';
import { Chip, Empty, TOUCH } from '../components/ui';
import { Symbol } from '../components/symbol';
import { metaFor } from '../lib/category-meta';
import { haptic } from '../motion';
import {
  fitView,
  inPeriod,
  layoutGraph,
  limitNodes,
  neighborsOf,
  clusterLabels,
  radiusOf,
  type LayoutLink,
  type LayoutNode,
  type Period,
} from '../lib/graph';
import { useThemed, type Theme } from '../theme/theme';

const CANVAS_HEIGHT = 460;
const PERIODS: Period[] = ['all', 'today', 'week', 'month'];
const PERIOD_LABEL: Record<Period, string> = {
  all: t('miniapp.graph.period.all'),
  today: t('miniapp.graph.period.today'),
  week: t('miniapp.graph.range.week'),
  month: t('miniapp.graph.range.month'),
};

type Viewport = { x: number; y: number; scale: number };

/**
 * Knowledge graph, the native port of the web graph (src/components/legacy/pages/graph.tsx).
 * Same data (GET /api/graph), same force layout, same behaviour: tap a dot to focus it and
 * read its entry, tap a category chip to highlight it, pinch and drag to move around.
 */
export function GraphView() {
  const { colors, styles } = useThemed(makeStyles);
  const { token, live } = useSession();
  const { reports } = useEntries(); // re-read the graph when the entry list changes
  const [payload, setPayload] = useState<GraphPayload | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(live ? 'loading' : 'ready');
  const [period, setPeriod] = useState<Period>('all');
  const [category, setCategory] = useState<string | null>(null);
  // Focus and manual pan or zoom are tied to the layout they were made on, so a new layout starts clean.
  const [focus, setFocus] = useState<{ scene: unknown; id: string } | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [manual, setManual] = useState<{ scene: unknown; view: Viewport } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const originRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<ElementRef<typeof View>>(null);
  const gesture = useRef<{ view: Viewport; x0: number; y0: number; dist0: number; moved: boolean; scene: unknown } | null>(null);

  // Load on sign-in and whenever the number of entries changes.
  useEffect(() => {
    if (!live || !token) return;
    let active = true;
    api
      .getGraph(token)
      .then((data) => {
        if (!active) return;
        setPayload(data);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [live, token, reports.length]);

  const scene = useMemo(() => {
    if (!payload || size.width === 0) return null;
    const now = new Date();
    const dated = payload.nodes.filter((n) => inPeriod(n.created_at, period, now));
    const ids = new Set(dated.map((n) => n.id));
    const { nodes, edges } = limitNodes(dated, payload.edges.filter((e) => ids.has(e.source) && ids.has(e.target)));
    const laid = layoutGraph(nodes, edges, size.width, CANVAS_HEIGHT);
    return { ...laid, edges, labels: clusterLabels(laid.nodes, edges) };
  }, [payload, period, size.width]);

  // The fit-to-screen view for this layout, as the web view does on load.
  const fit = useMemo(
    () => (scene ? fitView(scene.nodes, size.width, CANVAS_HEIGHT) : { x: 0, y: 0, scale: 1 }),
    [scene, size.width],
  );
  const view = manual && manual.scene === scene ? manual.view : fit;
  const focusId = focus && focus.scene === scene ? focus.id : null;

  const categories = useMemo(() => {
    const seen = new Map<string, number>();
    for (const n of payload?.nodes ?? []) seen.set(n.category, (seen.get(n.category) ?? 0) + 1);
    return [...seen.keys()].sort();
  }, [payload]);

  const focusNeighbors = useMemo(
    () => (focusId && scene ? neighborsOf(focusId, scene.edges) : null),
    [focusId, scene],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setSize((s) => (s.width === width ? s : { width, height: CANVAS_HEIGHT }));
    containerRef.current?.measureInWindow((x: number, y: number) => {
      originRef.current = { x, y };
    });
  };

  const nodeById = useMemo(() => new Map((scene?.nodes ?? []).map((n) => [n.id, n])), [scene]);
  const sheetNode = sheetId ? nodeById.get(sheetId) ?? null : null;
  const linked = useMemo(() => {
    if (!sheetId || !scene) return [] as LayoutNode[];
    return [...neighborsOf(sheetId, scene.edges)].map((id) => nodeById.get(id)).filter((n): n is LayoutNode => !!n);
  }, [sheetId, scene, nodeById]);

  /** Nearest dot to a screen point, in graph coordinates, or null when the tap misses. */
  const hitTest = (screenX: number, screenY: number, v: Viewport): LayoutNode | null => {
    if (!scene) return null;
    const gx = (screenX - originRef.current.x - v.x) / v.scale;
    const gy = (screenY - originRef.current.y - v.y) / v.scale;
    const slop = 22 / v.scale;
    let best: LayoutNode | null = null;
    let bestD = Infinity;
    for (const n of scene.nodes) {
      const d = Math.hypot(n.x - gx, n.y - gy);
      if (d <= Math.max(radiusOf(n.edge_count) + 6, slop) && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  };

  // Raw touch handling: one finger pans, two fingers pinch, a short touch with no movement is a tap.
  const onTouchStart = (e: GestureEvent) => {
    const touches = e.nativeEvent.touches;
    gesture.current = {
      view,
      scene,
      x0: e.nativeEvent.pageX,
      y0: e.nativeEvent.pageY,
      dist0: touches.length >= 2 ? distance(touches[0], touches[1]) : 0,
      moved: false,
    };
  };
  const onTouchMove = (e: GestureEvent) => {
    const start = gesture.current;
    if (!start) return;
    const touches = e.nativeEvent.touches;
    const dx = e.nativeEvent.pageX - start.x0;
    const dy = e.nativeEvent.pageY - start.y0;
    if (Math.abs(dx) + Math.abs(dy) > 6) start.moved = true;
    if (touches.length >= 2 && start.dist0 > 0) {
      const ratio = distance(touches[0], touches[1]) / start.dist0;
      setManual({ scene: start.scene, view: { ...start.view, scale: clamp(start.view.scale * ratio, 0.3, 4) } });
    } else if (start.moved) {
      setManual({ scene: start.scene, view: { ...start.view, x: start.view.x + dx, y: start.view.y + dy } });
    }
  };
  const onTouchEnd = (e: GestureEvent) => {
    const start = gesture.current;
    gesture.current = null;
    if (!start || start.moved || e.nativeEvent.touches.length > 0) return;
    const hit = hitTest(start.x0, start.y0, start.view);
    if (hit) {
      haptic.select();
      setFocus({ scene, id: hit.id });
      setSheetId(hit.id);
    } else {
      setFocus(null);
    }
  };

  if (status === 'loading') {
    return <Text style={styles.muted}>{t('miniapp.common.loading')}</Text>;
  }
  if (status === 'error') {
    return <Empty title={t('error.generic')} subtitle={t('miniapp.common.retry')} />;
  }
  if (!payload || payload.nodes.length === 0) {
    return <Empty icon="point.3.connected.trianglepath.dotted" title={t('miniapp.graph.empty.title')} subtitle={t('miniapp.graph.empty.subtitle')} />;
  }

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {PERIODS.map((p) => (
          <Chip key={p} label={PERIOD_LABEL[p]} color={colors.tint} selected={period === p} onPress={() => setPeriod(p)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {categories.map((c) => {
          const meta = metaFor(c);
          return (
            <Chip
              key={c}
              label={meta.label}
              color={meta.color}
              selected={category === c}
              onPress={() => setCategory(category === c ? null : c)}
            />
          );
        })}
      </ScrollView>

      <View
        ref={containerRef}
        onLayout={onLayout}
        style={styles.canvas}
        onStartShouldSetResponder={() => true}
        onResponderGrant={onTouchStart}
        onResponderMove={onTouchMove}
        onResponderRelease={onTouchEnd}
        onResponderTerminate={() => {
          gesture.current = null;
        }}
        accessibilityLabel={t('miniapp.graph.title')}
        accessibilityHint={t('miniapp.graph.info.nav_body')}
      >
        {scene ? (
          <View style={[styles.world, { transform: [{ translateX: view.x }, { translateY: view.y }, { scale: view.scale }] }]}>
            <GraphCanvas
              width={size.width}
              height={CANVAS_HEIGHT}
              nodes={scene.nodes}
              links={scene.links}
              labels={scene.labels}
              focusId={focusId}
              focusNeighbors={focusNeighbors}
              category={category}
            />
          </View>
        ) : null}
      </View>

      <Text style={styles.hint}>{t('miniapp.graph.info.dots_body')}</Text>

      <Modal visible={sheetNode !== null} transparent animationType="slide" onRequestClose={() => setSheetId(null)}>
        <Pressable style={styles.scrim} onPress={() => setSheetId(null)} accessibilityLabel={t('miniapp.common.cancel')} />
        {sheetNode ? (
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetTop}>
              <View style={[styles.badge, { backgroundColor: metaFor(sheetNode.category).color + '26' }]}>
                <Text style={[styles.badgeText, { color: metaFor(sheetNode.category).color }]}>{metaFor(sheetNode.category).label}</Text>
              </View>
              <Text style={styles.date}>{new Date(sheetNode.created_at).toLocaleString()}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('miniapp.common.cancel')} onPress={() => setSheetId(null)} style={styles.close}>
                <Symbol name="xmark" size={14} color={colors.muted} weight="semibold" />
              </Pressable>
            </View>
            <Text style={styles.content}>{sheetNode.label}</Text>
            {linked.length > 0 ? (
              <>
                <Text style={styles.linkedTitle}>{t('miniapp.graph.linked_entries', { count: String(linked.length) })}</Text>
                <ScrollView style={styles.linkedList}>
                  {linked.map((n) => (
                    <Pressable
                      key={n.id}
                      accessibilityRole="button"
                      onPress={() => {
                        setFocus({ scene, id: n.id });
                        setSheetId(n.id);
                      }}
                      style={styles.linkedRow}
                    >
                      <Text style={styles.linkedText} numberOfLines={2}>{n.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const distance = (a: { pageX: number; pageY: number }, b: { pageX: number; pageY: number }) =>
  Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type GestureEvent = NativeSyntheticEvent<NativeTouchEvent>;

interface CanvasProps {
  width: number;
  height: number;
  nodes: LayoutNode[];
  links: LayoutLink[];
  labels: { x: number; y: number; category: string }[];
  focusId: string | null;
  focusNeighbors: Set<string> | null;
  category: string | null;
}

/** The drawing itself. Memoised, so pans and pinches move the wrapper without redrawing the dots. */
const GraphCanvas = memo(function GraphCanvas({ width, height, nodes, links, labels, focusId, focusNeighbors, category }: CanvasProps) {
  const lit = (n: LayoutNode) => {
    if (focusId) return n.id === focusId || (focusNeighbors?.has(n.id) ?? false) ? 1 : 0.12;
    if (category) return n.category === category ? 1 : 0.15;
    return 0.92;
  };
  return (
    <Svg width={width} height={height}>
      <G>
        {links.map((l, i) => {
          const s = l.source as LayoutNode;
          const tgt = l.target as LayoutNode;
          const stroke = l.type === 'branch' ? '#818cf8' : l.type === 'cross_category' ? '#fbbf24' : '#64748b';
          const opacity = l.type === 'branch' ? 0.7 : l.type === 'cross_category' ? 0.5 : 0.25;
          const focusOn = focusId && focusNeighbors && (s.id === focusId || tgt.id === focusId || (focusNeighbors.has(s.id) && focusNeighbors.has(tgt.id)));
          return (
            <Line
              key={`l${i}`}
              x1={s.x}
              y1={s.y}
              x2={tgt.x}
              y2={tgt.y}
              stroke={stroke}
              strokeWidth={l.type === 'similarity' ? 1 : 1.5}
              strokeOpacity={focusId ? (focusOn ? 0.6 : 0.03) : opacity}
              strokeDasharray={l.type === 'similarity' ? '3 4' : undefined}
            />
          );
        })}
      </G>
      <G>
        {nodes.map((n) => {
          const r = radiusOf(n.edge_count);
          const color = metaFor(n.category).color;
          const alpha = lit(n);
          return (
            <G key={n.id} opacity={alpha}>
              <Circle cx={n.x} cy={n.y} r={r * 2} fill={color} opacity={0.16} />
              <Circle cx={n.x} cy={n.y} r={r} fill={color} stroke="#080c14" strokeWidth={1.5} />
            </G>
          );
        })}
      </G>
      <G>
        {labels.map((l, i) => (
          <SvgText key={`c${i}`} x={l.x} y={l.y} fontSize={11} fontWeight="500" fill="#94a3b8" textAnchor="middle">
            {metaFor(l.category).label}
          </SvgText>
        ))}
      </G>
    </Svg>
  );
});

const makeStyles = (colors: Theme) => StyleSheet.create({
  wrap: { gap: 10 },
  chips: { gap: 8, paddingHorizontal: 2 },
  canvas: {
    height: CANVAS_HEIGHT,
    borderRadius: 16,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  world: { width: '100%', height: CANVAS_HEIGHT, transformOrigin: [0, 0, 0] },
  hint: { fontSize: colors.fs(13), color: colors.muted, paddingHorizontal: 4 },
  muted: { fontSize: colors.fs(14), color: colors.muted, paddingHorizontal: 16 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
    maxHeight: '70%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.separator },
  sheetTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: colors.fs(12), fontWeight: '600' },
  date: { flex: 1, fontSize: colors.fs(12), color: colors.muted },
  close: { minWidth: TOUCH - 10, minHeight: TOUCH - 10, alignItems: 'center', justifyContent: 'center' },
  content: { fontSize: colors.fs(16), color: colors.label, lineHeight: colors.fs(22) },
  linkedTitle: { fontSize: colors.fs(12), letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  linkedList: { maxHeight: 200 },
  linkedRow: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.bg, marginBottom: 6 },
  linkedText: { fontSize: colors.fs(15), color: colors.label },
});
