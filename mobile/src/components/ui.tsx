import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { useThemed, type Palette } from '../theme/theme';

/** Apple HIG minimum touch target. */
export const TOUCH = 44;

export function Title({ children }: { children: ReactNode }) {
  const { styles } = useThemed(makeStyles);
  return <Text style={styles.largeTitle} accessibilityRole="header">{children}</Text>;
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
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      {...rest}
    >
      <Text style={[styles.rowLabel, destructive && { color: colors.destructive }]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </Pressable>
  );
}

export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { styles } = useThemed(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, disabled && { opacity: 0.4 }, pressed && styles.pressed]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

export function Empty({ title, subtitle }: { title: string; subtitle?: string }) {
  const { styles } = useThemed(makeStyles);
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? color : color + '26' }]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.onTint : color }]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  largeTitle: { fontSize: 34, fontWeight: '700', color: colors.label, paddingHorizontal: 16, paddingTop: 8 },
  sectionHeader: { fontSize: 13, color: colors.muted, textTransform: 'uppercase', paddingHorizontal: 32, paddingTop: 20, paddingBottom: 6 },
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
  rowLabel: { fontSize: 17, color: colors.label, flexShrink: 1 },
  rowValue: { fontSize: 17, color: colors.muted, marginLeft: 12 },
  pressed: { opacity: 0.6 },
  primary: {
    minHeight: TOUCH + 4,
    borderRadius: 14,
    backgroundColor: colors.tintFill,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  primaryText: { color: colors.onTint, fontSize: 17, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: colors.label, textAlign: 'center' },
  emptySub: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chip: { minHeight: TOUCH - 8, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center' },
  chipText: { fontSize: 15, fontWeight: '600' },
});
