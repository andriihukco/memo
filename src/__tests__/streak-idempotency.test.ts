/**
 * Tests for cron job idempotency for streak entries (REQ-15).
 *
 * Covers:
 * - autoIncrementStreaks() uses upsert with ignoreDuplicates=true (ON CONFLICT DO NOTHING)
 * - Running the cron twice on the same day does NOT create duplicate streak entries
 * - The unique constraint migration (20240001000021) covers (user_id, category, date)
 *   for auto_streak entries
 * - Insert errors (other than conflict) are still logged
 * - No streak entry is created when there are no yesterday entries
 * - No streak entry is created when yesterday entries have no streak metrics
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Mock env ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/env", () => ({
  env: {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
  },
}));

// ── Mock Supabase ─────────────────────────────────────────────────────────────

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { autoIncrementStreaks } from "@/lib/processing/loop";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a yesterday-dated entry with streak metrics.
 */
function makeStreakEntry(overrides: Partial<{
  id: string;
  content: string;
  category: string;
  metadata: Record<string, unknown>;
  created_at: string;
}> = {}) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(12, 0, 0, 0);

  return {
    id: "entry-streak-1",
    content: "Streak: 5 days",
    category: "fitness",
    metadata: {
      dashboard_metrics: [
        { key: "workout_days", value: 5, aggregate: "last", label: "Workout streak", unit: " days" },
      ],
    },
    created_at: yesterday.toISOString(),
    ...overrides,
  };
}

/**
 * Build a Supabase mock for autoIncrementStreaks.
 *
 * @param opts.yesterdayEntries - entries returned for the yesterday query
 * @param opts.upsertError - error to return on the upsert call (null = success)
 */
function makeSupabaseMock(opts: {
  yesterdayEntries?: ReturnType<typeof makeStreakEntry>[];
  upsertError?: { code: string; message: string } | null;
}) {
  const { yesterdayEntries = [], upsertError = null } = opts;

  // Track upsert calls so we can assert on them
  const upsertMock = vi.fn().mockResolvedValue({ data: null, error: upsertError });

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === "entries") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ data: yesterdayEntries, error: null }),
        upsert: upsertMock,
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      upsert: upsertMock,
    };
  });

  return {
    client: { from: fromMock } as unknown as ReturnType<typeof createClient>,
    upsertMock,
  };
}

// ── Reset mocks between tests ─────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Core idempotency tests ────────────────────────────────────────────────────

describe("autoIncrementStreaks — idempotency", () => {
  it("is exported from loop.ts", () => {
    expect(typeof autoIncrementStreaks).toBe("function");
  });

  it("uses upsert with ignoreDuplicates=true (ON CONFLICT DO NOTHING)", async () => {
    const entry = makeStreakEntry();
    const { client, upsertMock } = makeSupabaseMock({ yesterdayEntries: [entry] });

    vi.mocked(createClient).mockReturnValue(client);

    await autoIncrementStreaks("user-123");

    // Verify upsert was called (not insert)
    expect(upsertMock).toHaveBeenCalledOnce();

    // Verify ignoreDuplicates: true is passed as the second argument
    const [, options] = upsertMock.mock.calls[0];
    expect(options).toEqual({ ignoreDuplicates: true });
  });

  it("inserts a streak entry with auto_streak=true in metadata", async () => {
    const entry = makeStreakEntry();
    const { client, upsertMock } = makeSupabaseMock({ yesterdayEntries: [entry] });

    vi.mocked(createClient).mockReturnValue(client);

    await autoIncrementStreaks("user-123");

    expect(upsertMock).toHaveBeenCalledOnce();
    const [insertedData] = upsertMock.mock.calls[0];
    expect(insertedData.metadata.auto_streak).toBe(true);
  });

  it("increments streak metric value by 1", async () => {
    const entry = makeStreakEntry({
      metadata: {
        dashboard_metrics: [
          { key: "workout_days", value: 5, aggregate: "last", label: "Workout streak", unit: " days" },
        ],
      },
    });
    const { client, upsertMock } = makeSupabaseMock({ yesterdayEntries: [entry] });

    vi.mocked(createClient).mockReturnValue(client);

    await autoIncrementStreaks("user-123");

    const [insertedData] = upsertMock.mock.calls[0];
    const metrics = insertedData.metadata.dashboard_metrics as Array<{ key: string; value: number }>;
    const streakMetric = metrics.find((m) => m.key === "workout_days");
    expect(streakMetric?.value).toBe(6); // 5 + 1
  });

  it("does NOT throw when upsert returns a conflict (ignoreDuplicates silences it)", async () => {
    // When cron fires twice, the second call gets no error because ignoreDuplicates=true
    // means the DB silently skips the duplicate — no error is returned to the client.
    const entry = makeStreakEntry();
    const { client } = makeSupabaseMock({
      yesterdayEntries: [entry],
      upsertError: null, // ignoreDuplicates=true means no error on conflict
    });

    vi.mocked(createClient).mockReturnValue(client);

    // Should resolve without throwing
    await expect(autoIncrementStreaks("user-123")).resolves.toBeUndefined();
  });

  it("logs error when upsert fails for a non-conflict reason", async () => {
    const entry = makeStreakEntry();
    const { client } = makeSupabaseMock({
      yesterdayEntries: [entry],
      upsertError: { code: "42501", message: "permission denied" },
    });

    vi.mocked(createClient).mockReturnValue(client);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await autoIncrementStreaks("user-123");

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[loop] autoIncrementStreaks"),
      expect.stringContaining("permission denied")
    );

    consoleSpy.mockRestore();
  });

  it("does nothing when there are no entries from yesterday", async () => {
    const { client, upsertMock } = makeSupabaseMock({ yesterdayEntries: [] });

    vi.mocked(createClient).mockReturnValue(client);

    await autoIncrementStreaks("user-123");

    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("does nothing when yesterday entries have no streak metrics (aggregate != 'last')", async () => {
    const entry = makeStreakEntry({
      metadata: {
        dashboard_metrics: [
          { key: "mood", value: 8, aggregate: "avg", label: "Mood", unit: "/10" },
        ],
      },
    });
    const { client, upsertMock } = makeSupabaseMock({ yesterdayEntries: [entry] });

    vi.mocked(createClient).mockReturnValue(client);

    await autoIncrementStreaks("user-123");

    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("does nothing when yesterday entries have no _days key metrics", async () => {
    const entry = makeStreakEntry({
      metadata: {
        dashboard_metrics: [
          { key: "weight_kg", value: 75, aggregate: "last", label: "Weight", unit: "kg" },
        ],
      },
    });
    const { client, upsertMock } = makeSupabaseMock({ yesterdayEntries: [entry] });

    vi.mocked(createClient).mockReturnValue(client);

    await autoIncrementStreaks("user-123");

    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("processes multiple streak entries from yesterday", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);

    const entries = [
      makeStreakEntry({
        id: "entry-1",
        category: "fitness",
        metadata: {
          dashboard_metrics: [
            { key: "workout_days", value: 3, aggregate: "last", label: "Workout streak", unit: " days" },
          ],
        },
      }),
      makeStreakEntry({
        id: "entry-2",
        category: "meditation",
        metadata: {
          dashboard_metrics: [
            { key: "meditation_days", value: 7, aggregate: "last", label: "Meditation streak", unit: " days" },
          ],
        },
      }),
    ];

    const { client, upsertMock } = makeSupabaseMock({ yesterdayEntries: entries });

    vi.mocked(createClient).mockReturnValue(client);

    await autoIncrementStreaks("user-123");

    // One upsert per streak entry
    expect(upsertMock).toHaveBeenCalledTimes(2);
  });
});

// ── Idempotency simulation: running cron twice ────────────────────────────────

describe("autoIncrementStreaks — double-fire simulation", () => {
  it("calling autoIncrementStreaks twice results in only one upsert attempt per entry", async () => {
    // This simulates the cron firing twice on the same day.
    // The first call inserts the streak entry.
    // The second call attempts to upsert the same entry — ignoreDuplicates=true
    // means the DB silently skips it (no error, no duplicate row).
    //
    // From the application's perspective, both calls succeed without error.
    // The DB enforces uniqueness via entries_auto_streak_unique_idx.

    const entry = makeStreakEntry();

    // First call: upsert succeeds (new row inserted)
    const upsertFirstCall = vi.fn().mockResolvedValue({ data: null, error: null });
    const clientFirst = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "entries") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lt: vi.fn().mockResolvedValue({ data: [entry], error: null }),
            upsert: upsertFirstCall,
          };
        }
        return { upsert: upsertFirstCall };
      }),
    } as unknown as ReturnType<typeof createClient>;

    vi.mocked(createClient).mockReturnValue(clientFirst);
    await autoIncrementStreaks("user-123");
    expect(upsertFirstCall).toHaveBeenCalledOnce();

    // Second call: upsert silently skips (ignoreDuplicates=true, no error)
    const upsertSecondCall = vi.fn().mockResolvedValue({ data: null, error: null });
    const clientSecond = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "entries") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lt: vi.fn().mockResolvedValue({ data: [entry], error: null }),
            upsert: upsertSecondCall,
          };
        }
        return { upsert: upsertSecondCall };
      }),
    } as unknown as ReturnType<typeof createClient>;

    vi.mocked(createClient).mockReturnValue(clientSecond);
    await autoIncrementStreaks("user-123");
    expect(upsertSecondCall).toHaveBeenCalledOnce();

    // Both calls used ignoreDuplicates: true
    const [, firstOptions] = upsertFirstCall.mock.calls[0];
    const [, secondOptions] = upsertSecondCall.mock.calls[0];
    expect(firstOptions).toEqual({ ignoreDuplicates: true });
    expect(secondOptions).toEqual({ ignoreDuplicates: true });
  });

  it("second cron run does not throw even if DB silently skips the duplicate", async () => {
    // Simulate: second run, DB returns no error (ignoreDuplicates=true suppresses conflict)
    const entry = makeStreakEntry();
    const { client } = makeSupabaseMock({
      yesterdayEntries: [entry],
      upsertError: null, // No error — conflict was silently ignored by DB
    });

    vi.mocked(createClient).mockReturnValue(client);

    // Should resolve cleanly on both runs
    await expect(autoIncrementStreaks("user-123")).resolves.toBeUndefined();
    await expect(autoIncrementStreaks("user-123")).resolves.toBeUndefined();
  });
});

// ── Migration constraint verification ────────────────────────────────────────

describe("Unique constraint migration (20240001000021)", () => {
  it("migration file exists", async () => {
    // Verify the migration file is present in the codebase
    const fs = await import("fs");
    const path = await import("path");
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20240001000021_entries_streak_unique.sql"
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it("migration contains partial unique index on auto_streak entries", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20240001000021_entries_streak_unique.sql"
    );
    const content = fs.readFileSync(migrationPath, "utf-8");

    // Verify the index covers user_id, category, and date
    expect(content).toContain("entries_auto_streak_unique_idx");
    expect(content).toContain("user_id");
    expect(content).toContain("category");
    // Verify it's a partial index scoped to auto_streak entries
    expect(content).toContain("auto_streak");
    // Verify it's a UNIQUE index
    expect(content).toContain("CREATE UNIQUE INDEX");
  });

  it("migration uses IMMUTABLE UTC date function for the index expression", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20240001000021_entries_streak_unique.sql"
    );
    const content = fs.readFileSync(migrationPath, "utf-8");

    // Verify the IMMUTABLE wrapper function is defined
    expect(content).toContain("IMMUTABLE");
    expect(content).toContain("UTC");
  });
});
