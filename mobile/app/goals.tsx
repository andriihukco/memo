import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { t } from '../src/i18n';
import { api, ApiError, type Goal, type Report } from '../src/lib/api';
import { useSession } from '../src/lib/session';
import { dayStreak, goalProgress, type GoalPeriod, type MetricPoint } from '../src/lib/goals';
import { Empty, Group, PrimaryButton, SectionHeader, TOUCH } from '../src/components/ui';
import { useThemed, type Theme } from '../src/theme/theme';

interface Draft {
  name: string;
  metric: string;
  unit: string;
  target: string;
  period: GoalPeriod;
}

const EMPTY_DRAFT: Draft = { name: '', metric: 'steps', unit: 'steps', target: '', period: 'day' };
/** Up to 200 recent entries is enough for a week of logs. */
const PAGES_TO_LOAD = 4;

/** Goals, logging against them, progress, and a weekly retro. Same rules as the Mini App. */
export default function GoalsScreen() {
  const { colors, styles } = useThemed(makeStyles);
  const { token, live } = useSession();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [points, setPoints] = useState<MetricPoint[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [logGoalId, setLogGoalId] = useState('');
  const [logValue, setLogValue] = useState('');
  const [retro, setRetro] = useState<Report | null>(null);

  const load = useCallback(async () => {
    if (!live || !token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { goals: loaded } = await api.listGoals(token);
      setGoals(loaded);
      setLogGoalId((id) => id || loaded[0]?.id || '');

      const collected: MetricPoint[] = [];
      let before: string | null = null;
      for (let page = 0; page < PAGES_TO_LOAD; page++) {
        const body = await api.listEntriesBefore(token, before);
        for (const e of body.entries) {
          for (const m of e.metadata?.dashboard_metrics ?? []) {
            if (typeof m.key === 'string' && typeof m.value === 'number') {
              collected.push({ date: new Date(e.created_at), key: m.key, value: m.value });
            }
          }
        }
        if (!body.has_more || !body.next_cursor) break;
        before = body.next_cursor;
      }
      setPoints(collected);
      setNow(new Date());
    } catch {
      setError(t('goals.error_load'));
    } finally {
      setLoading(false);
    }
  }, [live, token]);

  useEffect(() => {
    // Loading starts from an effect on purpose: the screen shows its loading state first.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const progress = useMemo(
    () => goals.map((g) => ({ ...goalProgress(g, points, now), streak: dayStreak(g, points, now) })),
    [goals, points, now],
  );

  const persist = async (next: Goal[]): Promise<boolean> => {
    if (!token) return false;
    setBusy(true);
    setError(null);
    try {
      await api.saveGoals(token, next);
      setGoals(next);
      return true;
    } catch {
      setError(t('goals.error_save'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addGoal = async () => {
    const target = Number(draft.target);
    if (!draft.name.trim() || !draft.metric.trim() || !Number.isFinite(target) || target < 0) return;
    const goal: Goal = {
      id: Crypto.randomUUID(),
      name: draft.name.trim(),
      metric: draft.metric.trim().toLowerCase(),
      unit: draft.unit.trim(),
      target,
      period: draft.period,
    };
    if (await persist([...goals, goal])) {
      setDraft(EMPTY_DRAFT);
      setLogGoalId((id) => id || goal.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const logProgress = async () => {
    const goal = goals.find((g) => g.id === logGoalId);
    const value = Number(logValue);
    if (!goal || !token || !Number.isFinite(value) || value <= 0) return;
    setBusy(true);
    setError(null);
    try {
      await api.createEntry(token, `${value} ${goal.unit} · ${goal.name}`, 'uncategorized', {
        dashboard_metrics: [{ key: goal.metric, label: goal.name, value, unit: goal.unit, aggregate: 'sum' }],
      });
      setLogValue('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch {
      setError(t('goals.error_entry'));
    } finally {
      setBusy(false);
    }
  };

  const makeRetro = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const { report } = await api.createReport(token, 'weekly');
      setRetro(report);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 422 ? t('goals.retro_empty') : t('goals.error_retro'));
    } finally {
      setBusy(false);
    }
  };

  const periodWord = (period: GoalPeriod) => (period === 'day' ? t('goals.today') : t('goals.this_week'));

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('categories.back')} onPress={() => router.back()} style={styles.headerButton}>
          <Text style={styles.link}>‹ {t('categories.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('goals.title')}</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!live ? (
          <Empty title={t('goals.signin')} />
        ) : (
          <>
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

            <SectionHeader>{t('goals.period_title')}</SectionHeader>
            {loading ? <Text style={styles.muted}>{t('goals.loading')}</Text> : null}
            {!loading && goals.length === 0 ? <Text style={styles.muted}>{t('goals.empty')}</Text> : null}
            {progress.map((p) => (
              <View key={p.goal.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{p.goal.name}</Text>
                  <Text style={styles.muted}>
                    {t('goals.progress', { current: Math.round(p.current), target: p.target, unit: p.goal.unit, period: periodWord(p.goal.period) })}
                  </Text>
                </View>
                <View
                  accessibilityRole="progressbar"
                  accessibilityLabel={`${p.goal.name} progress`}
                  accessibilityValue={{ min: 0, max: 100, now: Math.round(p.ratio * 100) }}
                  style={styles.track}
                >
                  <View style={[styles.fill, { width: `${p.ratio * 100}%` }]} />
                </View>
                <View style={styles.cardTop}>
                  <Text style={styles.muted}>
                    {p.met ? t('goals.met') : t('goals.not_yet')}
                    {p.goal.period === 'day' && p.streak > 0 ? ` · ${t('goals.streak', { days: p.streak })}` : ''}
                  </Text>
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => void persist(goals.filter((g) => g.id !== p.goal.id))}>
                    <Text style={styles.link}>{t('goals.remove')}</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            {goals.length > 0 ? (
              <>
                <SectionHeader>{t('goals.log_title')}</SectionHeader>
                <Group>
                  <View style={styles.chips}>
                    {goals.map((g) => (
                      <Pressable
                        key={g.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: logGoalId === g.id }}
                        onPress={() => setLogGoalId(g.id)}
                        style={[styles.chip, logGoalId === g.id && { backgroundColor: colors.tintFill }]}
                      >
                        <Text style={[styles.chipText, logGoalId === g.id && { color: colors.onTint }]}>{g.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    keyboardType="decimal-pad"
                    value={logValue}
                    onChangeText={setLogValue}
                    placeholder={t('goals.log_amount')}
                    placeholderTextColor={colors.muted}
                    accessibilityLabel={t('goals.log_amount')}
                    style={styles.input}
                  />
                </Group>
                <View style={styles.gap}>
                  <PrimaryButton label={t('categories.save')} onPress={() => void logProgress()} disabled={busy || !logValue} />
                </View>
              </>
            ) : null}

            <SectionHeader>{t('goals.retro_title')}</SectionHeader>
            <PrimaryButton label={t('goals.retro_button')} onPress={() => void makeRetro()} disabled={busy} />
            {retro ? (
              <View style={styles.card}>
                {retro.summary ? <Text style={styles.cardTitle}>{retro.summary}</Text> : null}
                {(retro.insights ?? []).map((i) => (
                  <Text key={i.type} style={styles.insight}>{i.emoji} {i.text}</Text>
                ))}
              </View>
            ) : null}

            <SectionHeader>{t('goals.add_title')}</SectionHeader>
            <Group>
              <TextInput value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} placeholder={t('categories.name')} placeholderTextColor={colors.muted} maxLength={60} accessibilityLabel={t('categories.name')} style={styles.input} />
              <TextInput value={draft.metric} onChangeText={(metric) => setDraft({ ...draft, metric })} placeholder={t('goals.metric')} placeholderTextColor={colors.muted} maxLength={32} autoCapitalize="none" accessibilityLabel={t('goals.metric')} style={styles.input} />
              <TextInput value={draft.unit} onChangeText={(unit) => setDraft({ ...draft, unit })} placeholder={t('goals.unit')} placeholderTextColor={colors.muted} maxLength={16} accessibilityLabel={t('goals.unit')} style={styles.input} />
              <TextInput value={draft.target} onChangeText={(target) => setDraft({ ...draft, target })} placeholder={t('goals.target')} placeholderTextColor={colors.muted} keyboardType="decimal-pad" accessibilityLabel={t('goals.target')} style={styles.input} />
            </Group>
            <View style={styles.chips}>
              {(['day', 'week'] as const).map((period) => (
                <Pressable
                  key={period}
                  accessibilityRole="button"
                  accessibilityState={{ selected: draft.period === period }}
                  onPress={() => setDraft({ ...draft, period })}
                  style={[styles.chip, draft.period === period && { backgroundColor: colors.tintFill }]}
                >
                  <Text style={[styles.chipText, draft.period === period && { color: colors.onTint }]}>
                    {period === 'day' ? t('goals.every_day') : t('goals.every_week')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.gap}>
              <PrimaryButton label={t('goals.add_title')} onPress={() => void addGoal()} disabled={busy} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerButton: { minWidth: TOUCH, minHeight: TOUCH, justifyContent: 'center' },
  title: { fontSize: colors.fs(17), fontWeight: '600', color: colors.label },
  link: { fontSize: colors.fs(15), color: colors.tint },
  content: { paddingBottom: 40, gap: 12 },
  error: { fontSize: colors.fs(15), color: colors.destructive, paddingHorizontal: 16 },
  muted: { fontSize: colors.fs(14), color: colors.muted, paddingHorizontal: 16 },
  card: { backgroundColor: colors.card, borderRadius: 16, marginHorizontal: 16, padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: colors.fs(16), fontWeight: '600', color: colors.label, flexShrink: 1 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.separator, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.tintFill },
  insight: { fontSize: colors.fs(14), color: colors.secondary, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  chip: { minHeight: TOUCH - 8, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: colors.card },
  chipText: { fontSize: colors.fs(15), fontWeight: '600', color: colors.label },
  input: { minHeight: TOUCH, paddingHorizontal: 16, fontSize: colors.fs(17), color: colors.label },
  gap: { marginHorizontal: 16 },
});
