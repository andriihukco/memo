import { useMemo, useState, type ReactNode } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { Text } from '../../src/theme/typography';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useEntries } from '../../src/lib/entry-store';
import { entryTime, groupByDay } from '../../src/lib/entries';
import { layoutTimeline, type TimelineBlock } from '../../src/lib/timeline';
import type { Entry } from '../../src/lib/api';
import { metaFor } from '../../src/lib/category-meta';
import { t, getLocale } from '../../src/i18n';
import { Chip, Empty, TOUCH } from '../../src/components/ui';
import { Symbol } from '../../src/components/symbol';
import { useThemed, type Theme } from '../../src/theme/theme';
import { PressScale, ScreenEnter } from '../../src/motion';
import { TabHeader } from '../../src/components/tab-header';
import { TimelineCard, isTimelineEntry } from '../../src/components/timeline-card';
import { AddToTimeline } from '../../src/components/add-to-timeline';
import { useSession } from '../../src/lib/session';

const dayTitle = (key: string): string => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
};

const clock = (iso: string): string => new Date(iso).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });

const newestFirst = (a: Entry, b: Entry): number => Date.parse(entryTime(b)) - Date.parse(entryTime(a));

export default function FeedScreen() {
  return (
    <ScreenEnter>
      <FeedScreenBody />
    </ScreenEnter>
  );
}

function FeedScreenBody() {
  const { colors, styles } = useThemed(makeStyles);
  const { entries, categories, loading, refresh, remove } = useEntries();
  const { token } = useSession();
  const [filter, setFilter] = useState<string | null>(null);
  /** Null outside selection mode; while selecting, the ids picked so far. */
  const [selecting, setSelecting] = useState<Set<string> | null>(null);

  const toggleSelected = (id: string) =>
    setSelecting((prev) => {
      if (!prev) return new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openOrSelect = (id: string) => {
    if (selecting) toggleSelected(id);
    else router.push(`/entry/${id}`);
  };

  const deleteSelected = () => {
    const ids = [...(selecting ?? [])];
    if (ids.length === 0) return;
    Alert.alert(t('feed.delete_selected_title', { count: ids.length }), t('miniapp.feed.delete.irreversible'), [
      { text: t('miniapp.common.cancel'), style: 'cancel' },
      {
        text: t('entry.delete_action'),
        style: 'destructive',
        onPress: () => {
          void Promise.all(ids.map((id) => remove(id)));
          setSelecting(null);
        },
      },
    ]);
  };

  const filtered = useMemo(
    () => (filter ? entries.filter((e) => e.category === filter) : entries).slice().sort(newestFirst),
    [entries, filter],
  );
  const sections = useMemo(() => groupByDay(filtered), [filtered]);

  const metaOf = (category: string) => {
    const known = categories.find((c) => c.name === category);
    return metaFor(category, known?.label_ua, known?.color);
  };

  const renderCard = (e: Entry, idx: number) => {
    // Photos, videos, audio, music, quotes and stickers get their own cards.
    if (isTimelineEntry(e)) {
      return (
        <Animated.View key={e.id} entering={FadeInDown.delay(Math.min(idx, 10) * 45).duration(340).springify().damping(18)}>
          <TimelineCard entry={e} />
        </Animated.View>
      );
    }
    const meta = metaOf(e.category);
    const picked = selecting?.has(e.id) ?? false;
    return (
      <Animated.View key={e.id} entering={FadeInDown.delay(Math.min(idx, 10) * 45).duration(340).springify().damping(18)}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`${meta.label}: ${e.content}`}
          accessibilityState={{ selected: picked }}
          onPress={() => openOrSelect(e.id)}
          onLongPress={() => toggleSelected(e.id)}
          style={[styles.card, picked && { borderColor: colors.tint, borderWidth: 2 }]}
        >
          <View style={[styles.iconWrap, { backgroundColor: meta.color + '22' }]}>
            <Symbol name={meta.icon} size={18} color={meta.color} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{meta.label}</Text>
            <Text style={styles.text} numberOfLines={3}>{e.content}</Text>
            {e.bot_reply ? <Text style={styles.reply} numberOfLines={2}>{e.bot_reply}</Text> : null}
          </View>
        </PressScale>
      </Animated.View>
    );
  };

  const renderTile = (e: Entry) => {
    // A media entry never shrinks to a tile: it keeps its card.
    if (isTimelineEntry(e)) return <View key={e.id} style={styles.fullWidth}><TimelineCard entry={e} /></View>;
    const meta = metaOf(e.category);
    const picked = selecting?.has(e.id) ?? false;
    return (
      <PressScale
        key={e.id}
        accessibilityRole="button"
        accessibilityLabel={`${meta.label}: ${e.content}`}
        accessibilityState={{ selected: picked }}
        onPress={() => openOrSelect(e.id)}
        onLongPress={() => toggleSelected(e.id)}
        style={[styles.tile, { borderColor: picked ? colors.tint : meta.color + '55' }, picked && { borderWidth: 2 }]}
      >
        <View style={styles.tileTop}>
          <Symbol name={meta.icon} size={16} color={meta.color} />
          <Text style={styles.tileTime}>{clock(entryTime(e))}</Text>
        </View>
        <Text style={styles.tileText} numberOfLines={4}>{e.content}</Text>
      </PressScale>
    );
  };

  /** One timeline row: time on the left, a dot on the rail, content on the right. */
  const row = (first: Entry, dotColor: string, body: ReactNode, key: string) => (
    <View key={key} style={styles.row}>
      <Text style={styles.rowTime}>{clock(entryTime(first))}</Text>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <View style={styles.line} />
      </View>
      <View style={styles.rowBody}>{body}</View>
    </View>
  );

  const renderBlock = (block: TimelineBlock, key: string, idx: number) => {
    if (block.kind === 'card') {
      const meta = metaOf(block.entry.category);
      return row(block.entry, meta.color, renderCard(block.entry, idx), key);
    }
    const lead = block.entries[0];
    const meta = metaOf(lead.category);
    return row(lead, meta.color, <View style={styles.grid}>{block.entries.map(renderTile)}</View>, key);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.muted} />}
    >
      <TabHeader title={t('shell.journal')} />
      <View style={styles.titleRow}>
        {selecting === null ? <AddToTimeline token={token} onSaved={() => void refresh()} /> : null}
        {selecting === null ? (
          <Pressable accessibilityRole="button" onPress={() => setSelecting(new Set())} style={styles.selectButton}>
            <Text style={styles.selectText}>{t('feed.select')}</Text>
          </Pressable>
        ) : null}
      </View>

      {selecting !== null ? (
        <View style={styles.selectBar}>
          <Text style={styles.selectCount}>{t('feed.selected', { count: selecting.size })}</Text>
          <Pressable accessibilityRole="button" disabled={selecting.size === 0} onPress={deleteSelected} style={styles.selectButton}>
            <Text style={[styles.selectText, { color: colors.destructive }, selecting.size === 0 && styles.disabled]}>{t('entry.delete_action')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setSelecting(null)} style={styles.selectButton}>
            <Text style={styles.selectText}>{t('feed.done')}</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label={t('miniapp.feed.filter.all')} color={colors.tint} selected={filter === null} onPress={() => setFilter(null)} />
        {categories.map((c) => {
          const meta = metaFor(c.name, c.label_ua, c.color);
          return (
            <Chip
              key={c.name}
              label={meta.label}
              color={meta.color}
              selected={filter === c.name}
              onPress={() => setFilter(filter === c.name ? null : c.name)}
            />
          );
        })}
      </ScrollView>

      {entries.length === 0 ? (
        <Empty
          icon="book.closed"
          title={t('miniapp.feed.empty.title')}
          subtitle={t('miniapp.feed.empty.subtitle')}
          action={{ label: t('feed.empty_cta'), onPress: () => router.push('/compose') }}
        />
      ) : filtered.length === 0 ? (
        <Empty title={t('miniapp.feed.empty_cat.title')} subtitle={t('miniapp.feed.empty_cat.subtitle')} />
      ) : (
        sections.map((section) => {
          let cardIndex = 0;
          return (
            <View key={section.key}>
              <Text style={styles.day}>{dayTitle(section.key)}</Text>
              {layoutTimeline(section.entries).map((block, i) => {
                const idx = cardIndex;
                cardIndex += block.kind === 'card' ? 1 : 0;
                return renderBlock(block, `${section.key}-${i}`, idx);
              })}
            </View>
          );
        })
      )}
      <View style={{ height: 150 }} />
    </ScrollView>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  content: { paddingBottom: 40 },
  fullWidth: { width: '100%' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 },
  title: { fontSize: colors.fs(34), fontWeight: '700', color: colors.label, paddingHorizontal: 20, paddingTop: 8, flexShrink: 1 },
  selectButton: { minHeight: TOUCH, minWidth: TOUCH, justifyContent: 'center', paddingHorizontal: 8 },
  selectText: { fontSize: colors.fs(17), color: colors.tint },
  selectBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  selectCount: { fontSize: colors.fs(15), color: colors.muted, flex: 1 },
  disabled: { opacity: 0.4 },
  chips: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  day: { fontSize: colors.fs(12), letterSpacing: 1, color: colors.muted, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  row: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12 },
  rowTime: { width: 48, paddingTop: 16, fontSize: colors.fs(13), color: colors.muted, textAlign: 'right', fontVariant: ['tabular-nums'] },
  rail: { width: 22, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 20, zIndex: 1 },
  line: { position: 'absolute', top: 0, bottom: 0, width: 2, left: 10, backgroundColor: colors.separator },
  rowBody: { flex: 1, paddingLeft: 8 },
  card: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 20, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { fontSize: colors.fs(15), fontWeight: '600', color: colors.label },
  text: { fontSize: colors.fs(15), lineHeight: 21, color: colors.secondary },
  reply: { fontSize: colors.fs(13), fontStyle: 'italic', color: colors.muted, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48.5%', minHeight: TOUCH * 2, padding: 12, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, gap: 8 },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tileTime: { fontSize: colors.fs(11), color: colors.muted, fontVariant: ['tabular-nums'] },
  tileText: { fontSize: colors.fs(14), lineHeight: 19, color: colors.label },
});
