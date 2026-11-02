import { ScrollView, StyleSheet } from 'react-native';
import { t } from '../../src/i18n';
import { TabHeader } from '../../src/components/tab-header';
import { GraphView } from '../../src/screens/graph-view';
import { useThemed, type Theme } from '../../src/theme/theme';
import { ScreenEnter } from '../../src/motion';

/** Graph: the knowledge graph of your entries. Its own bottom tab. */
export default function GraphScreen() {
  return (
    <ScreenEnter>
      <GraphScreenBody />
    </ScreenEnter>
  );
}

function GraphScreenBody() {
  const { styles } = useThemed(makeStyles);
  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <TabHeader title={t('shell.graph')} />
      <GraphView />
    </ScrollView>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  content: { padding: 16, paddingTop: 8, paddingBottom: 40 },
});
