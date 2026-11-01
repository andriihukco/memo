import { StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { TOUCH } from '../components/ui';
import { useThemed, type Theme } from '../theme/theme';

/** Knowledge graph preview. No price or upgrade step while billing is off. Graph drawing is not ported yet. */
const FEATURES = [1, 2, 3, 4, 5].map((n) => t(`miniapp.graph.paywall.feature${n}`));
const ICONS = ['🔗', '🎨', '🔍', '✏️', '🌐'];

export function GraphView() {
  const { styles } = useThemed(makeStyles);
  return (
    <View style={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>🕸️</Text>
        <Text style={styles.heroTitle}>{t('miniapp.graph.paywall.title')}</Text>
        <Text style={styles.heroSub}>{t('miniapp.graph.paywall.subtitle')}</Text>
      </View>

      <View style={styles.card}>
        {FEATURES.map((f, i) => (
          <View key={f} style={[styles.feature, i > 0 && styles.border]}>
            <Text style={styles.featureIcon}>{ICONS[i]}</Text>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

    </View>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: colors.fs(34), fontWeight: '700', color: colors.label, paddingTop: 8 },
  hero: { alignItems: 'center', paddingTop: 36, gap: 10 },
  heroIcon: { fontSize: colors.fs(44) },
  heroTitle: { fontSize: colors.fs(26), fontWeight: '700', color: colors.label },
  heroSub: { fontSize: colors.fs(15), color: colors.muted, textAlign: 'center', paddingHorizontal: 24 },
  card: { marginTop: 28, borderRadius: 16, backgroundColor: colors.card, overflow: 'hidden' },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: TOUCH, paddingHorizontal: 16, paddingVertical: 10 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  featureIcon: { fontSize: colors.fs(18), width: 26, textAlign: 'center' },
  featureText: { flex: 1, fontSize: colors.fs(16), color: colors.label },
});
