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

type PortionMode = "grams" | "pieces" | "both";

type FoodDefinition = {
  id: string;
  aliases: string[];
  per100g: MacroTotals;
  portionMode: PortionMode;
  pieceWeightG?: number;
};

type NutritionResolution = {
  confidence: "high" | "low" | "none";
  totals: MacroTotals;
  matchedFoods: string[];
  unresolvedTokens: string[];
};

type ParsedFoodCandidate = {
  query: string;
  grams: number;
};

type UsdaFoodNutrient = {
  nutrientName?: string;
  nutrientNumber?: string;
  unitName?: string;
  value?: number;
  amount?: number;
};

type UsdaFoodSearchResult = {
  description?: string;
  dataType?: string;
  foodNutrients?: UsdaFoodNutrient[];
};

const DEFAULT_METRICS: Record<string, Omit<NutritionMetric, "value">> = {
  kcal_intake: { key: "kcal_intake", label: "Calories", unit: "kcal", icon: "utensils", aggregate: "sum" },
  protein_g: { key: "protein_g", label: "Protein", unit: "g", icon: "beef", aggregate: "sum" },
  carbs_g: { key: "carbs_g", label: "Carbs", unit: "g", icon: "wheat", aggregate: "sum" },
  fat_g: { key: "fat_g", label: "Fat", unit: "g", icon: "droplets", aggregate: "sum" },
};

const FOOD_DEFINITIONS: FoodDefinition[] = [
  {
    id: "egg",
    aliases: ["egg", "eggs", "яйце", "яйця", "яєць", "яйцо", "яйца"],
    per100g: { kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
    portionMode: "both",
    pieceWeightG: 50,
  },
  {
    id: "fried_potato",
    aliases: [
      "fried potato", "fried potatoes", "roasted potato", "roasted potatoes",
      "смажена картопля", "смажену картоплю", "смаженої картоплі",
      "жареная картошка", "жареный картофель",
    ],
    per100g: { kcal: 312, protein: 3.4, carbs: 41, fat: 14.5 },
    portionMode: "both",
    pieceWeightG: 60,
  },
  {
    id: "chicken_breast",
    aliases: ["chicken breast", "chicken", "куряча грудка", "курка", "куриная грудка", "курица"],
    per100g: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
    portionMode: "grams",
  },
  {
    id: "rice_cooked",
    aliases: ["rice", "cooked rice", "рис", "отварной рис"],
    per100g: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
    portionMode: "grams",
  },
  {
    id: "buckwheat_cooked",
    aliases: ["buckwheat", "гречка", "гречка варена", "гречневая каша", "гречка отварная"],
    per100g: { kcal: 92, protein: 3.4, carbs: 20, fat: 0.6 },
    portionMode: "grams",
  },
  {
    id: "salmon",
    aliases: ["salmon", "лосось", "семга", "сьомга"],
    per100g: { kcal: 208, protein: 20, carbs: 0, fat: 13 },
    portionMode: "grams",
  },
  {
    id: "oats",
    aliases: ["oats", "oatmeal", "овес", "вівсянка", "овсянка"],
    per100g: { kcal: 389, protein: 17, carbs: 66, fat: 7 },
    portionMode: "grams",
  },
  {
    id: "beef",
    aliases: ["beef", "яловичина", "говядина"],
    per100g: { kcal: 250, protein: 26, carbs: 0, fat: 17 },
    portionMode: "grams",
  },
  {
    id: "banana",
    aliases: ["banana", "bananas", "банан", "банани", "бананів", "банан"],
    per100g: { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
    portionMode: "both",
    pieceWeightG: 120,
  },
];

const GRAM_UNIT_PATTERN = "(?:g|gr|gram|grams|kg|г|гр|кг)";
const NOISE_TOKENS = new Set([
  "a", "an", "and", "ate", "breakfast", "boiled", "by", "dinner", "for", "fried",
  "had", "i", "lunch", "meal", "my", "of", "roasted", "scrambled", "snack", "the", "with",
  "та", "і", "й", "з", "на", "це", "моя", "моє", "мій", "або", "с", "со",
  "з'їв", "зїїв", "зʼїв", "їв", "їла", "поїв", "поснідав", "обідав", "вечеряв", "перекус",
  "сніданок", "обід", "вечеря", "съел", "ела", "поел", "завтрак", "обед", "ужин",
]);

const SIGNIFICANT_TOKEN_RE = /[a-zа-яіїєґ]+/i;
const MACRO_KEYS = new Set(["kcal_intake", "protein_g", "carbs_g", "fat_g"]);

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function emptyTotals(): MacroTotals {
  return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
}

function addTotals(target: MacroTotals, source: MacroTotals): void {
  target.kcal += source.kcal;
  target.protein += source.protein;
  target.carbs += source.carbs;
  target.fat += source.fat;
}

function buildTotalsForGrams(food: FoodDefinition, grams: number): MacroTotals {
  const factor = grams / 100;
  return {
    kcal: food.per100g.kcal * factor,
    protein: food.per100g.protein * factor,
    carbs: food.per100g.carbs * factor,
    fat: food.per100g.fat * factor,
  };
}

function parseAmount(raw: string, unit: string): number {
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return 0;
  return unit === "kg" || unit === "кг" ? value * 1000 : value;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function clearMacroMetrics(metrics: NutritionMetric[]): NutritionMetric[] {
  return metrics.filter((metric) => !MACRO_KEYS.has(metric.key));
}

function trimResolvedText(content: string): string {
  return content
    .toLowerCase()
    .replace(/[.,/+()\-]/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\b/g, " ")
    .replace(new RegExp(`\\b${GRAM_UNIT_PATTERN}\\b`, "gi"), " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripNoiseTokens(tokens: string[]): string[] {
  return tokens.filter((token) => SIGNIFICANT_TOKEN_RE.test(token) && !NOISE_TOKENS.has(token));
}

function sanitizeFoodQuery(phrase: string): string {
  return stripNoiseTokens(
    phrase
      .toLowerCase()
      .replace(/[.,/+()\-]/g, " ")
      .replace(new RegExp(`\\b\\d+(?:[.,]\\d+)?\\s*${GRAM_UNIT_PATTERN}\\b`, "gi"), " ")
      .replace(/\b\d+\b/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
  ).join(" ");
}

function estimatePieceWeightFromPhrase(phrase: string, count: number): number | null {
  for (const food of FOOD_DEFINITIONS) {
    if (!food.pieceWeightG) continue;
    if (food.aliases.some((alias) => phrase.includes(alias.toLowerCase()))) {
      return food.pieceWeightG * count;
    }
  }
  return null;
}

function parseFoodCandidates(content: string): ParsedFoodCandidate[] {
  const parts = content
    .toLowerCase()
    .split(/\s*(?:,|&|\band\b|\bwith\b|\bта\b|\bі\b|\bй\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

  const candidates: ParsedFoodCandidate[] = [];

  for (const part of parts) {
    let grams: number | null = null;
    const gramMatch = part.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${GRAM_UNIT_PATTERN})\\b`, "i"));
    if (gramMatch) {
      grams = parseAmount(gramMatch[1], gramMatch[2].toLowerCase());
    } else {
      const countMatch = part.match(/^(\d+)\b/);
      if (countMatch) {
        grams = estimatePieceWeightFromPhrase(part, Number(countMatch[1]));
      }
    }

    const query = sanitizeFoodQuery(part);
    if (grams && grams > 0 && query.length > 0) {
      candidates.push({ query, grams });
    }
  }

  return candidates;
}

function resolveNutritionFromText(content: string): NutritionResolution {
  let working = content.toLowerCase();
  const totals = emptyTotals();
  const matchedFoods = new Set<string>();

  for (const food of FOOD_DEFINITIONS) {
    const sortedAliases = [...food.aliases].sort((a, b) => b.length - a.length);

    for (const alias of sortedAliases) {
      const escapedAlias = escapeRegex(alias);

      if (food.portionMode === "grams" || food.portionMode === "both") {
        const beforePattern = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${GRAM_UNIT_PATTERN})\\s*(?:of\\s+)?${escapedAlias}\\b`, "gi");
        const afterPattern = new RegExp(`${escapedAlias}\\b\\s*(\\d+(?:[.,]\\d+)?)\\s*(${GRAM_UNIT_PATTERN})`, "gi");

        working = working.replace(beforePattern, (_full, rawAmount: string, unit: string) => {
          const grams = parseAmount(rawAmount, unit.toLowerCase());
          if (grams > 0) {
            addTotals(totals, buildTotalsForGrams(food, grams));
            matchedFoods.add(food.id);
          }
          return " ";
        });

        working = working.replace(afterPattern, (_full, rawAmount: string, unit: string) => {
          const grams = parseAmount(rawAmount, unit.toLowerCase());
          if (grams > 0) {
            addTotals(totals, buildTotalsForGrams(food, grams));
            matchedFoods.add(food.id);
          }
          return " ";
        });
      }

      if ((food.portionMode === "pieces" || food.portionMode === "both") && food.pieceWeightG) {
        const countPattern = new RegExp(`(\\d+)\\s*(?:x\\s*)?(?:small\\s+|medium\\s+|large\\s+|boiled\\s+|fried\\s+|scrambled\\s+|roasted\\s+|варен(?:е|их|і)?\\s+|смажен(?:е|их|а|у|і)?\\s+|жарен(?:ое|ых|ая|ую)?\\s+)?${escapedAlias}\\b`, "gi");
        working = working.replace(countPattern, (_full, rawCount: string) => {
          const count = Number(rawCount);
          if (Number.isFinite(count) && count > 0) {
            addTotals(totals, buildTotalsForGrams(food, food.pieceWeightG! * count));
            matchedFoods.add(food.id);
          }
          return " ";
        });
      }
    }
  }

  const unresolvedTokens = stripNoiseTokens(trimResolvedText(working).split(" "));
  if (matchedFoods.size === 0) {
    return { confidence: "none", totals, matchedFoods: [], unresolvedTokens };
  }

  if (unresolvedTokens.length > 0) {
    return { confidence: "low", totals, matchedFoods: [...matchedFoods], unresolvedTokens };
  }

  return { confidence: "high", totals, matchedFoods: [...matchedFoods], unresolvedTokens: [] };
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
  const resolved = resolveNutritionFromText(content);

  nextMetadata.food_item = typeof nextMetadata.food_item === "string" && nextMetadata.food_item.trim().length > 0
    ? nextMetadata.food_item
    : content;

  if (resolved.confidence === "high") {
    const withoutMacros = clearMacroMetrics(nextMetrics);
    setMetric(withoutMacros, "kcal_intake", resolved.totals.kcal);
    setMetric(withoutMacros, "protein_g", resolved.totals.protein);
    setMetric(withoutMacros, "carbs_g", resolved.totals.carbs);
    setMetric(withoutMacros, "fat_g", resolved.totals.fat);
    nextMetadata.estimated_calories = round1(resolved.totals.kcal);
    nextMetadata.nutrition_confidence = "high";
    nextMetadata.nutrition_source = "deterministic";
    delete nextMetadata.nutrition_unresolved_tokens;
    return { metadata: nextMetadata, metrics: withoutMacros };
  }

  const aiHasMacros = nextMetrics.some((metric) => MACRO_KEYS.has(metric.key));
  if (resolved.confidence === "low" && aiHasMacros) {
    delete nextMetadata.estimated_calories;
    nextMetadata.nutrition_confidence = "low";
    nextMetadata.nutrition_source = "unresolved";
    nextMetadata.nutrition_unresolved_tokens = resolved.unresolvedTokens;
    return { metadata: nextMetadata, metrics: clearMacroMetrics(nextMetrics) };
  }

  if (resolved.confidence === "none" && aiHasMacros) {
    delete nextMetadata.estimated_calories;
    nextMetadata.nutrition_confidence = "low";
    nextMetadata.nutrition_source = "unresolved";
    return { metadata: nextMetadata, metrics: clearMacroMetrics(nextMetrics) };
  }

  const kcalMetric = getMetric(nextMetrics, "kcal_intake");
  if (kcalMetric) {
    nextMetadata.estimated_calories = round1(kcalMetric.value);
    nextMetadata.nutrition_confidence = "low";
    nextMetadata.nutrition_source = "ai_estimate";
  } else {
    delete nextMetadata.estimated_calories;
    nextMetadata.nutrition_confidence = "low";
    nextMetadata.nutrition_source = "unresolved";
  }

  return { metadata: nextMetadata, metrics: nextMetrics };
}

function getUsdaApiKey(): string | null {
  const key = process.env.USDA_FDC_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

function getUsdaNutrientValue(food: UsdaFoodSearchResult, keys: string[]): number | null {
  const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  for (const nutrient of nutrients) {
    const nutrientName = nutrient.nutrientName?.toLowerCase() ?? "";
    const nutrientNumber = nutrient.nutrientNumber ?? "";
    const unitName = nutrient.unitName?.toUpperCase() ?? "";
    const numericValue = typeof nutrient.value === "number"
      ? nutrient.value
      : typeof nutrient.amount === "number"
        ? nutrient.amount
        : null;
    if (numericValue === null) continue;
    if (keys.includes(nutrientNumber)) return numericValue;
    if (keys.includes(nutrientName)) {
      if (keys.includes("208") && unitName && unitName !== "KCAL") continue;
      return numericValue;
    }
  }
  return null;
}

function extractPer100gFromUsda(food: UsdaFoodSearchResult): MacroTotals | null {
  const kcal = getUsdaNutrientValue(food, ["208", "energy"]);
  const protein = getUsdaNutrientValue(food, ["203", "protein"]);
  const carbs = getUsdaNutrientValue(food, ["205", "carbohydrate, by difference"]);
  const fat = getUsdaNutrientValue(food, ["204", "total lipid (fat)"]);

  if ([kcal, protein, carbs, fat].some((value) => value === null)) return null;
  return {
    kcal: kcal!,
    protein: protein!,
    carbs: carbs!,
    fat: fat!,
  };
}

function scoreUsdaFoodResult(food: UsdaFoodSearchResult, query: string): number {
  const dataType = (food.dataType ?? "").toLowerCase();
  const description = (food.description ?? "").toLowerCase();
  const queryTokens = query.split(" ").filter(Boolean);

  let score = 0;
  if (dataType.includes("foundation")) score += 50;
  else if (dataType.includes("sr legacy")) score += 40;
  else if (dataType.includes("survey")) score += 30;
  else if (dataType.includes("branded")) score -= 50;

  if (description === query) score += 20;
  for (const token of queryTokens) {
    if (description.includes(token)) score += 5;
  }

  return score;
}

async function fetchUsdaSearchResults(query: string): Promise<UsdaFoodSearchResult[]> {
  const apiKey = getUsdaApiKey();
  if (!apiKey) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, pageSize: 5 }),
      signal: controller.signal,
    });

    if (!response.ok) return [];
    const json = await response.json() as { foods?: UsdaFoodSearchResult[] };
    return Array.isArray(json.foods) ? json.foods : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveUsdaCandidate(candidate: ParsedFoodCandidate): Promise<MacroTotals | null> {
  const foods = await fetchUsdaSearchResults(candidate.query);
  if (foods.length === 0) return null;

  const best = [...foods]
    .sort((a, b) => scoreUsdaFoodResult(b, candidate.query) - scoreUsdaFoodResult(a, candidate.query))[0];

  if (!best || scoreUsdaFoodResult(best, candidate.query) < 20) return null;

  const per100 = extractPer100gFromUsda(best);
  if (!per100) return null;
  return buildTotalsForGrams({
    id: "usda",
    aliases: [],
    per100g: per100,
    portionMode: "grams",
  }, candidate.grams);
}

export async function resolveCalorieMetrics(
  content: string,
  metadata: Metadata,
  metrics: Record<string, unknown>[]
): Promise<{ metadata: Metadata; metrics: NutritionMetric[] }> {
  const local = applyCalorieCorrections(content, metadata, metrics);
  if (local.metadata.nutrition_source === "deterministic") {
    return local;
  }

  const candidates = parseFoodCandidates(content);
  if (candidates.length === 0) {
    return local;
  }

  const resolved = await Promise.all(candidates.map(resolveUsdaCandidate));
  if (resolved.some((item) => item === null)) {
    return local;
  }

  const totals = emptyTotals();
  for (const item of resolved) {
    addTotals(totals, item!);
  }

  const nextMetrics = clearMacroMetrics(local.metrics);
  setMetric(nextMetrics, "kcal_intake", totals.kcal);
  setMetric(nextMetrics, "protein_g", totals.protein);
  setMetric(nextMetrics, "carbs_g", totals.carbs);
  setMetric(nextMetrics, "fat_g", totals.fat);

  return {
    metadata: {
      ...local.metadata,
      estimated_calories: round1(totals.kcal),
      nutrition_confidence: "high",
      nutrition_source: "usda_fdc",
      food_item: typeof local.metadata.food_item === "string" ? local.metadata.food_item : content,
    },
    metrics: nextMetrics,
  };
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

export function getMetricValueByKey(
  metadata: Metadata | null | undefined,
  key: string
): number | null {
  const dashboardMetrics = Array.isArray(metadata?.dashboard_metrics)
    ? (metadata?.dashboard_metrics as NutritionMetric[])
    : [];
  const metric = dashboardMetrics.find((item) => item.key === key);
  return metric && Number.isFinite(metric.value) ? Number(metric.value) : null;
}
