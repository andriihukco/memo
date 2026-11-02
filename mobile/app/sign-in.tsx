import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../src/theme/typography';
import { router } from 'expo-router';
import { t } from '../src/i18n';
import { useSession } from '../src/lib/session';
import { PrimaryButton, TOUCH } from '../src/components/ui';
import { THEME_CHOICES, type ThemeChoice } from '../src/theme/palettes';
import { useTheme, useThemed, type Theme } from '../src/theme/theme';
import { ScreenEnter } from '../src/motion';

/**
 * Sign in to the same account as the web app: an emailed code (default), a password,
 * Google, Telegram, or start without an account. Also sets the theme.
 */
export default function SignInScreen() {
  return (
    <ScreenEnter>
      <SignInScreenBody />
    </ScreenEnter>
  );
}

function SignInScreenBody() {
  const { colors, styles } = useThemed(makeStyles);
  const { signIn, sendEmailCode, verifyEmailCode, signInWithGoogle, signInWithTelegram, signInAnonymously, error } = useSession();
  const { choice, setChoice } = useTheme();
  const themeLabel: Record<ThemeChoice, string> = {
    system: t('miniapp.settings.appearance.system'),
    light: t('miniapp.settings.appearance.light'),
    dark: t('miniapp.settings.appearance.dark'),
  };
  const [mode, setMode] = useState<'code' | 'password'>('code');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const finish = (ok: boolean) => {
    if (ok) router.back();
  };

  const run = async (action: () => Promise<boolean>) => {
    if (busy) return;
    setBusy(true);
    const ok = await action();
    setBusy(false);
    finish(ok);
  };

  const sendCode = async () => {
    if (!email.trim() || busy) return;
    setBusy(true);
    const ok = await sendEmailCode(email);
    setBusy(false);
    if (ok) setCodeSent(true);
  };

  const passwordReady = email.trim() !== '' && password !== '';
  const codeReady = codeSent && code.trim().length >= 6;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('miniapp.common.cancel')} onPress={() => router.back()} style={styles.headerButton}>
          <Text style={styles.cancel}>{t('miniapp.common.cancel')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('signin.title')}</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <TextInput
          accessibilityLabel={t('signin.email')}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder={t('signin.email')}
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setCodeSent(false);
          }}
          editable={!codeSent || mode === 'password'}
          style={styles.input}
        />

        {mode === 'code' ? (
          <>
            {codeSent ? (
              <>
                <Text style={styles.hint}>{t('signin.sent', { email: email.trim() })}</Text>
                <TextInput
                  accessibilityLabel={t('signin.code')}
                  autoComplete="one-time-code"
                  keyboardType="number-pad"
                  placeholder={t('signin.code')}
                  placeholderTextColor={colors.muted}
                  value={code}
                  onChangeText={setCode}
                  onSubmitEditing={() => void run(() => verifyEmailCode(email, code))}
                  style={styles.input}
                />
                <PrimaryButton label={t('signin.verify')} onPress={() => void run(() => verifyEmailCode(email, code))} disabled={!codeReady || busy} />
              </>
            ) : (
              <PrimaryButton label={t('signin.send_code')} onPress={() => void sendCode()} disabled={!email.trim() || busy} />
            )}
          </>
        ) : (
          <>
            <TextInput
              accessibilityLabel={t('signin.password')}
              secureTextEntry
              autoComplete="password"
              placeholder={t('signin.password')}
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => void run(() => signIn(email, password))}
              style={styles.input}
            />
            <PrimaryButton label={t('signin.title')} onPress={() => void run(() => signIn(email, password))} disabled={!passwordReady || busy} />
          </>
        )}

        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

        <Text style={styles.or}>{t('signin.or')}</Text>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void run(signInWithGoogle)}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.secondaryText}>{t('signin.google')}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void run(signInWithTelegram)}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.secondaryText}>{t('signin.telegram')}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void run(signInAnonymously)}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.secondaryText}>{t('signin.anonymous')}</Text>
        </Pressable>

        <Text style={styles.or}>{t('signin.theme')}</Text>
        <View style={styles.themeRow} accessibilityRole="radiogroup">
          {THEME_CHOICES.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityState={{ checked: choice === c }}
              onPress={() => setChoice(c)}
              style={[styles.themeChip, choice === c && styles.themeChipOn]}
            >
              <Text style={[styles.themeText, choice === c && styles.themeTextOn]}>{themeLabel[c]}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMode(mode === 'code' ? 'password' : 'code');
            setCodeSent(false);
          }}
          style={styles.textAction}
        >
          <Text style={styles.link}>{mode === 'code' ? t('signin.use_password') : t('signin.use_code')}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  themeRow: { flexDirection: 'row', gap: 8 },
  themeChip: { flex: 1, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.card },
  themeChipOn: { backgroundColor: colors.tintFill },
  themeText: { fontSize: colors.fs(15), color: colors.muted, fontWeight: '500' },
  themeTextOn: { color: colors.onTint, fontWeight: '600' },
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerButton: { minWidth: TOUCH, minHeight: TOUCH, justifyContent: 'center' },
  cancel: { fontSize: colors.fs(17), color: colors.tint },
  title: { fontSize: colors.fs(17), fontWeight: '600', color: colors.label },
  form: { padding: 16, gap: 12, marginTop: 24 },
  input: { minHeight: TOUCH + 4, borderRadius: 14, backgroundColor: colors.card, color: colors.label, paddingHorizontal: 16, fontSize: colors.fs(17) },
  hint: { fontSize: colors.fs(14), color: colors.muted, textAlign: 'center' },
  error: { color: colors.destructive, fontSize: colors.fs(14), textAlign: 'center' },
  or: { fontSize: colors.fs(14), color: colors.muted, textAlign: 'center', marginVertical: 4 },
  secondary: { minHeight: TOUCH + 4, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: colors.fs(17), color: colors.label, fontWeight: '600' },
  textAction: { minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' },
  link: { fontSize: colors.fs(16), color: colors.tint },
});
