/**
 * Goals and weekly retrospectives without AI.
 *
 * A goal is a daily or weekly target for one metric (for example steps per day).
 * Progress comes from the numeric metrics on diary entries. Everything here is pure,
 * so it runs on the server (retro) and in the browser (progress bars).
 * Days and totals follow src/lib/metrics.ts: local calendar days, canonical keys, set corrections.
 */
import { CANON, canonicalKey, dailyValues, dayKeyBefore, localDayKey, type Aggregate, type MetricMode, type MetricPoint as CanonPoint } from './metrics';

export type GoalPeriod = "day" | "week";

export interface Goal {
  id: string;
  name: string;
  metric: string; // metric key, e.g. "steps"
  unit: string; // e.g. "steps", "min", "km"
  target: number;
  period: GoalPeriod;
}

/** One numeric value logged for a metric. `day` defaults to the local day of `date`. */
export interface MetricPoint {
  date: Date;
  key: string;
  value: number;
  day?: string;
  aggregate?: Aggregate;
  mode?: MetricMode;
}

export interface GoalProgress {
  goal: Goal;
  current: number;
  target: number;
  ratio: number; // 0..1, capped
  met: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar day key, e.g. "2026-11-01". */
export function dayKey(date: Date): string {
  return localDayKey(date);
}

/**
 * Value of a metric per local day. Aliases count as the same metric ("steps" and "steps_count"),
 * sums add up, averages average, and a set correction replaces the running total.
 */
export function dailyTotals(points: MetricPoint[], key: string): Map<string, number> {
  const k = canonicalKey(key);
  const own: CanonPoint[] = points
    .filter((p) => canonicalKey(p.key) === k && Number.isFinite(p.value))
    .map((p) => ({
      date: p.date,
      day: p.day ?? localDayKey(p.date),
      key: k,
      value: p.value,
      aggregate: CANON[k]?.aggregate ?? p.aggregate ?? 'sum',
      mode: p.mode,
      label: k,
      unit: '',
    }));
  return dailyValues(own, k);
}

/** Progress for one goal at `now`. Day goals use today; week goals use the last 7 days. */
export function goalProgress(goal: Goal, points: MetricPoint[], now: Date): GoalProgress {
  const totals = dailyTotals(points, goal.metric);
  const days = goal.period === "day" ? 1 : 7;
  let current = 0;
  for (let i = 0; i < days; i++) {
    current += totals.get(dayKeyBefore(now, i)) ?? 0;
  }
  const ratio = goal.target > 0 ? Math.min(1, current / goal.target) : 0;
  return { goal, current, target: goal.target, ratio, met: goal.target > 0 && current >= goal.target };
}

/**
 * Consecutive days, ending today or yesterday, on which a daily goal was met.
 * Today counts only once it is met, so an unfinished day does not break the streak.
 */
export function dayStreak(goal: Goal, points: MetricPoint[], now: Date): number {
  if (goal.period !== "day") return 0;
  const totals = dailyTotals(points, goal.metric);
  const met = (offset: number) => (totals.get(dayKeyBefore(now, offset)) ?? 0) >= goal.target;

  let offset = met(0) ? 0 : 1;
  let streak = 0;
  while (met(offset)) {
    streak++;
    offset++;
  }
  return streak;
}

export interface RetroInput {
  from: Date;
  to: Date;
  entryDays: number; // distinct days with at least one entry
  entryCount: number;
  points: MetricPoint[];
  goals: Goal[];
}

export interface RetroInsight {
  type: "went_well" | "didnt_go_well" | "start_stop_continue" | "experiment" | "lesson";
  text: string;
  emoji: string;
}

export interface LocalRetro {
  period_type: "weekly";
  period_from: string;
  period_to: string;
  summary: string;
  content: string;
  went_well: string;
  didnt_go_well: string;
  start_stop_continue: string;
  experiment: string;
  lesson: string;
  insights: RetroInsight[];
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Weekly retro built from logged numbers only. Same shape as the AI retro, so the UI and storage do not change. */
export function buildLocalRetro(input: RetroInput, now: Date = input.to): LocalRetro {
  const { from, to, entryCount, entryDays, points, goals } = input;
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS));
  const progress = goals.map((g) => ({ ...goalProgress(g, points, now), streak: dayStreak(g, points, now) }));
  const met = progress.filter((p) => p.met);
  const missed = progress.filter((p) => !p.met);

  const wentWell = met.length
    ? met.map((p) => `${p.goal.name}: ${fmt(p.current)} ${p.goal.unit} (target ${fmt(p.target)})`).join("; ")
    : "No goal was met in this period.";

  const missedText = missed.length
    ? missed.map((p) => `${p.goal.name}: ${fmt(p.current)} of ${fmt(p.target)} ${p.goal.unit}`).join("; ")
    : "All goals were met.";

  const bestStreak = Math.max(0, ...progress.map((p) => p.streak));
  const continueText = met.length
    ? `Keep the routine behind ${met.map((p) => p.goal.name.toLowerCase()).join(", ")}.`
    : "Keep logging, even on days when the goal is missed.";
  const skipped = days - entryDays;
  const startText = skipped > 0
    ? `Try to log on the ${skipped} day${skipped === 1 ? "" : "s"} you skipped.`
    : "Keep logging every day.";

  const experiment = missed.length
    ? `Next week, try to hit "${missed[0].goal.name}" on two specific days, and log it the same day.`
    : "Next week, raise one target by 10%.";

  const lesson = `You logged ${entryCount} entries on ${entryDays} of ${days} days.`;
  const summary = `${entryCount} ${entryCount === 1 ? "entry" : "entries"} on ${entryDays} of ${days} days. ${met.length} of ${progress.length} ${progress.length === 1 ? "goal" : "goals"} met.`;

  const insights: RetroInsight[] = [
    { type: "went_well", text: wentWell, emoji: "✅" },
    { type: "didnt_go_well", text: missedText, emoji: "⚠️" },
    { type: "start_stop_continue", text: `${continueText} ${startText}`, emoji: "🔁" },
    { type: "experiment", text: experiment, emoji: "🧪" },
    { type: "lesson", text: `${lesson} Best streak: ${bestStreak} day(s).`, emoji: "📌" },
  ];

  const content = [
    `# Weekly retro`,
    `${dayKey(from)} to ${dayKey(to)}`,
    "",
    summary,
    "",
    ...insights.map((i) => `${i.emoji} ${i.text}`),
  ].join("\n");

  return {
    period_type: "weekly",
    period_from: from.toISOString(),
    period_to: to.toISOString(),
    summary,
    content,
    went_well: wentWell,
    didnt_go_well: missedText,
    start_stop_continue: `${continueText} ${startText}`,
    experiment,
    lesson,
    insights,
  };
}
