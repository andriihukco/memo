import { afterEach, describe, expect, it, vi } from "vitest";

import { applyCalorieCorrections, getKcalIntakeFromMetadata, resolveCalorieMetrics } from "@/lib/nutrition";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.USDA_FDC_API_KEY;
});

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

    expect(corrected.metadata.estimated_calories).toBe(342.2);
    expect(corrected.metrics.find((metric) => metric.key === "kcal_intake")?.value).toBe(342.2);
    expect(corrected.metrics.find((metric) => metric.key === "protein_g")?.value).toBe(15);
    expect(corrected.metrics.find((metric) => metric.key === "carbs_g")?.value).toBe(25.7);
    expect(corrected.metrics.find((metric) => metric.key === "fat_g")?.value).toBe(19.7);
    expect(corrected.metadata.nutrition_source).toBe("deterministic");
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

  it("drops AI macro estimates for ambiguous meals", () => {
    const corrected = applyCalorieCorrections(
      "big bowl of pasta and sauce",
      { food_item: "big bowl of pasta and sauce", estimated_calories: 780 },
      [
        { key: "kcal_intake", label: "Calories", value: 780, unit: "kcal", icon: "utensils", aggregate: "sum" },
        { key: "protein_g", label: "Protein", value: 21, unit: "g", icon: "beef", aggregate: "sum" },
      ]
    );

    expect(corrected.metrics.find((metric) => metric.key === "kcal_intake")).toBeUndefined();
    expect(corrected.metadata.estimated_calories).toBeUndefined();
    expect(corrected.metadata.nutrition_source).toBe("unresolved");
  });

  it("calculates explicit gram-based common foods deterministically", () => {
    const corrected = applyCalorieCorrections(
      "200g chicken breast and 50g rice",
      {},
      []
    );

    expect(corrected.metrics.find((metric) => metric.key === "kcal_intake")?.value).toBe(395);
    expect(corrected.metrics.find((metric) => metric.key === "protein_g")?.value).toBe(63.4);
    expect(corrected.metrics.find((metric) => metric.key === "carbs_g")?.value).toBe(14);
    expect(corrected.metrics.find((metric) => metric.key === "fat_g")?.value).toBe(7.4);
  });

  it("uses USDA as a fallback for explicit gram-based foods outside the local table", async () => {
    process.env.USDA_FDC_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        foods: [
          {
            description: "Avocados, raw, all commercial varieties",
            dataType: "Foundation",
            foodNutrients: [
              { nutrientNumber: "208", unitName: "KCAL", value: 160 },
              { nutrientNumber: "203", unitName: "G", value: 2 },
              { nutrientNumber: "205", unitName: "G", value: 8.5 },
              { nutrientNumber: "204", unitName: "G", value: 14.7 },
            ],
          },
        ],
      }),
    }));

    const corrected = await resolveCalorieMetrics("100g avocado", {}, []);

    expect(corrected.metadata.nutrition_source).toBe("usda_fdc");
    expect(corrected.metrics.find((metric) => metric.key === "kcal_intake")?.value).toBe(160);
    expect(corrected.metrics.find((metric) => metric.key === "protein_g")?.value).toBe(2);
    expect(corrected.metrics.find((metric) => metric.key === "carbs_g")?.value).toBe(8.5);
    expect(corrected.metrics.find((metric) => metric.key === "fat_g")?.value).toBe(14.7);
  });
});
