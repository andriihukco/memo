import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { t } from '../../src/i18n';
import { useEntries } from '../../src/lib/entry-store';
import { PrimaryButton, TOUCH } from '../../src/components/ui';
import { useThemed, type Theme } from '../../src/theme/theme';
import { ScreenEnter } from '../../src/motion';

/** Period choices as in the Mini App retrospective sheet. */
const PERIODS = ['daily', 'weekly', 'monthly', 'ytd'] as const;

export default function NewRetroScreen() {
  return (
    <ScreenEnter>
      <NewRetroScreenBody />
    </ScreenEnter>
  );
}

function NewRetroScreenBody() {
  const { styles } = useThemed(makeStyles);
  const { addReport } = useEntries();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('weekly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await addReport(period);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('miniapp.reports.pick_period')}</Text>
      <View style={styles.group}>
        {PERIODS.map((p, i) => {
          const selected = period === p;
          return (
            <Pressable
              key={p}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setPeriod(p)}
              style={[styles.row, i > 0 && styles.border]}
            >
              <Text style={styles.rowText}>{t(`miniapp.reports.period.${p}`)}</Text>
              {selected ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton label={busy ? '…' : t('miniapp.reports.generate')} onPress={() => void generate()} disabled={busy} />
    </ScrollView>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  title: { fontSize: colors.fs(22), fontWeight: '700', color: colors.label, paddingVertical: 8 },
  group: { borderRadius: 16, backgroundColor: colors.card, overflow: 'hidden' },
  row: { minHeight: TOUCH + 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  rowText: { fontSize: colors.fs(17), color: colors.label },
  check: { fontSize: colors.fs(17), color: colors.tint, fontWeight: '600' },
  error: { color: colors.destructive, fontSize: colors.fs(14) },
});
