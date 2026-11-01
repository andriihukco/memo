import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../src/lib/session';
import { EntryStoreProvider } from '../src/lib/entry-store';
import { hasPin, isOnboarded } from '../src/lib/app-state';
import { colors } from '../src/components/ui';
import { Onboarding } from '../src/components/onboarding';
import { LockScreen } from '../src/components/lock-screen';

const screen = { headerShown: false, animation: 'slide_from_right' as const };
const sheet = (detent: number) => ({
  headerShown: false,
  contentStyle: { backgroundColor: colors.bg },
  presentation: 'formSheet' as const,
  sheetAllowedDetents: [detent],
  sheetGrabberVisible: true,
});

export default function RootLayout() {
  const [gate, setGate] = useState<'loading' | 'onboarding' | 'locked' | 'ready'>('loading');

  useEffect(() => {
    void (async () => {
      if (!(await isOnboarded())) return setGate('onboarding');
      setGate((await hasPin()) ? 'locked' : 'ready');
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <EntryStoreProvider>
          {gate === 'loading' ? (
            <View style={{ flex: 1, backgroundColor: colors.bg }} />
          ) : gate === 'onboarding' ? (
            <Onboarding onDone={() => setGate('ready')} />
          ) : gate === 'locked' ? (
            <LockScreen onUnlock={() => setGate('ready')} />
          ) : gate === 'ready' ? (
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="passcode" options={screen} />
              <Stack.Screen name="entry/[id]" options={screen} />
              <Stack.Screen name="insights/report/[id]" options={screen} />
              <Stack.Screen name="you/categories" options={screen} />
              <Stack.Screen name="sign-in" options={sheet(0.5)} />
              <Stack.Screen name="compose" options={sheet(0.92)} />
              <Stack.Screen name="widgets/new" options={sheet(0.92)} />
              <Stack.Screen name="insights/new" options={sheet(0.6)} />
            </Stack>
          ) : null}
        </EntryStoreProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
