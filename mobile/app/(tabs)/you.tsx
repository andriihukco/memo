import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { t } from '../../src/i18n';
import { useSession } from '../../src/lib/session';
import { hasPin } from '../../src/lib/app-state';
import { useEffect, useState } from 'react';
import { TOUCH } from '../../src/components/ui';
import { Symbol } from '../../src/components/symbol';
import { THEME_CHOICES } from '../../src/theme/palettes';
import { useTheme, useThemed, type Palette } from '../../src/theme/theme';

type Icon = string;

interface Item {
  icon: Icon;
  title: string;
  sub?: string;
  badge?: string;
  destructive?: boolean;
  selected?: boolean;
  onPress?: () => void;
}

/** You tab: settings sections and copy, as on web's /miniapp/you. */
export default function YouScreen() {
  const { colors, styles } = useThemed(makeStyles);
  const { choice, setChoice } = useTheme();
  const { live, signOut } = useSession();
  const [pinSet, setPinSet] = useState(false);

  useEffect(() => {
    void hasPin().then(setPinSet);
  }, []);

  const appearanceLabel: Record<(typeof THEME_CHOICES)[number], string> = {
    system: t('miniapp.settings.appearance.system'),
    light: t('miniapp.settings.appearance.light'),
    dark: t('miniapp.settings.appearance.dark'),
  };
  const sections: { title: string; items: Item[] }[] = [
    {
      title: t('miniapp.settings.appearance'),
      items: THEME_CHOICES.map((c) => ({
        icon: 'circle.lefthalf.filled',
        title: appearanceLabel[c],
        selected: choice === c,
        onPress: () => setChoice(c),
      })),
    },
    {
      title: t('miniapp.settings.invite'),
      items: [{ icon: 'gift.fill', title: t('miniapp.settings.invite_friend'), sub: t('miniapp.settings.invite_friend_desc') }],
    },
    {
      title: t('miniapp.settings.privacy'),
      items: pinSet
        ? [
            { icon: 'lock.fill', title: t('miniapp.settings.disable_passcode'), sub: t('miniapp.settings.disable_passcode_desc'), destructive: true, onPress: () => router.push('/passcode?mode=disable') },
            { icon: 'key.fill', title: t('miniapp.settings.change_passcode'), sub: t('miniapp.settings.change_passcode_desc'), onPress: () => router.push('/passcode?mode=change') },
          ]
        : [{ icon: 'lock.open.fill', title: t('miniapp.settings.enable_passcode'), sub: t('miniapp.settings.enable_passcode_desc'), onPress: () => router.push('/passcode?mode=enable') }],
    },
    {
      title: t('miniapp.settings.categories_section'),
      items: [{ icon: 'tag.fill', title: t('miniapp.settings.categories_manage'), sub: t('miniapp.settings.categories_manage_desc'), onPress: () => router.push('/you/categories') }],
    },
    {
      title: t('miniapp.settings.account'),
      items: [
        { icon: 'square.and.arrow.down', title: t('miniapp.settings.export_data'), sub: t('miniapp.settings.export_data_desc') },
        ...(live ? [{ icon: 'rectangle.portrait.and.arrow.right', title: 'Sign out', destructive: true, onPress: () => void signOut() } as Item] : [{ icon: 'person.crop.circle', title: 'Sign in', onPress: () => router.push('/sign-in') } as Item]),
        { icon: 'trash.fill', title: t('miniapp.settings.delete_account'), sub: t('miniapp.settings.delete_account_desc'), destructive: true, onPress: () => Alert.alert(t('miniapp.settings.delete_account'), t('miniapp.feed.delete.irreversible')) },
        { icon: 'info.circle', title: t('miniapp.settings.version'), badge: '1.0.0' },
      ],
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Text style={styles.title} accessibilityRole="header">{t('shell.you')}</Text>

      {sections.map((section) => (
        <View key={section.title}>
          <Text style={styles.section}>{section.title}</Text>
          <View style={styles.card}>
            {section.items.map((item, i) => (
              <Pressable
                key={item.title}
                accessibilityRole="button"
                onPress={item.onPress}
                style={({ pressed }) => [styles.row, i > 0 && styles.border, pressed && { opacity: 0.6 }]}
              >
                <Symbol name={item.icon} size={20} color={item.destructive ? colors.destructive : colors.tint} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, item.destructive && { color: colors.destructive }]}>{item.title}</Text>
                  {item.sub ? <Text style={styles.rowSub}>{item.sub}</Text> : null}
                </View>
                {item.badge ? <Text style={styles.badge}>{item.badge}</Text> : item.selected ? <Symbol name="checkmark" size={16} color={colors.tint} weight="semibold" /> : item.onPress ? <Symbol name="chevron.right" size={14} color={colors.muted} weight="semibold" /> : null}
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  content: { padding: 16, paddingTop: 8, paddingBottom: 40 },
  title: { fontSize: 34, fontWeight: '700', color: colors.label },
  section: { fontSize: 12, letterSpacing: 1, color: colors.muted, textTransform: 'uppercase', paddingHorizontal: 4, paddingTop: 22, paddingBottom: 8 },
  card: { borderRadius: 16, backgroundColor: colors.card, overflow: 'hidden' },
  row: { minHeight: TOUCH + 6, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  icon: {},
  rowTitle: { fontSize: 16, color: colors.label },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  badge: { fontSize: 12, color: colors.destructive, backgroundColor: 'rgba(248,113,113,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
});
