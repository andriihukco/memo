import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEntries } from '../../src/lib/entry-store';
import { CATEGORY_SWATCHES, metaFor } from '../../src/lib/category-meta';
import { categoryCounts } from '../../src/lib/entries';
import type { Category } from '../../src/lib/api';
import { Dot, Empty, Group, PrimaryButton, SectionHeader, TOUCH } from '../../src/components/ui';
import { t } from '../../src/i18n';
import { useThemed, type Theme } from '../../src/theme/theme';

const NAME_MAX = 40;
const UNCATEGORIZED = 'uncategorized';

/** What the editor sheet works on: a new category, or an existing one. */
type Editing = { mode: 'new' } | { mode: 'edit'; category: Category };

export default function CategoriesScreen() {
  const { styles } = useThemed(makeStyles);
  const { categories, entries, saveCategory, removeCategory, mergeCategory } = useEntries();
  const counts = new Map(categoryCounts(entries).map((c) => [c.category, c.count]));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Editing>({ mode: 'new' });
  // Bumped on every open so the editor starts from fresh fields.
  const [session, setSession] = useState(0);

  const openEditor = (next: Editing) => {
    setEditing(next);
    setSession((s) => s + 1);
    setOpen(true);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Pressable accessibilityRole="button" accessibilityLabel={t('categories.back')} onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>‹ {t('categories.back')}</Text>
      </Pressable>
      <Text style={styles.title}>{t('categories.title')}</Text>

      <SectionHeader>{t('categories.your')}</SectionHeader>
      {categories.length === 0 ? (
        <Empty title={t('categories.empty_title')} subtitle={t('categories.empty_sub')} />
      ) : (
        <Group>
          {categories.map((c, i) => {
            const meta = metaFor(c.name, c.label_ua, c.color);
            return (
              <Pressable
                key={c.name}
                accessibilityRole="button"
                accessibilityLabel={meta.label}
                onPress={() => openEditor({ mode: 'edit', category: c })}
                style={({ pressed }) => [styles.row, i > 0 && styles.border, pressed && styles.pressed]}
              >
                <Dot color={meta.color} />
                <Text style={styles.label}>{meta.label}</Text>
                <Text style={styles.count}>{counts.get(c.name) ?? 0}</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          })}
        </Group>
      )}

      <View style={styles.addWrap}>
        <PrimaryButton label={t('categories.add')} onPress={() => openEditor({ mode: 'new' })} />
      </View>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <CategoryEditor
          key={session}
          editing={editing}
          categories={categories}
          onClose={() => setOpen(false)}
          onSave={saveCategory}
          onRemove={removeCategory}
          onMerge={mergeCategory}
        />
      </Modal>
    </ScrollView>
  );
}

interface EditorProps {
  editing: Editing;
  categories: Category[];
  onClose: () => void;
  onSave: (input: { name?: string; label: string; color: string }) => Promise<void>;
  onRemove: (name: string) => Promise<void>;
  onMerge: (source: string, target: string) => Promise<void>;
}

/** Name and colour form for a new or existing category, with merge and delete for existing ones. */
function CategoryEditor({ editing, categories, onClose, onSave, onRemove, onMerge }: EditorProps) {
  const { colors, styles } = useThemed(makeStyles);
  const existing = editing.mode === 'edit' ? editing.category : null;
  const [label, setLabel] = useState(existing?.label_ua ?? '');
  const [color, setColor] = useState<string>(
    existing ? metaFor(existing.name, existing.label_ua, existing.color).color : CATEGORY_SWATCHES[0],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = label.trim();
  const canSave = trimmed.length > 0 && !busy;
  const mergeTargets = categories.filter((c) => c.name !== existing?.name && c.name !== UNCATEGORIZED);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('categories.error'));
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!canSave) return;
    void run(() => onSave({ name: existing?.name, label: trimmed, color }));
  };

  const confirmMerge = (target: Category) => {
    if (!existing) return;
    Alert.alert(
      t('categories.merge_title', { name: existing.label_ua }),
      t('categories.merge_message', { target: target.label_ua }),
      [
        { text: t('categories.cancel'), style: 'cancel' },
        { text: t('categories.merge_button'), onPress: () => void run(() => onMerge(existing.name, target.name)) },
      ],
    );
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert(
      t('categories.delete_title'),
      t('categories.delete_message', { name: existing.label_ua }),
      [
        { text: t('categories.cancel'), style: 'cancel' },
        { text: t('categories.delete'), style: 'destructive', onPress: () => void run(() => onRemove(existing.name)) },
      ],
    );
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.headerButton}>
          <Text style={styles.headerText}>{t('categories.cancel')}</Text>
        </Pressable>
        <Text style={styles.sheetTitle}>{existing ? t('categories.edit_title') : t('categories.new_title')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          disabled={!canSave}
          onPress={submit}
          style={styles.headerButton}
        >
          <Text style={[styles.headerText, styles.headerBold, !canSave && styles.disabled]}>{t('categories.save')}</Text>
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
        <SectionHeader>{t('categories.name')}</SectionHeader>
        <Group>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder={t('categories.name_placeholder')}
            placeholderTextColor={colors.muted}
            maxLength={NAME_MAX}
            autoFocus={!existing}
            returnKeyType="done"
            onSubmitEditing={submit}
            style={styles.input}
            accessibilityLabel={t('categories.name')}
          />
        </Group>

        <SectionHeader>{t('categories.color')}</SectionHeader>
        <View style={styles.swatches}>
          {CATEGORY_SWATCHES.map((hex) => {
            const selected = color === hex;
            return (
              <Pressable
                key={hex}
                accessibilityRole="button"
                accessibilityLabel={hex}
                accessibilityState={{ selected }}
                onPress={() => setColor(hex)}
                style={[styles.swatch, selected && { borderColor: colors.label }]}
              >
                <View style={[styles.swatchDot, { backgroundColor: hex }]} />
              </Pressable>
            );
          })}
        </View>

        {existing && mergeTargets.length > 0 ? (
          <>
            <SectionHeader>{t('categories.merge')}</SectionHeader>
            <Group>
              {mergeTargets.map((c, i) => (
                <Pressable
                  key={c.name}
                  accessibilityRole="button"
                  accessibilityLabel={c.label_ua}
                  disabled={busy}
                  onPress={() => confirmMerge(c)}
                  style={({ pressed }) => [styles.row, i > 0 && styles.border, pressed && styles.pressed]}
                >
                  <Dot color={metaFor(c.name, c.label_ua, c.color).color} />
                  <Text style={styles.label}>{c.label_ua}</Text>
                </Pressable>
              ))}
            </Group>
          </>
        ) : null}

        {existing ? (
          <View style={styles.deleteWrap}>
            <Group>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={confirmDelete}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Text style={styles.destructive}>{t('categories.delete')}</Text>
              </Pressable>
            </Group>
          </View>
        ) : null}

        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  content: { padding: 16, paddingTop: 60, paddingBottom: 40 },
  back: { minHeight: TOUCH, justifyContent: 'center' },
  backText: { fontSize: colors.fs(17), color: colors.tint },
  title: { fontSize: colors.fs(34), fontWeight: '700', color: colors.label, marginTop: 4 },
  row: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  pressed: { opacity: 0.6 },
  label: { flex: 1, fontSize: colors.fs(17), color: colors.label },
  count: { fontSize: colors.fs(17), color: colors.muted },
  chevron: { fontSize: colors.fs(20), color: colors.muted, marginLeft: 2 },
  addWrap: { marginTop: 20 },

  sheet: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerButton: { minHeight: TOUCH, minWidth: TOUCH, justifyContent: 'center' },
  headerText: { fontSize: colors.fs(17), color: colors.tint },
  headerBold: { fontWeight: '600' },
  disabled: { opacity: 0.4 },
  sheetTitle: { fontSize: colors.fs(17), fontWeight: '600', color: colors.label },
  sheetContent: { paddingBottom: 40 },
  input: { minHeight: TOUCH, paddingHorizontal: 16, fontSize: colors.fs(17), color: colors.label },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8 },
  swatch: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: TOUCH / 2,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchDot: { width: 28, height: 28, borderRadius: 14 },
  deleteWrap: { marginTop: 24 },
  destructive: { fontSize: colors.fs(17), color: colors.destructive },
  error: { fontSize: colors.fs(15), color: colors.destructive, paddingHorizontal: 16, marginTop: 16 },
});
