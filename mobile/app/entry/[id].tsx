import { Alert, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEntries } from '../../src/lib/entry-store';
import { metaFor } from '../../src/lib/category-meta';
import { Dot, Empty, Group, Row, SectionHeader, TOUCH } from '../../src/components/ui';
import { useThemed, type Palette } from '../../src/theme/theme';

export default function EntryScreen() {
  const { styles } = useThemed(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { entries, remove } = useEntries();
  const entry = entries.find((e) => e.id === id);

  if (!entry) {
    return (
      <View style={styles.screen}>
        <Back />
        <Empty title="Entry not found" />
      </View>
    );
  }

  const meta = metaFor(entry.category);
  const confirmDelete = () =>
    Alert.alert('Delete this entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void remove(entry.id);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Back />
      <View style={styles.headRow}>
        <Dot color={meta.color} />
        <Text style={styles.cat}>{meta.label}</Text>
      </View>
      <Text style={styles.date}>{new Date(entry.created_at).toLocaleString()}</Text>

      <View style={styles.body}>
        <Text style={styles.text}>{entry.content}</Text>
      </View>

      {entry.metadata?.dashboard_metrics?.length ? (
        <>
          <SectionHeader>Metrics</SectionHeader>
          <Group>
            {entry.metadata.dashboard_metrics.map((m) => (
              <Row key={m.key} label={m.label} value={`${m.value} ${m.unit}`} />
            ))}
          </Group>
        </>
      ) : null}

      {entry.bot_reply ? (
        <>
          <SectionHeader>Reply</SectionHeader>
          <View style={styles.body}>
            <Text style={styles.text}>{entry.bot_reply}</Text>
          </View>
        </>
      ) : null}

      <SectionHeader>Actions</SectionHeader>
      <Group>
        <Row label="Delete entry" destructive onPress={confirmDelete} />
      </Group>
    </ScrollView>
  );
}

function Back() {
  const { styles } = useThemed(makeStyles);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
      <Text style={styles.backText}>‹ Back</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: 60 },
  content: { padding: 16, paddingTop: 60, paddingBottom: 40, gap: 8 },
  back: { minHeight: TOUCH, justifyContent: 'center' },
  backText: { fontSize: 17, color: colors.tint },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  cat: { fontSize: 17, fontWeight: '600', color: colors.label },
  date: { fontSize: 13, color: colors.muted },
  body: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginTop: 8 },
  text: { fontSize: 17, lineHeight: 24, color: colors.label },
});
