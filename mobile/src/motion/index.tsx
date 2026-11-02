import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from '../theme/typography';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

/**
 * Motion kit for the native app. Every value here matches the web site's motion (docs/design):
 * springs for taps and toggles, the base curve cubic-bezier(0.22, 1, 0.36, 1) for layout and
 * entrances, and no motion at all when the OS asks for reduced motion.
 */

export const springs = {
  /** Taps, tabs and toggles. Quick, no overshoot to speak of. */
  snappy: { damping: 20, stiffness: 260, mass: 0.9 },
  /** Sheets, cards and larger surfaces. */
  soft: { damping: 22, stiffness: 200 },
} as const;

/** Base curve from the landing skill (B7). */
export const base = Easing.bezier(0.22, 1, 0.36, 1);

export const durations = { quick: 200, medium: 360, slow: 520 } as const;

/** Haptics are a no-op where the device has no engine (web, simulators without a taptic engine). */
export const haptic = {
  tap: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  select: () => void Haptics.selectionAsync().catch(() => {}),
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};

export { useReducedMotion };

/** Animated press: the surface shrinks to 0.97 under the finger and springs back. */
export function PressScale({
  children,
  style,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  hapticOn = 'tap',
  ...rest
}: PressableProps & { children: ReactNode; hapticOn?: 'tap' | 'select' | 'none' }) {
  const scale = useSharedValue(1);
  const reduce = useReducedMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[animated, disabled && { opacity: 0.5 }]}>
      <Pressable
        disabled={disabled}
        onPressIn={(e) => {
          if (!reduce) scale.set(withSpring(0.97, springs.snappy));
          if (hapticOn === 'tap') haptic.tap();
          if (hapticOn === 'select') haptic.select();
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          scale.set(withSpring(1, springs.snappy));
          onPressOut?.(e);
        }}
        onPress={onPress}
        style={style}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Staggered entrance for a list item. Items enter one after another, 40ms apart, capped at 10. */
export function Enter({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  if (reduce) return <Animated.View style={style}>{children}</Animated.View>;
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 10) * 40).duration(durations.medium).easing(base)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** Whole-screen entrance: a short fade. Used at the root of every route. */
export function ScreenEnter({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  if (reduce) return <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>;
  return (
    <Animated.View entering={FadeIn.duration(durations.quick).easing(base)} style={[{ flex: 1 }, style]}>
      {children}
    </Animated.View>
  );
}

/** Number that counts up to `value` when it first appears and whenever it changes. */
export function AnimatedNumber({
  value,
  format = (n: number) => Math.round(n).toLocaleString('en-US'),
  style,
}: {
  value: number;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
}) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      from.current = value;
      return;
    }
    const start = from.current;
    const t0 = Date.now();
    let frame = 0;
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / durations.slow);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(start + (value - start) * eased);
      if (k < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);

  return <Text style={style}>{format(reduce ? value : shown)}</Text>;
}

/** Progress bar that fills to `progress` (0 to 1) on the base curve. */
export function AnimatedBar({ progress, style, fill }: { progress: number; style?: StyleProp<ViewStyle>; fill: StyleProp<ViewStyle> }) {
  const width = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const p = Math.max(0, Math.min(1, progress));
    width.set(reduce ? p : withTiming(p, { duration: durations.slow, easing: base }));
  }, [progress, reduce, width]);
  const animated = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <Animated.View style={style}>
      <Animated.View style={[fill, animated]} />
    </Animated.View>
  );
}

/** Horizontal shake for errors. Call `shake()` when the wrong input is entered. */
export function useShake() {
  const x = useSharedValue(0);
  const reduce = useReducedMotion();
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const shake = useCallback(() => {
    haptic.warning();
    if (reduce) return;
    x.set(withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 60 }),
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    ));
  }, [reduce, x]);
  return { style, shake };
}
