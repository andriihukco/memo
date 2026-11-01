import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEntries } from '../../../src/lib/entry-store';
import { Empty, TOUCH } from '../../../src/components/ui';
import { useThemed, type Palette } from '../../../src/theme/theme';

export default function ReportScreen() {
  const { styles } = useThemed(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { reports } = useEntries();
  const report = reports.find((r) => r.id === id);

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>‹ Insights</Text>
      </Pressable>
      {report ? (
        <>
          <Text style={styles.title}>{report.title}</Text>
          <Text style={styles.period}>{report.period}</Text>
          <View style={styles.card}>
            <Text style={styles.body}>{report.body}</Text>
          </View>
        </>
      ) : (
        <Empty title="Report not found" />
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  content: { padding: 16, paddingTop: 60, paddingBottom: 40, gap: 8 },
  back: { minHeight: TOUCH, justifyContent: 'center' },
  backText: { fontSize: 17, color: colors.tint },
  title: { fontSize: 34, fontWeight: '700', color: colors.label },
  period: { fontSize: 15, color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginTop: 12 },
  body: { fontSize: 17, lineHeight: 24, color: colors.label },
});
