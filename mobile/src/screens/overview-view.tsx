import { StyleSheet, View, Pressable } from 'react-native';
import { Text } from '../theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { t } from '../i18n';
import { useEntries } from '../lib/entry-store';
import { TOUCH } from '../components/ui';
import { PressScale } from '../motion';
import { useThemed, type Theme } from '../theme/theme';

/**
 * Insights > Widgets. The grid of widgets the user pinned. Empty state explains what goes here
 * and gives one clear action. Widget data arrives with the API.
 */
export function WidgetsView() {
  const { colors, styles } = useThemed(makeStyles);
  const { widgets } = useEntries();

  if (widgets.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="grid-outline" size={28} color={colors.tint} />
        </View>
        <Text style={styles.emptyTitle}>{t('insights.widgets_empty_title')}</Text>
        <Text style={styles.emptySub}>{t('insights.widgets_empty_sub')}</Text>
        <PressScale accessibilityRole="button" onPress={() => router.push('/widgets/new')} style={styles.cta}>
          <Ionicons name="add" size={18} color={colors.onTint} />
          <Text style={styles.ctaText}>{t('shell.compose')}</Text>
        </PressScale>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {widgets.map((w) => (
        <View key={w.id} style={styles.tile}>
          <Text style={styles.emoji}>{w.emoji}</Text>
          <Text style={styles.tileTitle} numberOfLines={2}>{w.title}</Text>
          <Text style={styles.tileUnit}>{w.unit}</Text>
        </View>
      ))}
      <Pressable accessibilityRole="button" onPress={() => router.push('/widgets/new')} style={styles.addTile}>
        <Ionicons name="add" size={26} color={colors.tint} />
        <Text style={styles.addText}>{t('shell.compose')}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  emoji: { fontSize: colors.fs(26) },
  tileTitle: { fontSize: colors.fs(15), fontWeight: '600', color: colors.label },
  tileUnit: { fontSize: colors.fs(13), color: colors.muted },
  addTile: { width: '47%', aspectRatio: 1.25, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.tint, alignItems: 'center', justifyContent: 'center', gap: 6 },
  addText: { fontSize: colors.fs(15), color: colors.tint, fontWeight: '500' },
  tile: { width: '47%', aspectRatio: 1.25, borderRadius: 18, backgroundColor: colors.card, padding: 14, justifyContent: 'flex-end', gap: 4 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 10, borderRadius: 20, backgroundColor: colors.card },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, marginBottom: 6 },
  emptyTitle: { fontSize: colors.fs(18), fontWeight: '600', color: colors.label, textAlign: 'center' },
  emptySub: { fontSize: colors.fs(15), color: colors.muted, textAlign: 'center' },
  cta: { marginTop: 10, minHeight: TOUCH, paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.tintFill, flexDirection: 'row', alignItems: 'center', gap: 6 },
  ctaText: { fontSize: colors.fs(16), fontWeight: '600', color: colors.onTint },
});
