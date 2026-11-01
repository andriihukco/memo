import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { LOCALES, getLocale, setLocale, t, useLocale } from '../../src/i18n';
import { useSession } from '../../src/lib/session';
import { api } from '../../src/lib/api';
import { useGate } from '../../src/lib/gate';
import {
  LOCK_TIMERS,
  getLockTimer,
  hasPin,
  setLockTimer,
  storeLocale,
  type LockTimer,
} from '../../src/lib/app-state';
import { TOUCH } from '../../src/components/ui';
import { Symbol } from '../../src/components/symbol';
import { Onboarding } from '../../src/components/onboarding';
import { THEME_CHOICES } from '../../src/theme/palettes';
import { HEADING_FONTS, TEXT_SCALES, useTheme, useThemed, type Theme } from '../../src/theme/theme';

interface Item {
  icon: string;
  title: string;
  sub?: string;
  badge?: string;
  destructive?: boolean;
  selected?: boolean;
  /** Set when the row opens a sub-list (for example auto-lock). */
  expanded?: boolean;
  onPress?: () => void;
}

const LOCK_TIMER_KEYS: Record<LockTimer, string> = {
  0: 'lock.now',
  1: 'lock.1',
  5: 'lock.5',
  15: 'lock.15',
  60: 'lock.60',
};

const TELEGRAM_SUPPORT = 'https://t.me/get_memo_help';
const TELEGRAM_UPDATES = 'https://t.me/get_memo_updates';

/** You tab: the same sections as the Mini App's settings, in the same order. */
export default function YouScreen() {
  const { colors, styles } = useThemed(makeStyles);
  const { choice, setChoice, textScale, setTextScale, headingFont, setHeadingFont } = useTheme();
  const { token, live, signOut } = useSession();
  const gate = useGate();
  const locale = useLocale();
  const [pinSet, setPinSet] = useState(false);
  const [lockTimer, setLockTimerState] = useState<LockTimer>(0);
  const [timerOpen, setTimerOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    void hasPin().then(setPinSet);
    void getLockTimer().then(setLockTimerState);
  }, []);

  const chooseLanguage = (code: (typeof LOCALES)[number]['code']) => {
    if (code === getLocale()) return;
    setLocale(code);
    void storeLocale(code);
    // The account keeps its language too, so the bot and the Mini App match.
    if (live && token) void api.setLanguage(token, code).catch(() => {});
  };

  const chooseLockTimer = (minutes: LockTimer) => {
    setLockTimerState(minutes);
    setTimerOpen(false);
    void setLockTimer(minutes);
  };

  const exportData = () => {
    if (!token) return;
    Alert.alert(t('miniapp.settings.export_data'), t('miniapp.export.send_via_bot_desc'), [
      { text: t('miniapp.common.cancel'), style: 'cancel' },
      {
        text: t('export.send'),
        onPress: () =>
          void api
            .sendExport(token)
            .then(() => Alert.alert(t('export.sent')))
            .catch(() => Alert.alert(t('error.generic'))),
      },
    ]);
  };

  const deleteAccount = () => {
    if (!token) return;
    Alert.alert(t('miniapp.settings.delete_account'), `${t('miniapp.delete.desc')}\n\n${t('miniapp.feed.delete.irreversible')}`, [
      { text: t('miniapp.common.cancel'), style: 'cancel' },
      {
        text: t('miniapp.settings.delete_account'),
        style: 'destructive',
        onPress: () =>
          void api
            .deleteAccount(token)
            .then(async () => {
              await signOut();
              gate.resetToOnboarding();
            })
            .catch(() => Alert.alert(t('error.generic'))),
      },
    ]);
  };

  const appearanceLabel: Record<(typeof THEME_CHOICES)[number], string> = {
    system: t('miniapp.settings.appearance.system'),
    light: t('miniapp.settings.appearance.light'),
    dark: t('miniapp.settings.appearance.dark'),
  };

  const passcodeItems: Item[] = pinSet
    ? [
        { icon: 'lock.fill', title: t('miniapp.settings.disable_passcode'), sub: t('miniapp.settings.disable_passcode_desc'), destructive: true, onPress: () => router.push('/passcode?mode=disable') },
        { icon: 'key.fill', title: t('miniapp.settings.change_passcode'), sub: t('miniapp.settings.change_passcode_desc'), onPress: () => router.push('/passcode?mode=change') },
        {
          icon: 'timer',
          title: t('miniapp.settings.lock_timer'),
          badge: t(LOCK_TIMER_KEYS[lockTimer]),
          expanded: timerOpen,
          onPress: () => setTimerOpen((open) => !open),
        },
        ...(timerOpen
          ? LOCK_TIMERS.map((minutes): Item => ({
              icon: 'circle',
              title: t(LOCK_TIMER_KEYS[minutes]),
              selected: lockTimer === minutes,
              onPress: () => chooseLockTimer(minutes),
            }))
          : []),
      ]
    : [{ icon: 'lock.open.fill', title: t('miniapp.settings.enable_passcode'), sub: t('miniapp.settings.enable_passcode_desc'), onPress: () => router.push('/passcode?mode=enable') }];

  const accountItems: Item[] = live
    ? [
        { icon: 'square.and.arrow.down', title: t('miniapp.settings.export_data'), sub: t('miniapp.settings.export_data_desc'), onPress: exportData },
        { icon: 'rectangle.portrait.and.arrow.right', title: t('settings.sign_out'), destructive: true, onPress: () => void signOut() },
        { icon: 'trash.fill', title: t('miniapp.settings.delete_account'), sub: t('miniapp.settings.delete_account_desc'), destructive: true, onPress: deleteAccount },
      ]
    : [{ icon: 'person.crop.circle', title: t('signin.title'), onPress: () => router.push('/sign-in') }];

  // Sections in the same order as the Mini App's settings page.
  const sections: { key: string; title: string; items: Item[] }[] = [
    {
      key: 'language',
      title: t('miniapp.settings.language'),
      items: LOCALES.map((l) => ({
        icon: 'globe',
        title: l.nativeName,
        selected: locale === l.code,
        onPress: () => chooseLanguage(l.code),
      })),
    },
    {
      key: 'appearance',
      title: t('miniapp.settings.appearance'),
      items: THEME_CHOICES.map((c) => ({
        icon: 'circle.lefthalf.filled',
        title: appearanceLabel[c],
        selected: choice === c,
        onPress: () => setChoice(c),
      })),
    },
    {
      key: 'text',
      title: t('miniapp.settings.appearance.text_size'),
      items: TEXT_SCALES.map((k) => ({
        icon: 'textformat.size',
        title: t(`miniapp.settings.appearance.text_${k}`),
        selected: textScale === k,
        onPress: () => setTextScale(k),
      })),
    },
    {
      key: 'font',
      title: t('miniapp.settings.appearance.font'),
      items: HEADING_FONTS.map((k) => ({
        icon: 'textformat',
        title: t(`miniapp.settings.appearance.font_${k}`),
        selected: headingFont === k,
        onPress: () => setHeadingFont(k),
      })),
    },
    {
      key: 'invite',
      title: t('miniapp.settings.invite'),
      items: [{ icon: 'gift.fill', title: t('miniapp.settings.invite_friend'), sub: t('miniapp.settings.invite_friend_desc'), onPress: () => router.push('/invite') }],
    },
    {
      key: 'goals',
      title: t('goals.title'),
      items: [{ icon: 'target', title: t('goals.title'), sub: t('insights.goals'), onPress: () => router.push('/goals') }],
    },
    {
      key: 'privacy',
      title: t('miniapp.settings.privacy'),
      items: passcodeItems,
    },
    {
      key: 'categories',
      title: t('miniapp.settings.categories_section'),
      items: [{ icon: 'tag.fill', title: t('miniapp.settings.categories_manage'), sub: t('miniapp.settings.categories_manage_desc'), onPress: () => router.push('/you/categories') }],
    },
    {
      key: 'support',
      title: t('miniapp.settings.support'),
      items: [
        { icon: 'bubble.left.fill', title: t('miniapp.settings.support_chat'), onPress: () => void Linking.openURL(TELEGRAM_SUPPORT) },
        { icon: 'megaphone.fill', title: t('miniapp.settings.updates_channel'), sub: t('miniapp.settings.updates_channel_desc'), onPress: () => void Linking.openURL(TELEGRAM_UPDATES) },
      ],
    },
    {
      key: 'about',
      title: t('miniapp.settings.about'),
      items: [
        { icon: 'questionmark.circle', title: t('miniapp.settings.how_to_use'), sub: t('miniapp.settings.how_to_use_desc'), onPress: () => setTourOpen(true) },
        { icon: 'info.circle', title: t('miniapp.settings.version'), badge: '1.0.0' },
      ],
    },
    {
      key: 'account',
      title: t('miniapp.settings.account'),
      items: accountItems,
    },
  ];

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <Text style={[styles.title, { fontFamily: colors.heading }]} accessibilityRole="header">{t('shell.you')}</Text>

        {sections.map((section) => (
          <View key={section.key}>
            <Text style={styles.section}>{section.title}</Text>
            <View style={styles.card}>
              {section.items.map((item, i) => (
                <Pressable
                  key={`${section.key}-${i}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !!item.selected, expanded: item.expanded }}
                  onPress={item.onPress}
                  style={({ pressed }) => [styles.row, i > 0 && styles.border, pressed && { opacity: 0.6 }]}
                >
                  <Symbol name={item.icon} size={20} color={item.destructive ? colors.destructive : colors.tint} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, item.destructive && { color: colors.destructive }]}>{item.title}</Text>
                    {item.sub ? <Text style={styles.rowSub}>{item.sub}</Text> : null}
                  </View>
                  {item.badge ? (
                    <Text style={styles.badge}>{item.badge}</Text>
                  ) : item.selected ? (
                    <Symbol name="checkmark" size={16} color={colors.tint} weight="semibold" />
                  ) : item.onPress ? (
                    <Symbol name="chevron.right" size={14} color={colors.muted} weight="semibold" />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={tourOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTourOpen(false)}>
        <Onboarding tour onDone={() => setTourOpen(false)} />
      </Modal>
    </>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  content: { padding: 16, paddingTop: 8, paddingBottom: 40 },
  title: { fontSize: colors.fs(34), fontWeight: '700', color: colors.label },
  section: { fontSize: colors.fs(12), letterSpacing: 1, color: colors.muted, textTransform: 'uppercase', paddingHorizontal: 4, paddingTop: 22, paddingBottom: 8 },
  card: { borderRadius: 16, backgroundColor: colors.card, overflow: 'hidden' },
  row: { minHeight: TOUCH + 6, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  rowTitle: { fontSize: colors.fs(16), color: colors.label },
  rowSub: { fontSize: colors.fs(13), color: colors.muted, marginTop: 2 },
  badge: { fontSize: colors.fs(12), color: colors.destructive, backgroundColor: 'rgba(248,113,113,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
});
