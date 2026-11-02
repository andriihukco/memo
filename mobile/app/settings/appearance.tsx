import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../src/theme/typography';
import { router } from 'expo-router';
import { t } from '../../src/i18n';
import { SettingsCard, SettingsSection } from '../../src/components/settings-ui';
import { TOUCH } from '../../src/components/ui';
import { Symbol } from '../../src/components/symbol';
import { THEME_CHOICES } from '../../src/theme/palettes';
import { ScreenEnter } from '../../src/motion';
import { APP_FONTS, TEXT_SCALES, useTheme, useThemed, type Theme } from '../../src/theme/theme';

/** Theme, text size and heading font. Its own page, reached from Settings. */
export default function AppearanceScreen() {
  return (
    <ScreenEnter>
      <AppearanceScreenBody />
    </ScreenEnter>
  );
}

function AppearanceScreenBody() {
  const { colors, styles } = useThemed(makeStyles);
  const { choice, setChoice, textScale, setTextScale, font, setFont } = useTheme();

  const themeLabel: Record<(typeof THEME_CHOICES)[number], string> = {
    system: t('miniapp.settings.appearance.system'),
    light: t('miniapp.settings.appearance.light'),
    dark: t('miniapp.settings.appearance.dark'),
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('shell.back')} onPress={() => router.back()} style={styles.headerButton}>
          <Symbol name="chevron.backward" size={18} color={colors.tint} weight="semibold" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('miniapp.settings.appearance')}</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <SettingsSection title={t('miniapp.settings.appearance')}>
          <SettingsCard
            items={THEME_CHOICES.map((c) => ({
              icon: 'circle.lefthalf.filled',
              title: themeLabel[c],
              selected: choice === c,
              onPress: () => setChoice(c),
            }))}
          />
        </SettingsSection>
        <SettingsSection title={t('miniapp.settings.appearance.text_size')}>
          <SettingsCard
            items={TEXT_SCALES.map((k) => ({
              icon: 'textformat.size',
              title: t(`miniapp.settings.appearance.text_${k}`),
              selected: textScale === k,
              onPress: () => setTextScale(k),
            }))}
          />
        </SettingsSection>
        <SettingsSection title={t('miniapp.settings.appearance.font')}>
          <SettingsCard
            items={APP_FONTS.map((k) => ({
              icon: 'textformat',
              title: t(`miniapp.settings.appearance.font_${k}`),
              selected: font === k,
              onPress: () => setFont(k),
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
