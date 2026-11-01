import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { t } from '../i18n';
import { useEntries } from '../lib/entry-store';
import { TOUCH } from '../components/ui';
import { useThemed, type Palette } from '../theme/theme';

type Segment = 'widgets' | 'goals';

/** Widgets grid and Goals, same header controls as the Mini App. Widget data arrives with the API. */
export function OverviewView() {
  const { colors, styles } = useThemed(makeStyles);
  const [segment, setSegment] = useState<Segment>('widgets');
  const { widgets } = useEntries();

  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={styles.segments} accessibilityRole="tablist">
          {(['widgets', 'goals'] as Segment[]).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: segment === key }}
              onPress={() => setSegment(key)}
              style={styles.segBtn}
            >
              <Text style={[styles.segText, segment === key && styles.segOn]}>
                {key === 'widgets' ? t('miniapp.dashboard.title.widgets') : t('miniapp.dashboard.title.goals')}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('miniapp.dashboard.calendar.range.today')} style={styles.pill}>
          <Ionicons name="calendar-outline" size={16} color={colors.muted} />
          <Text style={styles.pillText}>{t('miniapp.dashboard.calendar.range.today')}</Text>
        </Pressable>
      </View>

      {segment === 'widgets' ? (
        <View style={styles.grid}>
          {widgets.map((w) => (
            <View key={w.id} style={styles.tile}>
              <Text style={styles.emoji}>{w.emoji}</Text>
              <Text style={styles.tileTitle} numberOfLines={2}>{w.title}</Text>
              <Text style={styles.tileUnit}>{w.unit}</Text>
            </View>
          ))}
          {widgets.length === 0 ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/widgets/new')} style={styles.addTile}>
              <Ionicons name="add" size={26} color={colors.tint} />
              <Text style={styles.addText}>{t('shell.compose')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('miniapp.dashboard.title.goals')}</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 16 },
  segments: { flexDirection: 'row', gap: 16 },
  segBtn: { minHeight: TOUCH, justifyContent: 'center' },
  segText: { fontSize: 28, fontWeight: '700', color: colors.muted },
  segOn: { color: colors.label },
  pill: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.card },
  pillText: { fontSize: 15, color: colors.muted },
  emoji: { fontSize: 26 },
  tileTitle: { fontSize: 15, fontWeight: '600', color: colors.label },
  tileUnit: { fontSize: 13, color: colors.muted },
  addTile: { width: '47%', aspectRatio: 1.25, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.tint, alignItems: 'center', justifyContent: 'center', gap: 6 },
  addText: { fontSize: 15, color: colors.tint, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '47%', aspectRatio: 1.25, borderRadius: 18, backgroundColor: colors.card, padding: 14, justifyContent: 'flex-end', gap: 4 },
  empty: { paddingVertical: 80, alignItems: 'center' },
  emptyTitle: { fontSize: 17, color: colors.muted },
});
