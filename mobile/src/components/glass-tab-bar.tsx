import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { t } from '../i18n';
import { TOUCH } from './ui';
import { Symbol } from './symbol';
import { useThemed, type Theme } from '../theme/theme';

interface TabRoute {
  key: string;
  name: string;
}

interface Props {
  routes: TabRoute[];
  activeIndex: number;
  onSelect: (route: TabRoute) => void;
  /** Tap on + opens the sheet for the current page. */
  onCompose: () => void;
  /** Holding + starts voice recording; releasing ends it. */
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
}

const PAD = 4;
const SPRING = { damping: 20, stiffness: 260, mass: 0.9 };

/** SF Symbols for each tab, with the filled variant for the active one. */
const TABS: Record<string, { label: string; icon: string; iconActive: string }> = {
  index: { label: t('shell.journal'), icon: 'doc.text', iconActive: 'doc.text.fill' },
  insights: { label: t('shell.insights'), icon: 'lightbulb', iconActive: 'lightbulb.fill' },
  you: { label: t('shell.you'), icon: 'person.crop.circle', iconActive: 'person.crop.circle.fill' },
};

/**
 * Floating tab pill. A glass capsule slides under the active tab with a spring,
 * so the selection moves instead of jumping. On iOS below 26 it falls back to a tinted fill.
 */
export function GlassTabBar({ routes, activeIndex, onSelect, onCompose, onHoldStart, onHoldEnd }: Props) {
  const { styles } = useThemed(makeStyles);
  const glass = isLiquidGlassAvailable();
  const [barWidth, setBarWidth] = useState(0);
  const slot = routes.length > 0 && barWidth > 0 ? (barWidth - PAD * 2) / routes.length : 0;

  const indicatorX = useSharedValue(0);
  useEffect(() => {
    indicatorX.value = withSpring(activeIndex * slot, SPRING);
  }, [activeIndex, slot, indicatorX]);

  const indicator = useAnimatedStyle(() => ({
    width: slot,
    transform: [{ translateX: indicatorX.value }],
  }), [slot]);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.pill} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
        {slot > 0 ? (
          <Animated.View style={[styles.indicator, indicator]}>
            {glass ? (
              <GlassView glassEffectStyle="regular" colorScheme="dark" style={styles.indicatorFill} />
            ) : (
              <View style={[styles.indicatorFill, styles.indicatorFallback]} />
            )}
          </Animated.View>
        ) : null}
        {routes.map((route, i) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          return (
            <TabItem
              key={route.key}
              label={tab.label}
              icon={i === activeIndex ? tab.iconActive : tab.icon}
              selected={i === activeIndex}
              onPress={() => {
                if (i !== activeIndex) {
                  void Haptics.selectionAsync();
                  onSelect(route);
                }
              }}
            />
          );
        })}
      </View>

      <ComposeButton glass={glass} onPress={onCompose} onHoldStart={onHoldStart} onHoldEnd={onHoldEnd} />
    </View>
  );
}

/** One tab. Presses shrink slightly and spring back. */
function TabItem({ label, icon, selected, onPress }: { label: string; icon: string; selected: boolean; onPress: () => void }) {
  const { colors, styles } = useThemed(makeStyles);
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => {
        scale.set(withSpring(0.92, SPRING));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, SPRING));
      }}
      style={styles.tab}
    >
      <Animated.View style={[styles.tabInner, style]}>
        <Symbol name={icon as never} size={22} color={selected ? colors.tint : colors.muted} weight={selected ? 'semibold' : 'regular'} />
        <Text style={[styles.label, selected && styles.labelActive]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** Separate round + on the right. Tap opens the sheet, hold records a voice entry. */
function ComposeButton({ glass, onPress, onHoldStart, onHoldEnd }: { glass: boolean; onPress: () => void; onHoldStart?: () => void; onHoldEnd?: () => void }) {
  const { colors, styles } = useThemed(makeStyles);
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const body = (
    <Animated.View style={[styles.composeInner, style]}>
      <Symbol name="plus" size={24} color={colors.onTint} weight="semibold" />
    </Animated.View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('shell.compose')}
      accessibilityHint={onHoldStart ? 'Hold to record a voice entry' : undefined}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      onLongPress={
        onHoldStart
          ? () => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              onHoldStart();
            }
          : undefined
      }
      onPressIn={() => {
        scale.set(withSpring(0.9, SPRING));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, SPRING));
        onHoldEnd?.();
      }}
      delayLongPress={250}
      style={styles.compose}
    >
      {glass ? (
        <GlassView glassEffectStyle="regular" isInteractive colorScheme="dark" tintColor={colors.tint} style={styles.composeGlass}>
          {body}
        </GlassView>
      ) : (
        <View style={[styles.composeGlass, styles.composeFallback]}>{body}</View>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 28, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pill: {
    flex: 1,
    height: 64,
    padding: PAD,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 32,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  indicator: { position: 'absolute', top: PAD, bottom: PAD, left: PAD },
  indicatorFill: { flex: 1, borderRadius: 28, overflow: 'hidden' },
  indicatorFallback: { backgroundColor: colors.separator },
  tab: { flex: 1, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' },
  tabInner: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: colors.fs(11), fontWeight: '500', color: colors.muted },
  labelActive: { color: colors.tint, fontWeight: '600' },
  compose: { width: 64, height: 64 },
  composeGlass: { flex: 1, borderRadius: 32, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  composeFallback: { backgroundColor: colors.tintFill },
  composeInner: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
});
