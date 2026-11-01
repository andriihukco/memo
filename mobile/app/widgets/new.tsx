import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { t } from '../../src/i18n';
import { useEntries } from '../../src/lib/entry-store';
import type { Widget } from '../../src/lib/api';
import { PrimaryButton, TOUCH } from '../../src/components/ui';
import { useThemed, type Palette } from '../../src/theme/theme';

/** Same presets as the Mini App widget sheet. Custom lets you name your own metric. */
const PRESETS: { id: string; emoji: string; key: string; metric_key: string; unit: string; aggregate: Widget['aggregate']; color: string }[] = [
  { id: 'water', emoji: '💧', key: 'water', metric_key: 'water_ml', unit: 'ml', aggregate: 'sum', color: 'cyan' },
  { id: 'calories', emoji: '🔥', key: 'calories', metric_key: 'kcal_intake', unit: 'kcal', aggregate: 'sum', color: 'orange' },
  { id: 'sleep', emoji: '😴', key: 'sleep', metric_key: 'sleep_hours', unit: 'h', aggregate: 'avg', color: 'indigo' },
  { id: 'steps', emoji: '🏃', key: 'steps', metric_key: 'steps_count', unit: '', aggregate: 'sum', color: 'green' },
  { id: 'workout', emoji: '💪', key: 'workout', metric_key: 'active_min', unit: 'min', aggregate: 'sum', color: 'blue' },
  { id: 'weight', emoji: '⚖️', key: 'weight', metric_key: 'weight_kg', unit: 'kg', aggregate: 'last', color: 'teal' },
  { id: 'mood', emoji: '😊', key: 'mood', metric_key: 'mood_score', unit: '/10', aggregate: 'avg', color: 'pink' },
  { id: 'expenses', emoji: '💸', key: 'expenses', metric_key: 'expenses_day', unit: '', aggregate: 'sum', color: 'emerald' },
  { id: 'protein', emoji: '🥩', key: 'protein', metric_key: 'protein_g', unit: 'g', aggregate: 'sum', color: 'red' },
  { id: 'energy', emoji: '⚡', key: 'energy', metric_key: 'energy_level', unit: '/10', aggregate: 'avg', color: 'yellow' },
  { id: 'reading', emoji: '📚', key: 'reading', metric_key: 'pages_read', unit: '', aggregate: 'sum', color: 'amber' },
];

export default function NewWidgetScreen() {
  const { colors, styles } = useThemed(makeStyles);
  const { addWidget } = useEntries();
  const [selected, setSelected] = useState<(typeof PRESETS)[number] | 'custom' | null>(null);
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState('');
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (choice: (typeof PRESETS)[number] | 'custom') => {
    setSelected(choice);
    if (choice === 'custom') return;
    setTitle(t(`miniapp.dashboard.measure.${choice.key}`));
    setUnit(choice.unit);
  };

  const save = async () => {
    if (!selected || !title.trim() || saving) return;
    const preset = selected === 'custom' ? null : selected;
    const goalNum = Number(goal);
    const widget: Widget = {
      id: `w-${Date.now()}`,
      title: title.trim(),
      metric_key: preset ? preset.metric_key : `custom_${Date.now()}`,
      unit: unit.trim(),
      emoji: preset ? preset.emoji : '✨',
      iconColor: preset ? preset.color : 'violet',
      aggregate: preset ? preset.aggregate : 'sum',
      ...(goal && goalNum > 0 ? { goal: goalNum, period: 'day' as const } : {}),
    };
    setSaving(true);
    try {
      await addWidget(widget);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (!selected) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('miniapp.dashboard.widget.pick_metric')}</Text>
        <View style={styles.grid}>
          {PRESETS.map((p) => (
            <Pressable key={p.id} accessibilityRole="button" onPress={() => pick(p)} style={styles.tile}>
              <Text style={styles.emoji}>{p.emoji}</Text>
              <Text style={styles.tileText}>{t(`miniapp.dashboard.measure.${p.key}`)}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={() => pick('custom')} style={styles.tile}>
            <Text style={styles.emoji}>✨</Text>
            <Text style={styles.tileText}>{t('miniapp.dashboard.measure.custom')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={styles.back}>
        <Text style={styles.backText}>‹ {t('miniapp.common.cancel')}</Text>
      </Pressable>
      <TextInput accessibilityLabel="Widget name" value={title} onChangeText={setTitle} placeholder="Name" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput accessibilityLabel="Unit" value={unit} onChangeText={setUnit} placeholder="Unit" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput
        accessibilityLabel="Daily goal"
        value={goal}
        onChangeText={setGoal}
        keyboardType="decimal-pad"
        placeholder="Daily goal (optional)"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton label={saving ? '…' : t('miniapp.dashboard.widget.save')} onPress={() => void save()} disabled={!title.trim() || saving} />
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: colors.label, paddingVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47%', minHeight: 96, borderRadius: 16, backgroundColor: colors.card, padding: 12, justifyContent: 'center', gap: 6 },
  emoji: { fontSize: 26 },
  tileText: { fontSize: 15, color: colors.label, fontWeight: '500' },
  back: { minHeight: TOUCH, justifyContent: 'center' },
  backText: { fontSize: 17, color: colors.tint },
  input: { minHeight: TOUCH + 4, borderRadius: 14, backgroundColor: colors.card, color: colors.label, paddingHorizontal: 16, fontSize: 17 },
  error: { color: colors.destructive, fontSize: 14 },
});
