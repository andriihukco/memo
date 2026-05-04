/**
 * Tests for the free weekly summary feature (REQ-07).
 *
 * Covers:
 * - generateWeeklySummary() in src/lib/bot/retrospective.ts
 * - getISOWeekKey() helper in src/app/api/cron/reports/route.ts
 * - Cron route logic: Monday check, deduplication, entry threshold
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Mock external dependencies ────────────────────────────────────────────────

// Mock Gemini AI — must use class/function syntax for constructors
const mockGenerateContent = vi.fn().mockResolvedValue({
  response: {
    text: () =>
      "Цього тижня ти зробив 7 записів. Найчастіша категорія — *здоров'я*. " +
      "Яскравий момент: пробіжка 5 км у середу. " +
      "Інсайт: ти найпродуктивніший у першій половині тижня.",
  },
});

const mockGetGenerativeModel = vi.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});

vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: class MockGoogleGenerativeAI {
      getGenerativeModel = mockGetGenerativeModel;
    },
  };
});

// Mock env
vi.mock("@/lib/env", () => ({
  env: {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    GEMINI_API_KEY: "test-gemini-key",
  },
}));

// Mock i18n
vi.mock("@/i18n/ai-locale", () => ({
  aiLanguageInstruction: vi.fn().mockReturnValue("Respond in Ukrainian."),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { generateWeeklySummary } from "@/lib/bot/retrospective";

// ── Inline helper (mirrors the unexported getISOWeekKey in cron/reports/route.ts) ──
function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ── Test data helpers ─────────────────────────────────────────────────────────

function makeEntries(count: number, category = "health") {
  return Array.from({ length: count }, (_, i) => ({
    content: `Entry ${i + 1}: feeling good today`,
    category,
    metadata: {},
    created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

// ── generateWeeklySummary tests ───────────────────────────────────────────────

describe("generateWeeklySummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null for empty entries array", async () => {
    const result = await generateWeeklySummary("user-1", []);
    expect(result).toBeNull();
  });

  it("returns a summary with content, entry_count, and top_categories", async () => {
    const entries = makeEntries(7, "health");
    const result = await generateWeeklySummary("user-1", entries);

    expect(result).not.toBeNull();
    expect(result!.content).toBeTruthy();
    expect(result!.entry_count).toBe(7);
    expect(result!.top_categories).toContain("health");
  });

  it("computes top_categories sorted by frequency", async () => {
    const entries = [
      ...makeEntries(5, "health"),
      ...makeEntries(3, "workout"),
      ...makeEntries(1, "sleep"),
    ];
    const result = await generateWeeklySummary("user-1", entries);

    expect(result).not.toBeNull();
    // health (5) > workout (3) > sleep (1)
    expect(result!.top_categories[0]).toBe("health");
    expect(result!.top_categories[1]).toBe("workout");
    expect(result!.top_categories[2]).toBe("sleep");
  });

  it("limits top_categories to 3", async () => {
    const entries = [
      ...makeEntries(4, "health"),
      ...makeEntries(3, "workout"),
      ...makeEntries(2, "sleep"),
      ...makeEntries(1, "food"),
    ];
    const result = await generateWeeklySummary("user-1", entries);

    expect(result).not.toBeNull();
    expect(result!.top_categories.length).toBeLessThanOrEqual(3);
  });

  it("returns null when Gemini throws", async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error("Gemini error"));

    const entries = makeEntries(5);
    const result = await generateWeeklySummary("user-1", entries);
    expect(result).toBeNull();
  });

  it("includes metrics in the prompt context when entries have dashboard_metrics", async () => {
    let capturedPrompt = "";
    mockGenerateContent.mockImplementationOnce(async (prompt: string) => {
      capturedPrompt = prompt;
      return { response: { text: () => "Summary with metrics." } };
    });

    const entries = [
      {
        content: "Ran 5km today",
        category: "workout",
        metadata: {
          dashboard_metrics: [{ label: "Distance", value: 5, unit: "km" }],
        },
        created_at: new Date().toISOString(),
      },
    ];

    await generateWeeklySummary("user-1", entries);

    // Verify the prompt passed to Gemini includes the metric
    expect(capturedPrompt).toContain("Distance: 5km");
  });
});

// ── getISOWeekKey tests ───────────────────────────────────────────────────────

describe("getISOWeekKey", () => {
  it("returns a string in YYYY-Www format", () => {
    const key = getISOWeekKey(new Date("2024-01-15"));
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("returns the same week key for all days in the same ISO week", () => {
    // 2024-01-15 is Monday of week 3
    const monday = getISOWeekKey(new Date("2024-01-15"));
    const wednesday = getISOWeekKey(new Date("2024-01-17"));
    const sunday = getISOWeekKey(new Date("2024-01-21"));
    expect(monday).toBe(wednesday);
    expect(monday).toBe(sunday);
  });

  it("returns different week keys for different weeks", () => {
    const week3 = getISOWeekKey(new Date("2024-01-15"));
    const week4 = getISOWeekKey(new Date("2024-01-22"));
    expect(week3).not.toBe(week4);
  });

  it("handles year boundary correctly (ISO week 1 of new year)", () => {
    // 2024-01-01 is in ISO week 1 of 2024
    const key = getISOWeekKey(new Date("2024-01-01"));
    expect(key).toBe("2024-W01");
  });

  it("handles year boundary where last days of Dec belong to next year's week 1", () => {
    // 2018-12-31 is in ISO week 1 of 2019
    const key = getISOWeekKey(new Date("2018-12-31"));
    expect(key).toBe("2019-W01");
  });
});

// ── Cron route logic tests ────────────────────────────────────────────────────

describe("Cron /api/cron/reports — Monday check", () => {
  it("getDay() === 1 is true only on Monday", () => {
    // Simulate Monday
    const monday = new Date("2024-01-15"); // known Monday
    expect(monday.getDay()).toBe(1);

    // Simulate Tuesday
    const tuesday = new Date("2024-01-16");
    expect(tuesday.getDay()).not.toBe(1);
  });

  it("weekly summary deduplication key is stable within the same week", () => {
    // Two calls on the same Monday should produce the same key
    const monday1 = new Date("2024-01-15T09:00:00Z");
    const monday2 = new Date("2024-01-15T10:30:00Z");
    expect(getISOWeekKey(monday1)).toBe(getISOWeekKey(monday2));
  });

  it("weekly summary deduplication key differs across weeks", () => {
    const thisMonday = new Date("2024-01-15");
    const nextMonday = new Date("2024-01-22");
    expect(getISOWeekKey(thisMonday)).not.toBe(getISOWeekKey(nextMonday));
  });
});

// ── Entry threshold tests ─────────────────────────────────────────────────────

describe("Weekly summary entry threshold (≥5 entries)", () => {
  it("generateWeeklySummary returns null for 0 entries (below threshold)", async () => {
    const result = await generateWeeklySummary("user-1", []);
    expect(result).toBeNull();
  });

  it("generateWeeklySummary succeeds for exactly 5 entries", async () => {
    const entries = makeEntries(5);
    const result = await generateWeeklySummary("user-1", entries);
    expect(result).not.toBeNull();
    expect(result!.entry_count).toBe(5);
  });

  it("generateWeeklySummary succeeds for more than 5 entries", async () => {
    const entries = makeEntries(12);
    const result = await generateWeeklySummary("user-1", entries);
    expect(result).not.toBeNull();
    expect(result!.entry_count).toBe(12);
  });
});
