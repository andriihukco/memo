import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEntries } from '../src/lib/entry-store';
import { suggestCategory, metaFor, AUTO_META } from '../src/lib/category-meta';
import { Chip, PrimaryButton, TOUCH } from '../src/components/ui';
import type { AutoCategory } from '../src/lib/auto-category';
import { useThemed, type Palette } from '../src/theme/theme';

const AUTO_KEYS = Object.keys(AUTO_META) as AutoCategory[];

/** Entry sheet. Opened by a tap on + (empty) or by releasing a hold on + (prefilled with the voice transcript). */
export default function ComposeScreen() {
  const { colors, styles } = useThemed(makeStyles);
  const { add } = useEntries();
  const { text: initial } = useLocalSearchParams<{ text?: string }>();
  const [text, setText] = useState(initial ?? '');
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const category = picked ?? suggestCategory(text);
  const fullText = text.trim();

  const save = async () => {
    if (!fullText || saving) return;
    setSaving(true);
    try {
      await add(fullText, category);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={() => router.back()} style={styles.headerBtn}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>New entry</Text>
        <View style={styles.headerBtn} />
      </View>

      <TextInput
        multiline
        autoFocus={!initial}
        value={text}
        onChangeText={setText}
        placeholder="What's on your mind?"
        placeholderTextColor={colors.muted}
        style={styles.input}
        accessibilityLabel="Entry text"
      />

      <Text style={styles.sectionLabel}>Category</Text>
      <View style={styles.chips}>
        {AUTO_KEYS.map((key) => {
          const meta = metaFor(key);
          return (
            <Chip key={key} label={meta.label} color={meta.color} selected={category === key} onPress={() => setPicked(key)} />
          );
        })}
      </View>
      {!picked ? <Text style={styles.hint}>Detected automatically from your words.</Text> : null}

      {note ? <Text style={styles.note}>{note}</Text> : null}

      <PrimaryButton label={saving ? 'Saving…' : 'Save'} onPress={() => void save()} disabled={!fullText || saving} />
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBtn: { minWidth: TOUCH, minHeight: TOUCH, justifyContent: 'center' },
  cancel: { fontSize: 17, color: colors.tint },
  title: { fontSize: 17, fontWeight: '600', color: colors.label },
  input: {
    minHeight: 160,
    fontSize: 20,
    lineHeight: 28,
    color: colors.label,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    textAlignVertical: 'top',
  },
  sectionLabel: { fontSize: 13, color: colors.muted, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontSize: 13, color: colors.muted, marginTop: -8 },
  note: { fontSize: 15, color: colors.secondary, textAlign: 'center' },
});
