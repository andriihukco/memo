import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useEntries } from '../../src/lib/entry-store';
import { metaFor } from '../../src/lib/category-meta';
import { categoryCounts } from '../../src/lib/entries';
import { colors, Dot, Empty, Group, SectionHeader, TOUCH } from '../../src/components/ui';

export default function CategoriesScreen() {
  const { categories, entries } = useEntries();
  const counts = new Map(categoryCounts(entries).map((c) => [c.category, c.count]));

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>‹ You</Text>
      </Pressable>
      <Text style={styles.title}>Categories</Text>

      <SectionHeader>Your categories</SectionHeader>
      {categories.length === 0 ? (
        <Empty title="No categories yet" subtitle="Categories appear as you write entries." />
      ) : (
        <Group>
          {categories.map((c, i) => {
            const meta = metaFor(c.name, c.label_ua);
            return (
              <View key={c.name} style={[styles.row, i > 0 && styles.border]}>
                <Dot color={meta.color} />
                <Text style={styles.label}>{meta.label}</Text>
                <Text style={styles.count}>{counts.get(c.name) ?? 0}</Text>
              </View>
            );
          })}
        </Group>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 60, paddingBottom: 40 },
  back: { minHeight: TOUCH, justifyContent: 'center' },
  backText: { fontSize: 17, color: colors.tint },
  title: { fontSize: 34, fontWeight: '700', color: colors.label, marginTop: 4 },
  row: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  label: { flex: 1, fontSize: 17, color: colors.label },
  count: { fontSize: 17, color: colors.muted },
});
