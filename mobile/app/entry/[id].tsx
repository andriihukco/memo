import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { t } from '../../src/i18n';
import { useEntries } from '../../src/lib/entry-store';
import { AUTO_META, metaFor } from '../../src/lib/category-meta';
import type { AutoCategory } from '../../src/lib/auto-category';
import { Chip, Dot, Empty, Group, PrimaryButton, Row, SectionHeader, TOUCH } from '../../src/components/ui';
import { useThemed, type Theme } from '../../src/theme/theme';

const AUTO_KEYS = Object.keys(AUTO_META) as AutoCategory[];

export default function EntryScreen() {
  const { styles } = useThemed(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { entries, categories, remove, update } = useEntries();
  const entry = entries.find((e) => e.id === id);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!entry) {
    return (
      <View style={styles.screen}>
        <Back />
        <Empty title={t('entry.not_found')} />
      </View>
    );
  }

  const known = categories.find((c) => c.name === entry.category);
  const meta = metaFor(entry.category, known?.label_ua, known?.color);
  const choices = [
    ...AUTO_KEYS.map((key) => key),
    ...categories.filter((c) => c.name !== 'uncategorized').map((c) => c.name),
  ];

  const startEdit = () => {
    setText(entry.content);
    setCategory(entry.category);
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    try {
      await update(entry.id, { content, category });
      setEditing(false);
    } catch {
      setError(t('error.generic'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert(t('entry.delete_title'), t('miniapp.feed.delete.irreversible'), [
      { text: t('miniapp.common.cancel'), style: 'cancel' },
      {
        text: t('entry.delete_action'),
        style: 'destructive',
        onPress: () => {
          void remove(entry.id);
          router.back();
        },
      },
    ]);

  if (editing) {
    return (
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.editHead}>
          <Pressable accessibilityRole="button" onPress={() => setEditing(false)} style={styles.headButton}>
            <Text style={styles.link}>{t('miniapp.common.cancel')}</Text>
          </Pressable>
          <Text style={styles.cat}>{t('entry.edit')}</Text>
          <View style={styles.headButton} />
        </View>

        <Text style={styles.label}>{t('entry.text')}</Text>
        <TextInput
          multiline
          value={text}
          onChangeText={setText}
          accessibilityLabel={t('entry.text')}
          style={styles.editor}
        />

        <Text style={styles.label}>{t('compose.category')}</Text>
        <View style={styles.chips}>
          {choices.map((key) => {
            const known = categories.find((c) => c.name === key);
            const m = metaFor(key, known?.label_ua, known?.color);
            return (
              <Chip key={key} label={m.label} color={m.color} selected={category === key} onPress={() => setCategory(key)} />
            );
          })}
        </View>

        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
        <View style={styles.gap}>
          <PrimaryButton label={t('categories.save')} onPress={() => void save()} disabled={busy || !text.trim()} />
        </View>
      </ScrollView>
    );
  }

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
          <SectionHeader>{t('entry.metrics')}</SectionHeader>
          <Group>
            {entry.metadata.dashboard_metrics.map((m) => (
              <Row key={m.key} label={m.label} value={`${m.value} ${m.unit}`} />
            ))}
          </Group>
        </>
      ) : null}

      {entry.bot_reply ? (
        <>
          <SectionHeader>{t('entry.reply')}</SectionHeader>
          <View style={styles.body}>
            <Text style={styles.text}>{entry.bot_reply}</Text>
          </View>
        </>
      ) : null}

      <SectionHeader>{t('entry.actions')}</SectionHeader>
      <Group>
        <Row label={t('entry.edit')} onPress={startEdit} />
        <Row label={t('entry.delete_action')} destructive onPress={confirmDelete} />
      </Group>
    </ScrollView>
  );
}

function Back() {
  const { styles } = useThemed(makeStyles);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('entry.back')} onPress={() => router.back()} style={styles.back}>
      <Text style={styles.backText}>‹ {t('entry.back')}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: 60 },
  content: { padding: 16, paddingTop: 60, paddingBottom: 40, gap: 8 },
  back: { minHeight: TOUCH, justifyContent: 'center' },
  backText: { fontSize: colors.fs(17), color: colors.tint },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  cat: { fontSize: colors.fs(17), fontWeight: '600', color: colors.label },
  date: { fontSize: colors.fs(13), color: colors.muted },
  body: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginTop: 8 },
  text: { fontSize: colors.fs(17), lineHeight: 24, color: colors.label },
  editHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  headButton: { minWidth: TOUCH, minHeight: TOUCH, justifyContent: 'center' },
  link: { fontSize: colors.fs(17), color: colors.tint },
  label: { fontSize: colors.fs(13), color: colors.muted, textTransform: 'uppercase', marginTop: 12 },
  editor: { minHeight: 140, backgroundColor: colors.card, borderRadius: 14, padding: 14, fontSize: colors.fs(17), lineHeight: 24, color: colors.label, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { fontSize: colors.fs(15), color: colors.destructive, textAlign: 'center', marginTop: 8 },
  gap: { marginTop: 16 },
});
