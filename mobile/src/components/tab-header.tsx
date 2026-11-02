import { StyleSheet, View } from 'react-native';
import { Text } from '../theme/typography';
import { router } from 'expo-router';
import { t } from '../i18n';
import { useSession } from '../lib/session';
import { Symbol } from './symbol';
import { TOUCH } from './ui';
import { PressScale } from '../motion';
import { useThemed, type Theme } from '../theme/theme';

/**
 * Title row for the bottom tabs. The profile button on the right opens Settings on every tab.
 * Signed in, it shows the account's first letter; signed out, a person icon.
 */
export function TabHeader({ title }: { title: string }) {
  const { colors, styles } = useThemed(makeStyles);
  const { account } = useSession();
  const initial = account?.email?.trim().charAt(0).toUpperCase();

  return (
    <View style={styles.row}>
      <Text style={[styles.title, { fontFamily: colors.heading }]} accessibilityRole="header">{title}</Text>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={t('settings.title')}
        onPress={() => router.push('/settings')}
        style={styles.profile}
      >
        {initial ? (
          <Text style={styles.initial}>{initial}</Text>
        ) : (
          <Symbol name="person.crop.circle" size={26} color={colors.tint} />
        )}
      </PressScale>
    </View>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  title: { fontSize: colors.fs(34), fontWeight: '700', color: colors.label },
  profile: { minWidth: TOUCH, minHeight: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  initial: { fontSize: colors.fs(17), fontWeight: '700', color: colors.tint },
});
