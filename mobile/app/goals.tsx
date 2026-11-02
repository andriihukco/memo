import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../src/theme/typography';
import { router } from 'expo-router';
import { t } from '../src/i18n';
import { GoalsView } from '../src/screens/goals-view';
import { useThemed, type Theme } from '../src/theme/theme';
import { ScreenEnter } from '../src/motion';
import { TOUCH } from '../src/components/ui';

/** Goals as a stacked screen, with a back control. Insights shows the same content in its Goals tab. */
export default function GoalsScreen() {
  return (
    <ScreenEnter>
      <GoalsScreenBody />
    </ScreenEnter>
  );
}

function GoalsScreenBody() {
  const { styles } = useThemed(makeStyles);
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('categories.back')} onPress={() => router.back()} style={styles.headerButton}>
          <Text style={styles.link}>‹ {t('categories.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('goals.title')}</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <GoalsView />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerButton: { minWidth: TOUCH, minHeight: TOUCH, justifyContent: 'center' },
  title: { fontSize: colors.fs(17), fontWeight: '600', color: colors.label },
  link: { fontSize: colors.fs(15), color: colors.tint },
  content: { paddingBottom: 40 },
});
