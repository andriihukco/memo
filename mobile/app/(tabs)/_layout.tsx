import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Tabs, router, usePathname } from 'expo-router';
import { GlassTabBar } from '../../src/components/glass-tab-bar';
import { startLiveTranscription } from '../../src/lib/speech';
import { useThemed, type Palette } from '../../src/theme/theme';

/** Tabs whose + records a voice entry on hold. Other tabs have no hold action. */
const VOICE_TABS = ['/'];

export default function TabsLayout() {
  const { colors, styles } = useThemed(makeStyles);
  const pathname = usePathname();
  const voice = VOICE_TABS.includes(pathname);
  // null = idle; otherwise the live transcript shown in the overlay.
  const [recording, setRecording] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const committed = useRef('');
  const partial = useRef('');

  const holdStart = async () => {
    committed.current = '';
    partial.current = '';
    setRecording('');
    const stop = await startLiveTranscription('en-US', {
      onPartial: (text) => {
        partial.current = text;
        setRecording(`${committed.current} ${text}`.trim());
      },
      onFinal: (text) => {
        committed.current = `${committed.current} ${text}`.trim();
        partial.current = '';
        setRecording(committed.current);
      },
      onError: (message) => {
        setRecording(null);
        Alert.alert('Voice', message);
      },
      onEnd: () => undefined,
    });
    if (!stop) {
      setRecording(null);
      Alert.alert('Voice needs a development build', 'Expo Go cannot run on-device speech. Tap + to type instead.');
      return;
    }
    stopRef.current = stop;
  };

  const holdEnd = () => {
    if (!stopRef.current) return;
    stopRef.current();
    stopRef.current = null;
    const text = `${committed.current} ${partial.current}`.trim();
    setRecording(null);
    if (text) router.push({ pathname: '/compose', params: { text } });
  };

  /** + opens the sheet for the page you are on: entry, widget or retrospective. */
  const compose = () => {
    if (pathname === '/insights') router.push('/insights/new');
    else router.push('/compose');
  };

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
        tabBar={({ state }) => (
          <GlassTabBar
            routes={state.routes}
            activeIndex={state.index}
            onSelect={(route) => router.navigate(route.name === 'index' ? '/' : `/${route.name}`)}
            onCompose={compose}
            onHoldStart={voice ? () => void holdStart() : undefined}
            onHoldEnd={voice ? holdEnd : undefined}
          />
        )}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="insights" />
        <Tabs.Screen name="you" />
      </Tabs>
      {recording !== null ? (
        <View style={styles.overlay} pointerEvents="none" accessibilityLiveRegion="polite">
          <View style={styles.dot} />
          <Text style={styles.text} numberOfLines={3}>
            {recording || 'Listening…'}
          </Text>
        </View>
      ) : null}
    </>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(19,23,34,0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.destructive },
  text: { flex: 1, color: colors.label, fontSize: 16 },
});
