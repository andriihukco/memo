/**
 * One set of rules for the numbers on diary entries, shared by the bot, the web API and every screen.
 *
 * - Canonical metrics: each known measure has one key, one base unit and one way to combine
 *   (`water_ml` in ml, summed). Aliases and other units are converted on the way in, so
 *   "2 glasses", "500 ml" and "0.5 l" of water all add up in one total.
 * - Corrections: a metric with `mode: "set"` replaces the day's running value from that moment
 *   ("today I drank 2 l in total"). Later entries add on top again.
 * - Days are calendar days in the user's time zone, and an entry counts on the day it happened
 *   (`metadata.occurred_at`), not the day it was typed.
 *
 * Pure TypeScript with no imports. Mirrored byte for byte in mobile/src/lib/metrics.ts
 * (src/__tests__/metrics.test.ts checks), so edit both together.
 */

export type Aggregate = 'sum' | 'avg' | 'last';
export type MetricMode = 'add' | 'set';

/** A metric as stored on an entry. Older rows may lack unit, aggregate or mode. */
export interface RawMetric {
  key: string;
  label?: string;
  value: number;
  unit?: string;
  icon?: string;
  aggregate?: Aggregate;
  mode?: MetricMode;
}

export interface Metric {
  key: string;
  label: string;
  value: number;
  unit: string;
  icon?: string;
  aggregate: Aggregate;
  mode?: MetricMode;
}

type Dimension = 'volume' | 'hours' | 'minutes' | 'km' | 'kg' | 'grams' | 'mg' | 'count' | 'score' | 'kcal' | 'percent';

interface Canon {
  unit: string;
  dimension: Dimension;
  aggregate: Aggregate;
  icon: string;
  label: { en: string; uk: string };
}

/** Known measures. Anything else is kept as the model sent it. */
export const CANON: Record<string, Canon> = {
  water_ml: { unit: 'ml', dimension: 'volume', aggregate: 'sum', icon: 'droplets', label: { en: 'Water', uk: 'Вода' } },
  kcal_intake: { unit: 'kcal', dimension: 'kcal', aggregate: 'sum', icon: 'utensils', label: { en: 'Calories', uk: 'Калорії' } },
  protein_g: { unit: 'g', dimension: 'grams', aggregate: 'sum', icon: 'beef', label: { en: 'Protein', uk: 'Білки' } },
  carbs_g: { unit: 'g', dimension: 'grams', aggregate: 'sum', icon: 'wheat', label: { en: 'Carbs', uk: 'Вуглеводи' } },
  fat_g: { unit: 'g', dimension: 'grams', aggregate: 'sum', icon: 'droplets', label: { en: 'Fat', uk: 'Жири' } },
  sugar_g: { unit: 'g', dimension: 'grams', aggregate: 'sum', icon: 'candy', label: { en: 'Sugar', uk: 'Цукор' } },
  caffeine_mg: { unit: 'mg', dimension: 'mg', aggregate: 'sum', icon: 'coffee', label: { en: 'Caffeine', uk: 'Кофеїн' } },
  sleep_hours: { unit: 'h', dimension: 'hours', aggregate: 'avg', icon: 'moon', label: { en: 'Sleep', uk: 'Сон' } },
  sleep_quality: { unit: '/10', dimension: 'score', aggregate: 'avg', icon: 'smile', label: { en: 'Sleep quality', uk: 'Якість сну' } },
  mood_score: { unit: '/10', dimension: 'score', aggregate: 'avg', icon: 'smile', label: { en: 'Mood', uk: 'Настрій' } },
  stress_level: { unit: '/10', dimension: 'score', aggregate: 'avg', icon: 'zap', label: { en: 'Stress', uk: 'Стрес' } },
  energy_level: { unit: '/10', dimension: 'score', aggregate: 'avg', icon: 'activity', label: { en: 'Energy', uk: 'Енергія' } },
  steps_count: { unit: 'steps', dimension: 'count', aggregate: 'sum', icon: 'footprints', label: { en: 'Steps', uk: 'Кроки' } },
  distance_km: { unit: 'km', dimension: 'km', aggregate: 'sum', icon: 'map-pin', label: { en: 'Distance', uk: 'Відстань' } },
  active_min: { unit: 'min', dimension: 'minutes', aggregate: 'sum', icon: 'timer', label: { en: 'Active time', uk: 'Активність' } },
  kcal_burned: { unit: 'kcal', dimension: 'kcal', aggregate: 'sum', icon: 'flame', label: { en: 'Burned', uk: 'Спалено' } },
  meditation_min: { unit: 'min', dimension: 'minutes', aggregate: 'sum', icon: 'flower', label: { en: 'Meditation', uk: 'Медитація' } },
  weight_kg: { unit: 'kg', dimension: 'kg', aggregate: 'last', icon: 'scale', label: { en: 'Weight', uk: 'Вага' } },
  body_fat_pct: { unit: '%', dimension: 'percent', aggregate: 'last', icon: 'percent', label: { en: 'Body fat', uk: 'Жир у тілі' } },
  fasting_hours: { unit: 'h', dimension: 'hours', aggregate: 'last', icon: 'hourglass', label: { en: 'Fasting', uk: 'Голодування' } },
  alcohol_units: { unit: 'units', dimension: 'count', aggregate: 'sum', icon: 'wine', label: { en: 'Alcohol', uk: 'Алкоголь' } },
  cigarettes_count: { unit: 'pcs', dimension: 'count', aggregate: 'sum', icon: 'cigarette', label: { en: 'Cigarettes', uk: 'Цигарки' } },
};

/** Other names the model or older entries use for the same measure. */
const ALIASES: Record<string, string> = {
  water: 'water_ml', water_l: 'water_ml', water_liters: 'water_ml', water_glasses: 'water_ml', glasses_of_water: 'water_ml',
  water_intake: 'water_ml', water_cups: 'water_ml', water_bottles: 'water_ml', hydration: 'water_ml', hydration_ml: 'water_ml',
  calories: 'kcal_intake', kcal: 'kcal_intake', calorie_intake: 'kcal_intake', calories_intake: 'kcal_intake', energy_kcal: 'kcal_intake',
  protein: 'protein_g', carbs: 'carbs_g', carbohydrates: 'carbs_g', carbohydrates_g: 'carbs_g', fat: 'fat_g', fats: 'fat_g', sugar: 'sugar_g',
  caffeine: 'caffeine_mg',
  sleep: 'sleep_hours', sleep_h: 'sleep_hours', sleep_duration: 'sleep_hours', hours_slept: 'sleep_hours',
  mood: 'mood_score', stress: 'stress_level', energy: 'energy_level',
  steps: 'steps_count', step_count: 'steps_count',
  distance: 'distance_km', km: 'distance_km', running_km: 'distance_km', walking_km: 'distance_km',
  active_minutes: 'active_min', duration: 'active_min', workout_min: 'active_min', exercise_min: 'active_min',
  calories_burned: 'kcal_burned', activity_kcal: 'kcal_burned', burned_kcal: 'kcal_burned',
  meditation: 'meditation_min', meditation_minutes: 'meditation_min',
  weight: 'weight_kg', body_weight: 'weight_kg', body_weight_kg: 'weight_kg',
  body_fat: 'body_fat_pct', fasting: 'fasting_hours', alcohol: 'alcohol_units', cigarettes: 'cigarettes_count',
};

/** Unit spellings (lower case, trimmed, trailing dot removed) to a factor that converts into the base unit. */
const UNITS: Partial<Record<Dimension, Record<string, number>>> = {
  // One serving of water is 250 ml, whatever it is called: glass, cup, склянка, чашка, стакан.
  volume: {
    ml: 1, мл: 1, milliliter: 1, milliliters: 1, millilitre: 1, millilitres: 1,
    l: 1000, л: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000, літр: 1000, літри: 1000, літрів: 1000,
    glass: 250, glasses: 250, cup: 250, cups: 250, склянка: 250, склянки: 250, склянок: 250, склянку: 250,
    стакан: 250, стакани: 250, стаканів: 250, чашка: 250, чашки: 250, чашок: 250, чашку: 250,
    bottle: 500, bottles: 500, пляшка: 500, пляшки: 500, пляшок: 500, пляшку: 500,
    oz: 29.57, 'fl oz': 29.57,
  },
  hours: { h: 1, hr: 1, hrs: 1, hour: 1, hours: 1, год: 1, година: 1, години: 1, годин: 1, min: 1 / 60, хв: 1 / 60, minutes: 1 / 60 },
  minutes: { min: 1, mins: 1, minute: 1, minutes: 1, хв: 1, хвилин: 1, хвилини: 1, h: 60, hr: 60, hour: 60, hours: 60, год: 60 },
  km: { km: 1, км: 1, m: 0.001, м: 0.001, meters: 0.001, metres: 0.001, mi: 1.609, miles: 1.609 },
  kg: { kg: 1, кг: 1, g: 0.001, г: 0.001, lb: 0.4536, lbs: 0.4536 },
  grams: { g: 1, г: 1, гр: 1, grams: 1, mg: 0.001, мг: 0.001, kg: 1000, кг: 1000 },
  mg: { mg: 1, мг: 1, g: 1000, г: 1000 },
  kcal: { kcal: 1, ккал: 1, cal: 1, calories: 1, кал: 1, kj: 0.239, кдж: 0.239 },
};

const UNIT_LABELS_UK: Record<string, string> = {
  ml: 'мл', kcal: 'ккал', g: 'г', mg: 'мг', h: 'год', min: 'хв', km: 'км', kg: 'кг', steps: 'кроків', units: 'од.', pcs: 'шт',
};

/** Unit as shown to the user. Base units are stored in English; Ukrainian gets its own spelling. */
export function unitLabel(unit: string, locale: string): string {
  return locale === 'uk' ? UNIT_LABELS_UK[unit] ?? unit : unit;
}

/** Name of a metric in the user language: canonical name for known measures, else `fallback`. */
export function metricLabel(key: string, locale: string, fallback?: string): string {
  const canon = CANON[canonicalKey(key)];
  if (canon) return locale === 'uk' ? canon.label.uk : canon.label.en;
  return fallback ?? key;
}

/** Canonical key for any spelling, or the cleaned key itself when the measure is unknown. */
export function canonicalKey(key: string): string {
  const k = key.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return CANON[k] ? k : ALIASES[k] ?? k;
}

/** Converts a value into the canonical unit. Unknown units are assumed to already be the base unit. */
export function toBaseUnit(key: string, value: number, unit: string | undefined): number {
  const canon = CANON[key];
  if (!canon || !unit) return value;
  const table = UNITS[canon.dimension];
  const u = unit.trim().toLowerCase().replace(/\.$/, '');
  if (!table || u === canon.unit) return value;
  const factor = table[u];
  return factor === undefined ? value : value * factor;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** One metric in canonical form, or null when the value is not a finite number. */
export function normalizeMetric(raw: RawMetric, locale = 'en'): Metric | null {
  const value = typeof raw.value === 'number' ? raw.value : Number(raw.value);
  if (typeof raw.key !== 'string' || !raw.key.trim() || !Number.isFinite(value)) return null;
  const key = canonicalKey(raw.key);
  const canon = CANON[key];
  const mode: MetricMode | undefined = raw.mode === 'set' ? 'set' : undefined;
  if (!canon) {
    const aggregate: Aggregate = raw.aggregate === 'avg' || raw.aggregate === 'last' ? raw.aggregate : 'sum';
    return { key, label: raw.label?.trim() || key, value: round(value), unit: raw.unit ?? '', icon: raw.icon, aggregate, ...(mode ? { mode } : {}) };
  }
  return {
    key,
    label: raw.label?.trim() || (locale === 'uk' ? canon.label.uk : canon.label.en),
    value: round(toBaseUnit(key, value, raw.unit)),
    unit: canon.unit,
    icon: canon.icon,
    aggregate: canon.aggregate,
    ...(mode ? { mode } : {}),
  };
}

/**
 * Canonical list for one entry. Two metrics that land on the same key (for example "water" and
 * "water_ml" from one message) are merged by the key's aggregate, so one entry never counts twice.
 */
export function normalizeMetrics(list: unknown, locale = 'en'): Metric[] {
  if (!Array.isArray(list)) return [];
  const byKey = new Map<string, Metric[]>();
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const m = normalizeMetric(raw as RawMetric, locale);
    if (!m) continue;
    byKey.set(m.key, [...(byKey.get(m.key) ?? []), m]);
  }
  return [...byKey.values()].map((group) => {
    if (group.length === 1) return group[0];
    const last = group[group.length - 1];
    const values = group.map((m) => m.value);
    const value =
      last.aggregate === 'sum' ? values.reduce((a, b) => a + b, 0)
      : last.aggregate === 'avg' ? values.reduce((a, b) => a + b, 0) / values.length
      : last.value;
    return { ...last, value: round(value) };
  });
}

// ── Days ──────────────────────────────────────────────────────────────────────

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** "YYYY-MM-DD" of `date` in `timeZone` (the runtime's own zone when omitted). */
export function localDayKey(date: Date, timeZone?: string): string {
  const id = timeZone ?? '';
  let fmt = dayFormatters.get(id);
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      fmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    dayFormatters.set(id, fmt);
  }
  return fmt.format(date);
}

/** Day key `offset` calendar days before the day of `now`. */
export function dayKeyBefore(now: Date, offset: number, timeZone?: string): string {
  const [y, m, d] = localDayKey(now, timeZone).split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d - offset, 12));
  return shifted.toISOString().slice(0, 10);
}

/** An entry as the metric helpers need it. */
export interface MetricEntry {
  created_at: string;
  metadata?: { dashboard_metrics?: unknown; occurred_at?: unknown } | Record<string, unknown> | null;
}

/** When the entry happened: `metadata.occurred_at` when valid, otherwise when it was saved. */
export function entryTime(entry: MetricEntry): Date {
  const occurred = (entry.metadata as { occurred_at?: unknown } | null | undefined)?.occurred_at;
  if (typeof occurred === 'string') {
    const d = new Date(occurred);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(entry.created_at);
}

/** One logged value, placed on a local day. */
export interface MetricPoint {
  date: Date;
  day: string;
  key: string;
  value: number;
  aggregate: Aggregate;
  mode?: MetricMode;
  label: string;
  unit: string;
  icon?: string;
}

/** Every metric on every entry as canonical points, oldest first. */
export function collectPoints(entries: MetricEntry[], timeZone?: string): MetricPoint[] {
  const points: MetricPoint[] = [];
  for (const entry of entries) {
    const meta = entry.metadata as { dashboard_metrics?: unknown } | null | undefined;
    const metrics = normalizeMetrics(meta?.dashboard_metrics);
    if (metrics.length === 0) continue;
    const date = entryTime(entry);
    const day = localDayKey(date, timeZone);
    for (const m of metrics) {
      points.push({ date, day, key: m.key, value: m.value, aggregate: m.aggregate, mode: m.mode, label: m.label, unit: m.unit, icon: m.icon });
    }
  }
  return points.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Value of one metric per day. Sum adds up, avg averages, last keeps the latest.
 * A `set` point replaces what came before it on that day.
 */
export function dailyValues(points: MetricPoint[], key: string): Map<string, number> {
  const k = canonicalKey(key);
  const perDay = new Map<string, { values: number[]; aggregate: Aggregate }>();
  const sorted = points.filter((p) => p.key === k && Number.isFinite(p.value)).sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const p of sorted) {
    const slot = perDay.get(p.day) ?? { values: [], aggregate: p.aggregate };
    slot.aggregate = p.aggregate;
    if (p.mode === 'set') slot.values = [p.value];
    else slot.values.push(p.value);
    perDay.set(p.day, slot);
  }
  const out = new Map<string, number>();
  for (const [day, { values, aggregate }] of perDay) {
    const v =
      aggregate === 'sum' ? values.reduce((a, b) => a + b, 0)
      : aggregate === 'avg' ? values.reduce((a, b) => a + b, 0) / values.length
      : values[values.length - 1];
    out.set(day, round(v));
  }
  return out;
}

export interface MetricTotal {
  key: string;
  label: string;
  value: number;
  unit: string;
  icon?: string;
  aggregate: Aggregate;
  /** Number of logged values that went into the total. */
  count: number;
  /** Number of days with a value. */
  days: number;
}

/**
 * Totals over a set of days: sum metrics add their daily totals, avg metrics average their
 * daily values, last metrics show the latest day. `days` limits the window (all days when omitted).
 */
export function totals(points: MetricPoint[], days?: Set<string>): MetricTotal[] {
  const inWindow = days ? points.filter((p) => days.has(p.day)) : points;
  const keys = [...new Set(inWindow.map((p) => p.key))];
  const result: MetricTotal[] = [];
  for (const key of keys) {
    const own = inWindow.filter((p) => p.key === key);
    const latest = own[own.length - 1];
    const perDay = dailyValues(own, key);
    const ordered = [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
    if (ordered.length === 0) continue;
    const value =
      latest.aggregate === 'sum' ? ordered.reduce((a, b) => a + b, 0)
      : latest.aggregate === 'avg' ? ordered.reduce((a, b) => a + b, 0) / ordered.length
      : ordered[ordered.length - 1];
    result.push({ key, label: latest.label, value: round(value), unit: latest.unit, icon: latest.icon, aggregate: latest.aggregate, count: own.length, days: ordered.length });
  }
  const order: Record<Aggregate, number> = { sum: 0, avg: 1, last: 2 };
  return result.sort((a, b) => order[a.aggregate] - order[b.aggregate] || a.key.localeCompare(b.key));
}

/** Totals for the day of `now` in `timeZone`. */
export function todayTotals(entries: MetricEntry[], now: Date, timeZone?: string): MetricTotal[] {
  return totals(collectPoints(entries, timeZone), new Set([localDayKey(now, timeZone)]));
}
