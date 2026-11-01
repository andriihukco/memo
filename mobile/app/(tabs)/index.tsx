import { useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useEntries } from '../../src/lib/entry-store';
import { entryTime, groupByDay } from '../../src/lib/entries';
import { layoutTimeline, type TimelineBlock } from '../../src/lib/timeline';
import type { Entry } from '../../src/lib/api';
import { metaFor } from '../../src/lib/category-meta';
import { t, locale } from '../../src/i18n';
import { Chip, Empty, TOUCH } from '../../src/components/ui';
import { Symbol } from '../../src/components/symbol';
import { useThemed, type Theme } from '../../src/theme/theme';

const dayTitle = (key: string): string => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
};

const clock = (iso: string): string => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

const newestFirst = (a: Entry, b: Entry): number => Date.parse(entryTime(b)) - Date.parse(entryTime(a));

export default function FeedScreen() {
  const { colors, styles } = useThemed(makeStyles);
  const { entries, categories, loading, refresh } = useEntries();
  const [filter, setFilter] = useState<string | null>(null);

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
    const meta = metaOf(e.category);
    return (
      <Animated.View key={e.id} entering={FadeInDown.delay(Math.min(idx, 10) * 45).duration(340).springify().damping(18)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${meta.label}: ${e.content}`}
          onPress={() => router.push(`/entry/${e.id}`)}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
        >
          <View style={[styles.iconWrap, { backgroundColor: meta.color + '22' }]}>
            <Symbol name={meta.icon} size={18} color={meta.color} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{meta.label}</Text>
            <Text style={styles.text} numberOfLines={3}>{e.content}</Text>
            {e.bot_reply ? <Text style={styles.reply} numberOfLines={2}>{e.bot_reply}</Text> : null}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const renderTile = (e: Entry) => {
    const meta = metaOf(e.category);
    return (
      <Pressable
        key={e.id}
        accessibilityRole="button"
        accessibilityLabel={`${meta.label}: ${e.content}`}
        onPress={() => router.push(`/entry/${e.id}`)}
        style={({ pressed }) => [styles.tile, { borderColor: meta.color + '55' }, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.tileTop}>
          <Symbol name={meta.icon} size={16} color={meta.color} />
          <Text style={styles.tileTime}>{clock(entryTime(e))}</Text>
        </View>
        <Text style={styles.tileText} numberOfLines={4}>{e.content}</Text>
      </Pressable>
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
      <Text style={[styles.title, { fontFamily: colors.heading }]} accessibilityRole="header">{t('miniapp.feed.title')}</Text>

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
        <Empty title={t('miniapp.feed.empty.title')} subtitle={t('miniapp.feed.empty.subtitle')} />
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
  title: { fontSize: colors.fs(34), fontWeight: '700', color: colors.label, paddingHorizontal: 20, paddingTop: 8 },
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
