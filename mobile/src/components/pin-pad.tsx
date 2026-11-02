import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../theme/typography';
import Animated from 'react-native-reanimated';
import { Symbol } from './symbol';
import { PressScale, useShake } from '../motion';
import { TOUCH } from './ui';
import { useThemed, type Theme } from '../theme/theme';

interface Props {
  title: string;
  subtitle?: string;
  error?: string | null;
  /** Change this each time a wrong code is entered, so the shake plays even when the message is unchanged. */
  errorTick?: number;
  onComplete: (pin: string) => void;
}

/** 4-digit keypad. Every key is at least 44pt. */
export function PinPad({ title, subtitle, error, errorTick = 0, onComplete }: Props) {
  const { colors, styles } = useThemed(makeStyles);
  const [pin, setPin] = useState('');
  const shake = useShake();

  // A wrong code shakes the dots row. The entry is cleared when the code is submitted.
  useEffect(() => {
    if (error) shake.shake();
  }, [error, errorTick]);  // eslint-disable-line react-hooks/exhaustive-deps

  const press = (key: string) => {
    if (key === 'back') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    const next = pin + key;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        onComplete(next);
        setPin('');
      }, 120);
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { fontFamily: colors.heading }]} accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      <Animated.View style={[styles.dots, shake.style]} accessibilityLabel={`${pin.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.dot, i < pin.length && styles.dotOn]} />
        ))}
      </Animated.View>
      <Text style={styles.error}>{error ?? ' '}</Text>
      <View style={styles.grid}>
        {keys.map((k, i) =>
          k === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <PressScale
              key={i}
              accessibilityRole="button"
              accessibilityLabel={k === 'back' ? 'Delete' : k}
              onPress={() => press(k)}
              style={styles.key}
            >
              {k === 'back' ? (
                <Symbol name="delete.left" size={26} color={colors.label} weight="regular" />
              ) : (
                <Text style={styles.keyText}>{k}</Text>
              )}
            </PressScale>
          ),
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  title: { fontSize: colors.fs(24), fontWeight: '700', color: colors.label, textAlign: 'center' },
  sub: { fontSize: colors.fs(15), color: colors.muted, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 16, marginTop: 8 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.muted },
  dotOn: { backgroundColor: colors.tintFill, borderColor: colors.tint },
  error: { color: colors.destructive, fontSize: colors.fs(14), minHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 280, justifyContent: 'space-between', rowGap: 14 },
  key: { width: 80, height: Math.max(80, TOUCH), borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  keyText: { fontSize: colors.fs(28), fontWeight: '500', color: colors.label },
});
