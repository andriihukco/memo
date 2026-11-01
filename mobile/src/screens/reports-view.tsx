import { StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useEntries } from '../lib/entry-store';
import { t } from '../i18n';
import { colors, TOUCH } from '../components/ui';

const EMPTY_FEATURES = [1, 2, 3, 4, 5].map((n) => t(`miniapp.reports.empty.feature${n}`));

/** Insights > Reports: retrospectives list and empty state (as on web). */
export function ReportsView() {
  const { reports } = useEntries();

  return (
    <View style={styles.content}>
      {reports.length > 0 ? (
        <View style={styles.card}>
          {reports.map((r, i) => (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              onPress={() => router.push(`/insights/report/${r.id}`)}
              style={[styles.row, i > 0 && styles.border]}
            >
              <Text style={styles.rowTitle}>{r.title}</Text>
              <Text style={styles.rowSub}>{r.period}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.bulb}>💡</Text>
          <Text style={styles.emptyTitle}>{t('miniapp.reports.empty.title')}</Text>
          <Text style={styles.emptySub}>{t('miniapp.reports.empty.subtitle')}</Text>
          <View style={styles.features}>
            {EMPTY_FEATURES.map((f) => (
              <Text key={f} style={styles.feature}>• {f}</Text>
            ))}
          </View>
          <Pressable accessibilityRole="button" style={styles.cta} onPress={() => router.push('/insights/new')}>
            <Text style={styles.ctaText}>{t('miniapp.reports.empty.cta')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 34, fontWeight: '700', color: colors.label },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 2 },
  card: { borderRadius: 16, backgroundColor: colors.card, overflow: 'hidden' },
  row: { minHeight: TOUCH, paddingHorizontal: 16, paddingVertical: 12 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  rowTitle: { fontSize: 17, color: colors.label },
  rowSub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 56, gap: 10 },
  bulb: { fontSize: 44 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: colors.label },
  emptySub: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  features: { alignSelf: 'stretch', marginTop: 12, gap: 6, paddingHorizontal: 8 },
  feature: { fontSize: 15, color: colors.secondary },
  cta: { marginTop: 16, minHeight: TOUCH + 4, paddingHorizontal: 24, borderRadius: 16, backgroundColor: colors.tint, justifyContent: 'center' },
  ctaText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
