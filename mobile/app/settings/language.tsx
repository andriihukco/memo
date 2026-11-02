import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../src/theme/typography';
import { router } from 'expo-router';
import { LOCALES, getLocale, setLocale, t, useLocale } from '../../src/i18n';
import { useSession } from '../../src/lib/session';
import { api } from '../../src/lib/api';
import { storeLocale } from '../../src/lib/app-state';
import { SettingsCard, SettingsSection } from '../../src/components/settings-ui';
import { TOUCH } from '../../src/components/ui';
import { Symbol } from '../../src/components/symbol';
import { ScreenEnter } from '../../src/motion';
import { useThemed, type Theme } from '../../src/theme/theme';

/** Interface language. Its own page so the Settings list stays short. */
export default function LanguageScreen() {
  return (
    <ScreenEnter>
      <LanguageScreenBody />
    </ScreenEnter>
  );
}

function LanguageScreenBody() {
  const { colors, styles } = useThemed(makeStyles);
  const { token, live } = useSession();
  const locale = useLocale();

  const choose = (code: (typeof LOCALES)[number]['code']) => {
    if (code === getLocale()) return;
    setLocale(code);
    void storeLocale(code);
    // The account keeps its language too, so the bot and the Mini App match.
    if (live && token) void api.setLanguage(token, code).catch(() => {});
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('shell.back')} onPress={() => router.back()} style={styles.headerButton}>
          <Symbol name="chevron.backward" size={18} color={colors.tint} weight="semibold" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('miniapp.settings.language')}</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <SettingsSection title={t('miniapp.settings.language')}>
          <SettingsCard
            items={LOCALES.map((l) => ({
              icon: 'globe',
              title: l.nativeName,
              selected: locale === l.code,
              onPress: () => choose(l.code),
            }))}
          />
        </SettingsSection>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerButton: { minWidth: TOUCH, minHeight: TOUCH, justifyContent: 'center' },
  headerTitle: { fontSize: colors.fs(17), fontWeight: '600', color: colors.label },
  content: { padding: 16, paddingTop: 4, paddingBottom: 40 },
});
