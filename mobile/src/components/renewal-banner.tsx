import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../i18n';
import { useSession } from '../lib/session';
import { colors, TOUCH } from './ui';

/**
 * Subscription notice above the tab bar, as in the Mini App.
 * Billing is not wired yet, so it only shows in demo mode (signed out).
 * Renew does nothing yet: the Telegram Stars flow was removed from the app.
 */
export function RenewalBanner() {
  const { live } = useSession();
  const [dismissed, setDismissed] = useState(false);
  if (live || dismissed) return null;

  return (
    <View style={styles.bar} accessibilityRole="alert">
      <Text style={styles.text}>{t('miniapp.layout.renewal_banner')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('miniapp.layout.renewal_renew')} style={styles.renew} onPress={() => undefined}>
        <Text style={styles.renewText}>{t('miniapp.layout.renewal_renew')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('miniapp.common.cancel')} onPress={() => setDismissed(true)} style={styles.close}>
        <Ionicons name="close" size={18} color={colors.gold} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(74,44,8,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(250,204,21,0.35)',
  },
  text: { flex: 1, color: '#FDE68A', fontSize: 14 },
  renew: { minHeight: TOUCH - 4, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.gold, justifyContent: 'center' },
  renewText: { color: '#1C1917', fontWeight: '600', fontSize: 15 },
  close: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
});
