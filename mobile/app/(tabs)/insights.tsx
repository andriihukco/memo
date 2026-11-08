import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../src/theme/typography';
import { useLocalSearchParams } from 'expo-router';
import { t } from '../../src/i18n';
import { TOUCH } from '../../src/components/ui';
import { TabHeader } from '../../src/components/tab-header';
import { WidgetsView } from '../../src/screens/overview-view';
import { GoalsView } from '../../src/screens/goals-view';
import { ReportsView } from '../../src/screens/reports-view';
import { GraphView } from '../../src/screens/graph-view';
import { useThemed, type Theme } from '../../src/theme/theme';
import { ScreenEnter } from '../../src/motion';

/** Trends segments, in order: Charts (widgets), Goals, Reports, Graph. */
const VIEWS = ['widgets', 'goals', 'reports', 'graph'] as const;
type InsightsView = (typeof VIEWS)[number];

/** Older links used "overview" for the widgets view. */
const toView = (value: string | undefined): InsightsView =>
  value === 'overview' ? 'widgets' : (VIEWS as readonly string[]).includes(value ?? '') ? (value as InsightsView) : 'widgets';

export default function InsightsScreen() {
  return (
    <ScreenEnter>
      <InsightsScreenBody />
    </ScreenEnter>
  );
}

function InsightsScreenBody() {
  const { styles } = useThemed(makeStyles);
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<InsightsView>(toView(params.view));

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <TabHeader title={t('shell.trends')} />
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

      {view === 'widgets' ? <WidgetsView /> : view === 'goals' ? <GoalsView /> : view === 'graph' ? <GraphView /> : <ReportsView />}
    </ScrollView>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  content: { padding: 16, paddingTop: 8, paddingBottom: 40 },
  segments: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 16 },
  segment: { flex: 1, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.card },
  segmentOn: { backgroundColor: colors.tintFill },
  segmentText: { fontSize: colors.fs(15), fontWeight: '500', color: colors.muted },
  segmentTextOn: { color: colors.onTint, fontWeight: '600' },
});
