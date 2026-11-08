import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { Text } from '../../src/theme/typography';
import { t, useLocale } from '../../src/i18n';
import { TOUCH } from '../../src/components/ui';
import { Symbol } from '../../src/components/symbol';
import { TabHeader } from '../../src/components/tab-header';
import { PressScale, ScreenEnter } from '../../src/motion';
import { useEntries } from '../../src/lib/entry-store';
import { useSession } from '../../src/lib/session';
import { api, type Entry, type Goal } from '../../src/lib/api';
import { buildToday, type TodayTile } from '../../src/lib/today';
import { entryTime, unitLabel } from '../../src/lib/metrics';
import { useThemed, type Theme } from '../../src/theme/theme';

/** SF Symbols for the metric icons the server stores (lucide names). */
const SYMBOLS: Record<string, string> = {
  droplets: 'drop.fill', utensils: 'fork.knife', moon: 'moon.fill', smile: 'face.smiling', footprints: 'figure.walk',
  'map-pin': 'map', timer: 'timer', flame: 'flame.fill', scale: 'scalemass', coffee: 'cup.and.saucer.fill',
  zap: 'bolt.fill', activity: 'waveform.path.ecg', beef: 'fork.knife', wheat: 'leaf',
};

const UNDO_MS = 6000;

/**
 * Today: Apple Health's Summary for a journal. Totals for today with day goals as rings,
 * one-tap logging, and what was written today. Mirrors src/components/features/today on the web.
 */
export default function TodayScreen() {
  return (
    <ScreenEnter>
      <TodayBody />
    </ScreenEnter>
  );
}

function Ring({ ratio, color, track }: { ratio: number; color: string; track: string }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={44} height={44} viewBox="0 0 44 44" style={{ transform: [{ rotate: '-90deg' }] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={22} cy={22} r={r} fill="none" strokeWidth={5} stroke={track} />
      <Circle cx={22} cy={22} r={r} fill="none" strokeWidth={5} stroke={color} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} />
    </Svg>
  );
}

function Tile({ tile, locale }: { tile: TodayTile; locale: string }) {
  const { colors, styles } = useThemed(makeStyles);
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const unit = unitLabel(tile.unit, locale);
  const goalText = tile.goal ? t('today.goal_of', { target: fmt.format(tile.goal.target), unit }) : '';
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${tile.label}, ${fmt.format(tile.value)} ${unit}${goalText ? `, ${goalText}` : ''}`}>
      <View style={styles.tileHead}>
        <Symbol name={SYMBOLS[tile.icon ?? ''] ?? 'waveform.path.ecg'} size={15} color={colors.tint} />
        <Text style={styles.tileLabel} numberOfLines={1}>{tile.label}</Text>
      </View>
      <View style={styles.tileFoot}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.tileValue}>
            {fmt.format(tile.value)} <Text style={styles.tileUnit}>{unit}</Text>
          </Text>
          {tile.goal ? <Text style={styles.tileGoal}>{goalText}</Text> : null}
        </View>
        {tile.goal ? <Ring ratio={tile.goal.ratio} color={colors.tint} track={colors.separator} /> : null}
      </View>
    </View>
  );
}

function TodayBody() {
  const { colors, styles } = useThemed(makeStyles);
  const locale = useLocale();
  const { entries, loading, refresh, add, remove } = useEntries();
  const { token, live } = useSession();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [logging, setLogging] = useState(false);
  const [undo, setUndo] = useState<Entry | null>(null);

  const loadGoals = useCallback(async () => {
    if (!live || !token) return;
    try {
      setGoals((await api.listGoals(token)).goals);
    } catch {
      // Goals are optional on Today; tiles still show without rings.
    }
  }, [live, token]);

  // Back on this tab: new day, new goals.
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      void loadGoals();
    }, [loadGoals]),
  );
  // The Undo bar hides itself after a few seconds; a new log restarts the timer.
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const view = useMemo(() => buildToday(entries, goals, now, locale), [entries, goals, now, locale]);
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  const dateLabel = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  /** One tap, one glass: saved like any entry, so the server counts 250 ml. */
  const logWater = async () => {
    if (logging) return;
    setLogging(true);
    try {
      const saved = await add(t('today.quick.water_text'), 'uncategorized');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNow(new Date());
      if (saved) setUndo(saved);
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLogging(false);
    }
  };

  const undoWater = async () => {
    if (!undo) return;
    const id = undo.id;
    setUndo(null);
    await remove(id);
  };

  const quick = [
    { id: 'water', label: t('today.quick.water'), icon: 'drop.fill', onPress: () => void logWater() },
    { id: 'mood', label: t('today.quick.mood'), icon: 'face.smiling', onPress: () => router.push({ pathname: '/compose', params: { text: t('today.quick.mood_seed') } }) },
    { id: 'sleep', label: t('today.quick.sleep'), icon: 'moon.fill', onPress: () => router.push({ pathname: '/compose', params: { text: t('today.quick.sleep_seed') } }) },
    { id: 'note', label: t('today.quick.note'), icon: 'square.and.pencil', onPress: () => router.push('/compose') },
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setNow(new Date()); void refresh(); void loadGoals(); }} tintColor={colors.tint} />}
    >
      <TabHeader title={t('shell.today')} />
      <Text style={styles.date}>{dateLabel}</Text>

      <Text style={styles.section} accessibilityRole="header">{t('today.quick')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
        {quick.map((q) => (
          <PressScale
            key={q.id}
            accessibilityRole="button"
            accessibilityLabel={q.label}
            accessibilityState={{ disabled: q.id === 'water' && logging }}
            disabled={q.id === 'water' && logging}
            onPress={q.onPress}
            style={styles.quick}
          >
            <Symbol name={q.icon} size={16} color={colors.tint} />
            <Text style={styles.quickText}>{q.label}</Text>
          </PressScale>
        ))}
      </ScrollView>
      {undo ? (
        <View style={styles.undoBar} accessibilityLiveRegion="polite">
          <Text style={styles.undoText}>{t('today.quick.water_added')}</Text>
          <PressScale accessibilityRole="button" onPress={() => void undoWater()} style={styles.undoButton}>
            <Text style={styles.undoAction}>{t('shell.undo')}</Text>
          </PressScale>
        </View>
      ) : null}

      <Text style={styles.section} accessibilityRole="header">{t('today.summary')}</Text>
      {view.tiles.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>{t('today.no_numbers')}</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {view.tiles.map((tile) => (
            <View key={tile.key} style={styles.cell}>
              <Tile tile={tile} locale={locale} />
            </View>
          ))}
        </View>
      )}

      <View style={styles.sectionRow}>
        <Text style={[styles.section, { marginTop: 0, marginBottom: 0 }]} accessibilityRole="header">{t('today.entries')}</Text>
        <PressScale accessibilityRole="link" onPress={() => router.navigate('/journal')} style={styles.seeAll}>
          <Text style={styles.seeAllText}>{t('today.see_all')}</Text>
          <Symbol name="chevron.right" size={13} color={colors.tint} />
        </PressScale>
      </View>
      {view.entries.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>{t('today.empty_title')}</Text>
          <Text style={styles.muted}>{t('today.empty_body')}</Text>
          <PressScale accessibilityRole="button" onPress={() => router.push('/compose')} style={styles.writeButton}>
            <Symbol name="square.and.pencil" size={16} color={colors.onTint} />
            <Text style={styles.writeText}>{t('today.write')}</Text>
          </PressScale>
        </View>
      ) : (
        <View style={styles.list}>
          {view.entries.slice(0, 6).map((e, i) => (
            <PressScale
              key={e.id}
              accessibilityRole="link"
              onPress={() => router.push(`/entry/${e.id}`)}
              style={[styles.row, i > 0 && styles.rowDivider]}
            >
              <Text style={styles.time}>{timeFmt.format(entryTime(e))}</Text>
              <Text style={styles.rowText} numberOfLines={2}>{e.content}</Text>
              <Symbol name="chevron.right" size={13} color={colors.muted} />
            </PressScale>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  content: { padding: 16, paddingTop: 8, paddingBottom: 120 },
  date: { fontSize: colors.fs(16), color: colors.muted, marginTop: 2, textTransform: 'capitalize' },
  section: { fontSize: colors.fs(20), fontWeight: '700', color: colors.label, marginTop: 28, marginBottom: 12, fontFamily: colors.heading },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 },
  quickRow: { gap: 8, paddingRight: 16 },
  quick: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.card },
  quickText: { fontSize: colors.fs(16), color: colors.label, fontWeight: '500' },
  undoBar: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, borderRadius: 14, backgroundColor: colors.card },
  undoText: { fontSize: colors.fs(15), color: colors.label },
  undoButton: { minHeight: TOUCH, minWidth: TOUCH, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  undoAction: { fontSize: colors.fs(15), color: colors.tint, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  cell: { width: '50%', padding: 6 },
  tile: { minHeight: 96, justifyContent: 'space-between', gap: 12, padding: 16, borderRadius: 18, backgroundColor: colors.card },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabel: { fontSize: colors.fs(14), fontWeight: '600', color: colors.tint, flexShrink: 1 },
  tileFoot: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  tileValue: { fontSize: colors.fs(24), fontWeight: '700', color: colors.label, fontVariant: ['tabular-nums'] },
  tileUnit: { fontSize: colors.fs(14), fontWeight: '400', color: colors.muted },
  tileGoal: { fontSize: colors.fs(12), color: colors.muted, marginTop: 2 },
  card: { padding: 16, borderRadius: 18, backgroundColor: colors.card, gap: 8 },
  muted: { fontSize: colors.fs(15), color: colors.muted },
  emptyTitle: { fontSize: colors.fs(16), fontWeight: '600', color: colors.label },
  writeButton: { alignSelf: 'flex-start', minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.tintFill, marginTop: 4 },
  writeText: { fontSize: colors.fs(16), fontWeight: '600', color: colors.onTint },
  seeAll: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  seeAllText: { fontSize: colors.fs(16), color: colors.tint },
  list: { borderRadius: 18, backgroundColor: colors.card, overflow: 'hidden' },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  time: { minWidth: 48, fontSize: colors.fs(14), color: colors.muted, fontVariant: ['tabular-nums'] },
  rowText: { flex: 1, fontSize: colors.fs(16), color: colors.label },
});
