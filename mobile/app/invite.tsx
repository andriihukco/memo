import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { Text } from '../src/theme/typography';
import { router } from 'expo-router';
import { t } from '../src/i18n';
import { api } from '../src/lib/api';
import { useSession } from '../src/lib/session';
import { PrimaryButton, TOUCH } from '../src/components/ui';
import { Symbol } from '../src/components/symbol';
import { useThemed, type Theme } from '../src/theme/theme';
import { ScreenEnter } from '../src/motion';

/** Invite a friend: the Telegram referral link, shared through the system share sheet. */
export default function InviteScreen() {
  return (
    <ScreenEnter>
      <InviteScreenBody />
    </ScreenEnter>
  );
}

function InviteScreenBody() {
  const { colors, styles } = useThemed(makeStyles);
  const { token, live } = useSession();
  const [link, setLink] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!live || !token) return;
    let active = true;
    api
      .getReferral(token)
      .then(({ link: url }) => active && setLink(url))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [live, token]);

  const share = () => {
    if (!link) return;
    void Share.share({ message: `${t('invite.message')} ${link}` }).catch(() => {});
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('miniapp.common.cancel')} onPress={() => router.back()} style={styles.headerButton}>
          <Text style={styles.cancel}>{t('miniapp.common.cancel')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('miniapp.invite.title')}</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.body}>
        <Symbol name="gift.fill" size={72} color={colors.tint} weight="medium" />
        <Text style={styles.sub}>{t('miniapp.settings.invite_friend_desc')}</Text>

        {!live ? (
          <PrimaryButton label={t('signin.title')} onPress={() => router.push('/sign-in')} />
        ) : failed ? (
          <Text style={styles.error} accessibilityRole="alert">{t('miniapp.invite.link_error')}</Text>
        ) : (
          <>
            <Text selectable style={styles.link}>{link ?? t('goals.loading')}</Text>
            <PrimaryButton label={t('miniapp.invite.share')} onPress={share} disabled={!link} />
          </>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerButton: { minWidth: TOUCH, minHeight: TOUCH, justifyContent: 'center' },
  cancel: { fontSize: colors.fs(17), color: colors.tint },
  title: { fontSize: colors.fs(17), fontWeight: '600', color: colors.label },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 },
  sub: { fontSize: colors.fs(17), color: colors.muted, textAlign: 'center' },
  link: { fontSize: colors.fs(15), color: colors.label, textAlign: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 14, overflow: 'hidden' },
  error: { fontSize: colors.fs(15), color: colors.destructive, textAlign: 'center' },
});
