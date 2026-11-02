import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../theme/typography';
import { Symbol } from './symbol';
import { TOUCH } from './ui';
import { useThemed, type Theme } from '../theme/theme';

export interface SettingsItem {
  icon: string;
  title: string;
  sub?: string;
  badge?: string;
  destructive?: boolean;
  selected?: boolean;
  /** Set when the row opens a sub-list (for example auto-lock). */
  expanded?: boolean;
  onPress?: () => void;
}

/** Section title above a grouped card, as in the Settings list. */
export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const { styles } = useThemed(makeStyles);
  return (
    <View>
      <Text style={styles.section}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

/** One row of a settings card. Tapping runs onPress; selected rows show a check. */
export function SettingsRow({ item, first }: { item: SettingsItem; first?: boolean }) {
  const { colors, styles } = useThemed(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityState={{ selected: !!item.selected, expanded: item.expanded }}
      onPress={item.onPress}
      style={({ pressed }) => [styles.row, !first && styles.border, pressed && { opacity: 0.6 }]}
    >
      <Symbol name={item.icon} size={20} color={item.destructive ? colors.destructive : colors.tint} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, item.destructive && { color: colors.destructive }]}>{item.title}</Text>
        {item.sub ? <Text style={styles.rowSub}>{item.sub}</Text> : null}
      </View>
      {item.badge ? (
        <Text style={styles.badge}>{item.badge}</Text>
      ) : item.selected ? (
        <Symbol name="checkmark" size={16} color={colors.tint} weight="semibold" />
      ) : item.onPress ? (
        <Symbol name="chevron.right" size={14} color={colors.muted} weight="semibold" />
      ) : null}
    </Pressable>
  );
}

/** Plain list of rows inside one card. */
export function SettingsCard({ items }: { items: SettingsItem[] }) {
  return (
    <>
      {items.map((item, i) => (
        <SettingsRow key={`${item.title}-${i}`} item={item} first={i === 0} />
      ))}
    </>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  section: { fontSize: colors.fs(12), letterSpacing: 1, color: colors.muted, textTransform: 'uppercase', paddingHorizontal: 4, paddingTop: 22, paddingBottom: 8 },
  card: { borderRadius: 16, backgroundColor: colors.card, overflow: 'hidden' },
  row: { minHeight: TOUCH + 6, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  rowTitle: { fontSize: colors.fs(16), color: colors.label },
  rowSub: { fontSize: colors.fs(13), color: colors.muted, marginTop: 2 },
  badge: { fontSize: colors.fs(12), color: colors.destructive, backgroundColor: 'rgba(248,113,113,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
});
