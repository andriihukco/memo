import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useEntries } from '../../src/lib/entry-store';
import { groupByDay } from '../../src/lib/entries';
import { metaFor } from '../../src/lib/category-meta';
import { t, locale } from '../../src/i18n';
import { Chip, colors, Empty, TOUCH } from '../../src/components/ui';

const dayTitle = (key: string): string => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
};

export default function FeedScreen() {
  const { entries, categories, loading, refresh } = useEntries();
  const [filter, setFilter] = useState<string | null>(null);

  const filtered = useMemo(() => (filter ? entries.filter((e) => e.category === filter) : entries), [entries, filter]);
  const sections = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.muted} />}
    >
      <Text style={styles.title} accessibilityRole="header">{t('miniapp.feed.title')}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label={t('miniapp.feed.filter.all')} color={colors.tint} selected={filter === null} onPress={() => setFilter(null)} />
        {categories.map((c) => {
          const meta = metaFor(c.name, c.label_ua);
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
        sections.map((section) => (
          <View key={section.key}>
            <Text style={styles.day}>{dayTitle(section.key)}</Text>
            {section.entries.map((e, idx) => {
              const meta = metaFor(e.category, categories.find((c) => c.name === e.category)?.label_ua);
              const time = new Date(e.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
              return (
                <Animated.View key={e.id} entering={FadeInDown.delay(Math.min(idx, 10) * 45).duration(340).springify().damping(18)}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${meta.label}: ${e.content}`}
                  onPress={() => router.push(`/entry/${e.id}`)}
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.count}>{t('miniapp.feed.thread.count', { count: 1 })}</Text>
                    <View style={[styles.badge, { borderColor: meta.color + '66', backgroundColor: meta.color + '22' }]}>
                      <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>
                  <View style={styles.msg}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{t('miniapp.feed.thread.you').slice(0, 3)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.meta}>
                        <Text style={styles.who}>{t('miniapp.feed.thread.you')}</Text>
                        <Text style={styles.time}>{time}</Text>
                      </View>
                      <Text style={styles.text}>{e.content}</Text>
                      {e.bot_reply ? (
                        <Text style={styles.reply} numberOfLines={2}>{e.bot_reply}</Text>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
                </Animated.View>
              );
            })}
          </View>
        ))
      )}
      <View style={{ height: 150 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  title: { fontSize: 34, fontWeight: '700', color: colors.label, paddingHorizontal: 20, paddingTop: 8 },
  chips: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  day: { fontSize: 12, letterSpacing: 1, color: colors.muted, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  card: { marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 16, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, gap: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontSize: 13, color: colors.muted },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  msg: { flexDirection: 'row', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1E2A44', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 11, color: colors.tint, fontWeight: '600' },
  meta: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  who: { fontSize: 14, fontWeight: '600', color: colors.label },
  time: { fontSize: 12, color: colors.muted },
  text: { fontSize: 16, lineHeight: 23, color: colors.label, marginTop: 2 },
  reply: { fontSize: 13, fontStyle: 'italic', color: colors.muted, marginTop: 6 },
});
