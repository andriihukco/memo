import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { t } from '../src/i18n';
import { useSession } from '../src/lib/session';
import { colors, PrimaryButton, TOUCH } from '../src/components/ui';

/** Email and password for your Memo account (the same login the web app uses). */
export default function SignInScreen() {
  const { signIn, error } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password || busy) return;
    setBusy(true);
    const ok = await signIn(email, password);
    setBusy(false);
    if (ok) router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('miniapp.common.cancel')} onPress={() => router.back()} style={styles.headerBtn}>
          <Text style={styles.cancel}>{t('miniapp.common.cancel')}</Text>
        </Pressable>
        <Text style={styles.title}>Sign in</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.form}>
        <TextInput
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          accessibilityLabel="Password"
          secureTextEntry
          autoComplete="password"
          placeholder="Password"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => void submit()}
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label={busy ? '…' : 'Sign in'} onPress={() => void submit()} disabled={!email || !password || busy} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerBtn: { minWidth: TOUCH, minHeight: TOUCH, justifyContent: 'center' },
  cancel: { fontSize: 17, color: colors.tint },
  title: { fontSize: 17, fontWeight: '600', color: colors.label },
  form: { padding: 16, gap: 12, marginTop: 24 },
  input: { minHeight: TOUCH + 4, borderRadius: 14, backgroundColor: colors.card, color: colors.label, paddingHorizontal: 16, fontSize: 17 },
  error: { color: colors.destructive, fontSize: 14, textAlign: 'center' },
});
