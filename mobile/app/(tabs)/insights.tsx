import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { t } from '../../src/i18n';
import { TOUCH } from '../../src/components/ui';
import { OverviewView } from '../../src/screens/overview-view';
import { ReportsView } from '../../src/screens/reports-view';
import { GraphView } from '../../src/screens/graph-view';
import { useThemed, type Theme } from '../../src/theme/theme';

/** Same three views as web's /miniapp/insights?view=… */
const VIEWS = ['overview', 'reports', 'graph'] as const;
type InsightsView = (typeof VIEWS)[number];

const isView = (value: string | undefined): value is InsightsView => (VIEWS as readonly string[]).includes(value ?? '');

export default function InsightsScreen() {
  const { colors, styles } = useThemed(makeStyles);
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<InsightsView>(isView(params.view) ? params.view : 'overview');

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Text style={[styles.title, { fontFamily: colors.heading }]} accessibilityRole="header">{t('shell.insights')}</Text>
      <View style={styles.segments} accessibilityRole="tablist">
        {VIEWS.map((key) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === key }}
            onPress={() => setView(key)}
            style={[styles.segment, view === key && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, view === key && styles.segmentTextOn]}>{t(`insights.view.${key}`)}</Text>
          </Pressable>
        ))}
      </View>

      {view === 'reports' ? <ReportsView /> : view === 'graph' ? <GraphView /> : <OverviewView />}
    </ScrollView>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  content: { padding: 16, paddingTop: 8, paddingBottom: 40 },
  title: { fontSize: colors.fs(34), fontWeight: '700', color: colors.label },
  segments: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 16 },
  segment: { flex: 1, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.card },
  segmentOn: { backgroundColor: colors.tintFill },
  segmentText: { fontSize: colors.fs(15), fontWeight: '500', color: colors.muted },
  segmentTextOn: { color: colors.onTint, fontWeight: '600' },
});
