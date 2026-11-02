import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { Text } from '../theme/typography';
import { Symbol } from './symbol';
import { PressScale } from '../motion';
import { useThemed, type Theme } from '../theme/theme';

/** Apple HIG minimum touch target. */
export const TOUCH = 44;

export function Title({ children }: { children: ReactNode }) {
  const { colors, styles } = useThemed(makeStyles);
  return <Text style={[styles.largeTitle, { fontFamily: colors.heading }]} accessibilityRole="header">{children}</Text>;
}

export function SectionHeader({ children }: { children: ReactNode }) {
  const { styles } = useThemed(makeStyles);
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

/** Inset grouped card, as used across the Mini App settings and lists. */
export function Group({ children }: { children: ReactNode }) {
  const { styles } = useThemed(makeStyles);
  return <View style={styles.group}>{children}</View>;
}

export function Row({
  label,
  value,
  destructive,
  ...rest
}: PressableProps & { label: string; value?: string; destructive?: boolean }) {
  const { colors, styles } = useThemed(makeStyles);
  const { onPress, ...others } = rest;
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={label} style={styles.row} onPress={onPress} {...others}>
      <Text style={[styles.rowLabel, destructive && { color: colors.destructive }]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </PressScale>
  );
}

export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { styles } = useThemed(makeStyles);
  return (
    <PressScale accessibilityRole="button" disabled={disabled} onPress={onPress} style={styles.primary}>
      <Text style={styles.primaryText}>{label}</Text>
    </PressScale>
  );
}

/**
 * Empty state: an icon in a soft circle, a short title and subtitle, and one action when there is a next step.
 * Used wherever a list has no items yet.
 */
export function Empty({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  action?: { label: string; onPress: () => void };
}) {
  const { colors, styles } = useThemed(makeStyles);
  return (
    <View style={styles.empty}>
      {icon ? (
        <View style={styles.emptyIcon}>
          <Symbol name={icon} size={26} color={colors.tint} />
        </View>
      ) : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress} style={styles.emptyAction}>
          <Text style={styles.emptyActionText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Dot({ color }: { color: string }) {
  const { styles } = useThemed(makeStyles);
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

export function Chip({ label, color, selected, onPress }: { label: string; color: string; selected?: boolean; onPress?: () => void }) {
  const { colors, styles } = useThemed(makeStyles);
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      hapticOn="select"
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? color : color + '26' }]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.onTint : color }]}>{label}</Text>
    </PressScale>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  largeTitle: { fontSize: colors.fs(34), fontWeight: '700', color: colors.label, paddingHorizontal: 16, paddingTop: 8 },
  sectionHeader: { fontSize: colors.fs(13), color: colors.muted, textTransform: 'uppercase', paddingHorizontal: 32, paddingTop: 20, paddingBottom: 6 },
  group: { backgroundColor: colors.card, borderRadius: 12, marginHorizontal: 16, overflow: 'hidden' },
  row: {
    minHeight: TOUCH,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  rowLabel: { fontSize: colors.fs(17), color: colors.label, flexShrink: 1 },
  rowValue: { fontSize: colors.fs(17), color: colors.muted, marginLeft: 12 },
  pressed: { opacity: 0.6 },
  primary: {
    minHeight: TOUCH + 4,
    borderRadius: 14,
    backgroundColor: colors.tintFill,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  primaryText: { color: colors.onTint, fontSize: colors.fs(17), fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, marginBottom: 6 },
  emptyAction: { marginTop: 14, minHeight: TOUCH, paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.tintFill, justifyContent: 'center' },
  emptyActionText: { fontSize: colors.fs(16), fontWeight: '600', color: colors.onTint },
  emptyTitle: { fontSize: colors.fs(20), fontWeight: '600', color: colors.label, textAlign: 'center' },
  emptySub: { fontSize: colors.fs(15), color: colors.muted, textAlign: 'center', marginTop: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chip: { minHeight: TOUCH - 8, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center' },
  chipText: { fontSize: colors.fs(15), fontWeight: '600' },
});
