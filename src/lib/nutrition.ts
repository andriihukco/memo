export type NutritionMetric = {
  key: string;
  label: string;
  value: number;
  unit: string;
  icon?: string;
  aggregate: "sum" | "avg" | "last";
};

type Metadata = Record<string, unknown>;

type MacroTotals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

const DEFAULT_METRICS: Record<string, Omit<NutritionMetric, "value">> = {
  kcal_intake: { key: "kcal_intake", label: "Calories", unit: "kcal", icon: "utensils", aggregate: "sum" },
  protein_g: { key: "protein_g", label: "Protein", unit: "g", icon: "beef", aggregate: "sum" },
  carbs_g: { key: "carbs_g", label: "Carbs", unit: "g", icon: "wheat", aggregate: "sum" },
  fat_g: { key: "fat_g", label: "Fat", unit: "g", icon: "droplets", aggregate: "sum" },
};

const COUNT_BASED_PORTIONS = [
  {
    name: "egg",
    pattern: /(\d+)\s*(?:x\s*)?(?:boiled\s+|fried\s+|scrambled\s+|варен(?:е|их)?\s+|смажен(?:е|их)?\s+)?(?:eggs?|яйц(?:е|я|яйця|яєць))/gi,
    perUnit: { kcal: 78, protein: 6.3, carbs: 0.6, fat: 5.3 },
  },
  {
    name: "fried potato",
    pattern: /(\d+)\s*(?:x\s*)?(?:(?:fried|roasted)\s+potato(?:es)?|смажен(?:а|ої|у|і)?\s+картопл(?:я|і|ю|ею|і))/gi,
    perUnit: { kcal: 180, protein: 3.6, carbs: 27, fat: 7 },
  },
];

const GRAM_BASED_UNITS = /\b\d+(?:[.,]\d+)?\s*(?:g|gr|gram|grams|kg|ml|мл|г|гр|кг)\b/i;
const NOISE_TOKENS = /\b(?:i|and|with|ate|had|for|my|the|a|an|meal|breakfast|lunch|dinner|snack|boiled|fried|scrambled|roasted|та|і|й|з|на|це|моя|моє|мій|з'їв|зїїв|зʼїв|їв|їла|поїв|поснідав|обідав|вечеряв|перекус|сніданок|обід|вечеря)\b/gi;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeMetric(metric: Record<string, unknown>): NutritionMetric | null {
  if (
    typeof metric.key !== "string" ||
    typeof metric.label !== "string" ||
    typeof metric.value !== "number" ||
    typeof metric.unit !== "string"
  ) {
    return null;
  }

  return {
    key: metric.key,
    label: metric.label,
    value: metric.value,
    unit: metric.unit,
    icon: typeof metric.icon === "string" ? metric.icon : undefined,
    aggregate: metric.aggregate === "avg" || metric.aggregate === "last" ? metric.aggregate : "sum",
  };
}

function getMetric(metrics: NutritionMetric[], key: string): NutritionMetric | undefined {
  return metrics.find((metric) => metric.key === key);
}

function setMetric(metrics: NutritionMetric[], key: keyof typeof DEFAULT_METRICS, value: number): void {
  const existing = getMetric(metrics, key);
  const roundedValue = round1(value);
  if (existing) {
    existing.value = roundedValue;
    existing.unit = existing.unit || DEFAULT_METRICS[key].unit;
    existing.icon = existing.icon || DEFAULT_METRICS[key].icon;
    existing.aggregate = existing.aggregate || DEFAULT_METRICS[key].aggregate;
    existing.label = existing.label || DEFAULT_METRICS[key].label;
    return;
  }

  metrics.push({
    ...DEFAULT_METRICS[key],
    value: roundedValue,
  });
}

function extractCountBasedTotals(content: string): { totals: MacroTotals; supportedOnly: boolean } | null {
  if (GRAM_BASED_UNITS.test(content)) return null;

  let matchedAny = false;
  let stripped = content.toLowerCase();
  const totals: MacroTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

  for (const portion of COUNT_BASED_PORTIONS) {
    stripped = stripped.replace(portion.pattern, (_, rawCount: string) => {
      const count = Number(rawCount);
      if (!Number.isFinite(count) || count <= 0) return " ";
      matchedAny = true;
      totals.kcal += portion.perUnit.kcal * count;
      totals.protein += portion.perUnit.protein * count;
      totals.carbs += portion.perUnit.carbs * count;
      totals.fat += portion.perUnit.fat * count;
      return " ";
    });
  }

  if (!matchedAny) return null;

  const residue = stripped
    .replace(NOISE_TOKENS, " ")
    .replace(/[0-9.,/+()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    totals,
    supportedOnly: residue.length === 0,
  };
}

export function applyCalorieCorrections(
  content: string,
  metadata: Metadata,
  metrics: Record<string, unknown>[]
): { metadata: Metadata; metrics: NutritionMetric[] } {
  const nextMetrics = metrics
    .map((metric) => normalizeMetric(metric))
    .filter((metric): metric is NutritionMetric => metric !== null);
  const nextMetadata = { ...metadata };
  const deterministic = extractCountBasedTotals(content);

  if (deterministic?.supportedOnly) {
    setMetric(nextMetrics, "kcal_intake", deterministic.totals.kcal);
    setMetric(nextMetrics, "protein_g", deterministic.totals.protein);
    setMetric(nextMetrics, "carbs_g", deterministic.totals.carbs);
    setMetric(nextMetrics, "fat_g", deterministic.totals.fat);
  }

  const kcalMetric = getMetric(nextMetrics, "kcal_intake");
  if (kcalMetric) {
    nextMetadata.estimated_calories = round1(kcalMetric.value);
  }

  if (typeof nextMetadata.food_item !== "string" || nextMetadata.food_item.trim().length === 0) {
    nextMetadata.food_item = content;
  }

  return { metadata: nextMetadata, metrics: nextMetrics };
}

export function getKcalIntakeFromMetadata(metadata: Metadata | null | undefined): number {
  const dashboardMetrics = Array.isArray(metadata?.dashboard_metrics)
    ? (metadata?.dashboard_metrics as NutritionMetric[])
    : [];
  const kcalMetric = dashboardMetrics.find((metric) => metric.key === "kcal_intake");
  if (kcalMetric && Number.isFinite(kcalMetric.value)) {
    return Number(kcalMetric.value);
  }

  const estimatedCalories = Number(metadata?.estimated_calories ?? 0);
  return Number.isFinite(estimatedCalories) ? estimatedCalories : 0;
}
