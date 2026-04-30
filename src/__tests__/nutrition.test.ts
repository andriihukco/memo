import { describe, expect, it } from "vitest";

import { applyCalorieCorrections, getKcalIntakeFromMetadata } from "@/lib/nutrition";

describe("nutrition helpers", () => {
  it("normalizes count-based eggs and fried potato meals", () => {
    const corrected = applyCalorieCorrections(
      "2 boiled eggs and 1 fried potato",
      { food_item: "2 boiled eggs and 1 fried potato", estimated_calories: 872 },
      [
        { key: "kcal_intake", label: "Calories", value: 872, unit: "kcal", icon: "utensils", aggregate: "sum" },
        { key: "protein_g", label: "Protein", value: 31, unit: "g", icon: "beef", aggregate: "sum" },
        { key: "carbs_g", label: "Carbs", value: 43, unit: "g", icon: "wheat", aggregate: "sum" },
        { key: "fat_g", label: "Fat", value: 36, unit: "g", icon: "droplets", aggregate: "sum" },
      ]
    );

    expect(corrected.metadata.estimated_calories).toBe(336);
    expect(corrected.metrics.find((metric) => metric.key === "kcal_intake")?.value).toBe(336);
    expect(corrected.metrics.find((metric) => metric.key === "protein_g")?.value).toBe(16.2);
    expect(corrected.metrics.find((metric) => metric.key === "carbs_g")?.value).toBe(28.2);
    expect(corrected.metrics.find((metric) => metric.key === "fat_g")?.value).toBe(17.6);
  });

  it("prefers dashboard kcal_intake over stale estimated_calories", () => {
    const total = getKcalIntakeFromMetadata({
      estimated_calories: 872,
      dashboard_metrics: [
        { key: "kcal_intake", label: "Calories", value: 336, unit: "kcal", icon: "utensils", aggregate: "sum" },
      ],
    });

    expect(total).toBe(336);
  });
});
