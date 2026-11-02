import { useEffect, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../src/theme/typography';
import { router } from 'expo-router';
import { LOCALES, t, useLocale } from '../src/i18n';
import { useSession } from '../src/lib/session';
import { api } from '../src/lib/api';
import { useGate } from '../src/lib/gate';
import { LOCK_TIMERS, getLockTimer, hasPin, setLockTimer, type LockTimer } from '../src/lib/app-state';
import { TOUCH } from '../src/components/ui';
import { SettingsCard, SettingsSection, type SettingsItem } from '../src/components/settings-ui';
import { Onboarding } from '../src/components/onboarding';
import { useTheme, useThemed, type Theme } from '../src/theme/theme';
import { ScreenEnter, PressScale } from '../src/motion';
import { Symbol } from '../src/components/symbol';

const LOCK_TIMER_KEYS: Record<LockTimer, string> = {
  0: 'lock.now',
  1: 'lock.1',
  5: 'lock.5',
  15: 'lock.15',
  60: 'lock.60',
};

const TELEGRAM_SUPPORT = 'https://t.me/get_memo_help';
const TELEGRAM_UPDATES = 'https://t.me/get_memo_updates';

/**
 * Settings, opened from the profile button on every tab. Sign in is the first cell when signed out;
 * it becomes the profile card once signed in. Language and appearance have their own pages.
 */
export default function SettingsScreen() {
  return (
    <ScreenEnter>
      <SettingsScreenBody />
    </ScreenEnter>
  );
}

function SettingsScreenBody() {
  const { colors, styles } = useThemed(makeStyles);
  const { token, live, account, signOut } = useSession();
  const gate = useGate();
  const locale = useLocale();
  const { choice, textScale, font } = useTheme();
  const [pinSet, setPinSet] = useState(false);
  const [lockTimer, setLockTimerState] = useState<LockTimer>(0);
  const [timerOpen, setTimerOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    void hasPin().then(setPinSet);
    void getLockTimer().then(setLockTimerState);
  }, []);

  const currentLanguage = LOCALES.find((l) => l.code === locale)?.nativeName ?? '';
  const appearanceSub = [
    t(`miniapp.settings.appearance.${choice === 'light' ? 'light' : choice}`),
    t(`miniapp.settings.appearance.text_${textScale}`),
    t(`miniapp.settings.appearance.font_${font}`),
  ].join(' · ');

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

  const passcodeItems: SettingsItem[] = pinSet
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
          ? LOCK_TIMERS.map((minutes): SettingsItem => ({
              icon: 'circle',
              title: t(LOCK_TIMER_KEYS[minutes]),
              selected: lockTimer === minutes,
              onPress: () => chooseLockTimer(minutes),
            }))
          : []),
      ]
    : [{ icon: 'lock.open.fill', title: t('miniapp.settings.enable_passcode'), sub: t('miniapp.settings.enable_passcode_desc'), onPress: () => router.push('/passcode?mode=enable') }];

  const accountItems: SettingsItem[] = live
    ? [
        { icon: 'square.and.arrow.down', title: t('miniapp.settings.export_data'), sub: t('miniapp.settings.export_data_desc'), onPress: exportData },
        { icon: 'rectangle.portrait.and.arrow.right', title: t('settings.sign_out'), destructive: true, onPress: () => void signOut() },
        { icon: 'trash.fill', title: t('miniapp.settings.delete_account'), sub: t('miniapp.settings.delete_account_desc'), destructive: true, onPress: deleteAccount },
      ]
    : [];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('shell.back')} onPress={() => router.back()} style={styles.headerButton}>
          <Symbol name="chevron.backward" size={18} color={colors.tint} weight="semibold" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {/* Account first: Sign in when signed out, the profile card when signed in. */}
        <SettingsSection title={t('miniapp.settings.account')}>
          {live && account ? (
            <View style={styles.profile}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{account.email?.trim().charAt(0).toUpperCase() ?? '•'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {account.email ?? t('settings.profile_anon')}
                </Text>
                <Text style={styles.profileSub}>{account.anonymous ? t('settings.profile_anon') : t('settings.profile_sub')}</Text>
              </View>
            </View>
          ) : (
            <PressScale accessibilityRole="button" onPress={() => router.push('/sign-in')} style={styles.profile}>
              <View style={styles.avatar}>
                <Symbol name="person.crop.circle" size={26} color={colors.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{t('settings.guest')}</Text>
                <Text style={styles.profileSub}>{t('settings.guest_sub')}</Text>
              </View>
              <Symbol name="chevron.right" size={14} color={colors.muted} weight="semibold" />
            </PressScale>
          )}
        </SettingsSection>

        <SettingsSection title={t('miniapp.settings.appearance')}>
          <SettingsCard
            items={[
              { icon: 'globe', title: t('miniapp.settings.language'), sub: `${currentLanguage} · ${t('settings.language_sub')}`, onPress: () => router.push('/settings/language') },
              { icon: 'circle.lefthalf.filled', title: t('miniapp.settings.appearance'), sub: appearanceSub, onPress: () => router.push('/settings/appearance') },
            ]}
          />
        </SettingsSection>

        <SettingsSection title={t('miniapp.settings.privacy')}>
          <SettingsCard items={passcodeItems} />
        </SettingsSection>

        <SettingsSection title={t('miniapp.settings.categories_section')}>
          <SettingsCard items={[{ icon: 'tag.fill', title: t('miniapp.settings.categories_manage'), sub: t('miniapp.settings.categories_manage_desc'), onPress: () => router.push('/you/categories') }]} />
        </SettingsSection>

        <SettingsSection title={t('miniapp.settings.invite')}>
          <SettingsCard items={[{ icon: 'gift.fill', title: t('miniapp.settings.invite_friend'), sub: t('miniapp.settings.invite_friend_desc'), onPress: () => router.push('/invite') }]} />
        </SettingsSection>

        <SettingsSection title={t('miniapp.settings.support')}>
          <SettingsCard
            items={[
              { icon: 'bubble.left.fill', title: t('miniapp.settings.support_chat'), onPress: () => void Linking.openURL(TELEGRAM_SUPPORT) },
              { icon: 'megaphone.fill', title: t('miniapp.settings.updates_channel'), sub: t('miniapp.settings.updates_channel_desc'), onPress: () => void Linking.openURL(TELEGRAM_UPDATES) },
            ]}
          />
        </SettingsSection>

        <SettingsSection title={t('miniapp.settings.about')}>
          <SettingsCard
            items={[
              { icon: 'questionmark.circle', title: t('miniapp.settings.how_to_use'), sub: t('miniapp.settings.how_to_use_desc'), onPress: () => setTourOpen(true) },
              { icon: 'info.circle', title: t('miniapp.settings.version'), badge: '1.0.0' },
            ]}
          />
        </SettingsSection>

        {accountItems.length > 0 ? (
          <SettingsSection title={t('miniapp.settings.account')}>
            <SettingsCard items={accountItems} />
          </SettingsSection>
        ) : null}
      </ScrollView>

      <Modal visible={tourOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTourOpen(false)}>
        <Onboarding tour onDone={() => setTourOpen(false)} />
      </Modal>
    </View>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerButton: { minWidth: TOUCH, minHeight: TOUCH, justifyContent: 'center' },
  headerTitle: { fontSize: colors.fs(17), fontWeight: '600', color: colors.label },
  content: { padding: 16, paddingTop: 4, paddingBottom: 40 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: TOUCH + 22 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: colors.fs(18), fontWeight: '700', color: colors.tint },
  profileName: { fontSize: colors.fs(16), fontWeight: '600', color: colors.label },
  profileSub: { fontSize: colors.fs(13), color: colors.muted, marginTop: 2 },
});
