/**
 * Fixed rules applied after the model extracts metrics, so the same words always give the same
 * numbers on the bot and the web: water servings are counted here, not guessed by the model,
 * and every metric is put into canonical form (see src/lib/metrics.ts).
 */
import { normalizeMetrics, type Metric, type RawMetric } from './metrics';

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  half: 0.5, couple: 2,
  один: 1, одна: 1, одну: 1, одне: 1, два: 2, дві: 2, три: 3, чотири: 4, "п'ять": 5, "п’ять": 5, шість: 6, сім: 7, вісім: 8,
  пів: 0.5, півтори: 1.5, півтора: 1.5,
};

const NUM = String.raw`(\d+(?:[.,]\d+)?|[\p{L}'’]+)`;
const CONTAINER = String.raw`(glass(?:es)?|cups?|bottles?|склян\p{L}*|стакан\p{L}*|чаш\p{L}*|пляш\p{L}*)`;
const VOLUME = String.raw`(ml|мл|l|л|liters?|litres?|літр\p{L}*)`;
const WATER = String.raw`(?:water|вод\p{L}*)`;
const END = String.raw`(?![\p{L}])`;

const SERVING_ML: Array<[RegExp, number]> = [
  [/^(glass|cup|склян|стакан|чаш)/u, 250],
  [/^(bottle|пляш)/u, 500],
];
const VOLUME_ML: Array<[RegExp, number]> = [
  [/^(ml|мл)$/u, 1],
  [/^(l|л|liters?|litres?|літр\p{L}*)$/u, 1000],
];

function readNumber(token: string | undefined): number | null {
  if (!token) return 1;
  const n = Number(token.replace(',', '.'));
  if (Number.isFinite(n)) return n;
  const word = NUMBER_WORDS[token.toLowerCase()];
  return word ?? null;
}

/**
 * Millilitres of water mentioned in `text`, or null when none is mentioned in a countable way.
 * "2 glasses of water" = 500, "склянку води" = 250, "1.5 л води" = 1500, "water 500ml" = 500.
 * Coffee or tea cups are not water and are not counted.
 */
export function waterMl(text: string): number | null {
  let rest = ` ${text.toLowerCase()} `;
  let total = 0;
  let found = false;

  const take = (re: RegExp, toMl: (m: RegExpExecArray) => number | null) => {
    rest = rest.replace(re, (...args) => {
      const match = args.slice(0, -2) as unknown as RegExpExecArray;
      const ml = toMl(match);
      if (ml === null) return match[0];
      total += ml;
      found = true;
      return ' ';
    });
  };

  // "2 glasses of (cold) water", "дві склянки (теплої) води", "a bottle of water"
  take(new RegExp(String.raw`(?:${NUM}\s+)?${CONTAINER}\s+(?:of\s+)?(?:[\p{L}]+\s+)?${WATER}${END}`, 'gu'), (m) => {
    const count = readNumber(m[1]);
    const serving = SERVING_ML.find(([re]) => re.test(m[2]))?.[1];
    if (count === null) {
      // The word before the container is not a number ("drank glass of water"): one serving.
      return serving ?? null;
    }
    return serving ? count * serving : null;
  });
  // "500 ml (of) water", "1,5 л води"
  take(new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s*${VOLUME}${END}\s+(?:of\s+)?(?:[\p{L}]+\s+)?${WATER}${END}`, 'gu'), (m) => {
    const factor = VOLUME_ML.find(([re]) => re.test(m[2]))?.[1];
    return factor ? Number(m[1].replace(',', '.')) * factor : null;
  });
  // "water 500 ml", "води: 2 л", "water — 3 glasses"
  take(new RegExp(String.raw`${WATER}\s*[:\-–—]?\s*(\d+(?:[.,]\d+)?)\s*(${VOLUME.slice(1, -1)}|${CONTAINER.slice(1, -1)})${END}`, 'gu'), (m) => {
    const n = Number(m[1].replace(',', '.'));
    const unit = m[2];
    const factor = VOLUME_ML.find(([re]) => re.test(unit))?.[1] ?? SERVING_ML.find(([re]) => re.test(unit))?.[1];
    return factor ? n * factor : null;
  });

  return found && total > 0 ? Math.round(total) : null;
}

/** Applies the fixed water rule, then puts every metric into canonical form. */
export function finalizeMetrics(content: string, metrics: unknown, locale = 'en'): Metric[] {
  const list = (Array.isArray(metrics) ? metrics : []) as RawMetric[];
  const water = waterMl(content);
  if (water === null) return normalizeMetrics(list, locale);
  const normalized = normalizeMetrics(list, locale).filter((m) => m.key !== 'water_ml');
  const [waterMetric] = normalizeMetrics([{ key: 'water_ml', value: water, unit: 'ml' }], locale);
  return [...normalized, waterMetric];
}

/** Category a correction lands in when it creates its own entry. */
export function categoryForMetric(key: string): string {
  if (['kcal_intake', 'protein_g', 'carbs_g', 'fat_g', 'sugar_g'].includes(key)) return 'calories';
  if (['sleep_hours', 'sleep_quality'].includes(key)) return 'sleep';
  if (['mood_score', 'stress_level', 'energy_level'].includes(key)) return 'mood';
  if (['steps_count', 'distance_km', 'active_min', 'kcal_burned'].includes(key)) return 'sport';
  return 'health';
}
