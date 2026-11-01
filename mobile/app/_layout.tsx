import { useEffect, useMemo, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../src/lib/session';
import { EntryStoreProvider } from '../src/lib/entry-store';
import { GateContext } from '../src/lib/gate';
import { ServerLanguageSync } from '../src/lib/locale-sync';
import { clearAppState, getLockTimer, getStoredLocale, hasPin, isOnboarded } from '../src/lib/app-state';
import { setLocale, useLocale, isLocale } from '../src/i18n';
import { Onboarding } from '../src/components/onboarding';
import { LockScreen } from '../src/components/lock-screen';
import { ThemeProvider, useTheme } from '../src/theme/theme';

type Gate = 'loading' | 'onboarding' | 'locked' | 'ready';

const screen = { headerShown: false, animation: 'slide_from_right' as const };
const sheet = (background: string, detent: number) => ({
  headerShown: false,
  contentStyle: { backgroundColor: background },
  presentation: 'formSheet' as const,
  sheetAllowedDetents: [detent],
  sheetGrabberVisible: true,
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootGate />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootGate() {
  const { palette, scheme } = useTheme();
  const locale = useLocale();
  const [gate, setGate] = useState<Gate>('loading');
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    void (async () => {
      const stored = await getStoredLocale();
      if (isLocale(stored)) setLocale(stored);
      if (!(await isOnboarded())) return setGate('onboarding');
      setGate((await hasPin()) ? 'locked' : 'ready');
    })();
  }, []);

  // Auto-lock: once the app has been in the background longer than the chosen timer.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (state !== 'active' || backgroundedAt.current === null) return;
      const awayMs = Date.now() - backgroundedAt.current;
      backgroundedAt.current = null;
      void (async () => {
        if (!(await hasPin())) return;
        if (awayMs >= (await getLockTimer()) * 60_000) setGate('locked');
      })();
    });
    return () => sub.remove();
  }, []);

  const gateValue = useMemo(
    () => ({
      resetToOnboarding: () => {
        void clearAppState().then(() => setGate('onboarding'));
      },
    }),
    [],
  );

  return (
    <SessionProvider>
      <EntryStoreProvider>
        <ServerLanguageSync />
        <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
        {gate === 'loading' ? (
          <View style={{ flex: 1, backgroundColor: palette.bg }} />
        ) : gate === 'onboarding' ? (
          <Onboarding onDone={() => setGate('ready')} />
        ) : gate === 'locked' ? (
          <LockScreen onUnlock={() => setGate('ready')} />
        ) : (
          <GateContext.Provider value={gateValue}>
            {/* Keyed by language: every screen re-reads its strings after a change. */}
            <Stack
              key={locale}
              screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="passcode" options={screen} />
              <Stack.Screen name="entry/[id]" options={screen} />
              <Stack.Screen name="insights/report/[id]" options={screen} />
              <Stack.Screen name="you/categories" options={screen} />
              <Stack.Screen name="goals" options={screen} />
              <Stack.Screen name="sign-in" options={sheet(palette.bg, 0.92)} />
              <Stack.Screen name="invite" options={sheet(palette.bg, 0.6)} />
              <Stack.Screen name="compose" options={sheet(palette.bg, 0.92)} />
              <Stack.Screen name="widgets/new" options={sheet(palette.bg, 0.92)} />
              <Stack.Screen name="insights/new" options={sheet(palette.bg, 0.6)} />
            </Stack>
          </GateContext.Provider>
        )}
      </EntryStoreProvider>
    </SessionProvider>
  );
}
