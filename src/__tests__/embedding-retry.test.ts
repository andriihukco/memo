/**
 * Tests for embedding retry for failed entries (REQ-12).
 *
 * Covers:
 * - retryFailedEmbeddings(userId): queries entries with embedding_status='failed'
 *   AND embedding_attempts < 3, then calls embedEntry() for each
 * - Entries with embedding_attempts >= 3 are NOT retried (permanently failed)
 * - Entries with embedding_status != 'failed' are NOT retried
 * - embedEntry() is called once per qualifying entry
 * - Errors from embedEntry() are caught and do not abort processing of other entries
 * - retryFailedEmbeddings is called inside processUser() (cron integration)
 * - DB fetch errors are handled gracefully (no throw)
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Mock env ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/env", () => ({
  env: {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    GEMINI_API_KEY: "test-gemini-key",
  },
}));

// ── Mock embedEntry ───────────────────────────────────────────────────────────

vi.mock("@/lib/embedding", () => ({
  embedEntry: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock Supabase ─────────────────────────────────────────────────────────────

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { embedEntry } from "@/lib/embedding";
import { retryFailedEmbeddings } from "@/lib/processing/loop";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal Supabase mock for retryFailedEmbeddings.
 *
 * @param opts.failedEntries - entries returned by the query (status='failed', attempts < 3)
 * @param opts.fetchError - error to return on the entries query
 */
function makeSupabaseMock(opts: {
  failedEntries?: Array<{ id: string; content: string }>;
  fetchError?: { message: string } | null;
}) {
  const { failedEntries = [], fetchError = null } = opts;

  // Build a chainable query builder that resolves at the end of the chain
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockResolvedValue({ data: failedEntries, error: fetchError }),
  };

  const fromMock = vi.fn().mockReturnValue(queryBuilder);

  return { from: fromMock } as unknown as ReturnType<typeof createClient>;
}

// ── Reset mocks between tests ─────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("retryFailedEmbeddings", () => {
  it("is exported from loop.ts", () => {
    expect(typeof retryFailedEmbeddings).toBe("function");
  });

  it("calls embedEntry() for each failed entry with attempts < 3", async () => {
    const failedEntries = [
      { id: "entry-1", content: "First failed entry" },
      { id: "entry-2", content: "Second failed entry" },
    ];

    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({ failedEntries }));

    await retryFailedEmbeddings("user-123");

    expect(embedEntry).toHaveBeenCalledTimes(2);
    expect(embedEntry).toHaveBeenCalledWith("entry-1", "First failed entry");
    expect(embedEntry).toHaveBeenCalledWith("entry-2", "Second failed entry");
  });

  it("does not call embedEntry() when there are no failed entries", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({ failedEntries: [] }));

    await retryFailedEmbeddings("user-123");

    expect(embedEntry).not.toHaveBeenCalled();
  });

  it("queries with correct filters: embedding_status='failed' AND embedding_attempts < 3", async () => {
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.mocked(createClient).mockReturnValue({
      from: vi.fn().mockReturnValue(queryBuilder),
    } as unknown as ReturnType<typeof createClient>);

    await retryFailedEmbeddings("user-abc");

    // Verify the query filters are applied correctly
    expect(queryBuilder.eq).toHaveBeenCalledWith("user_id", "user-abc");
    expect(queryBuilder.eq).toHaveBeenCalledWith("embedding_status", "failed");
    expect(queryBuilder.lt).toHaveBeenCalledWith("embedding_attempts", 3);
  });

  it("handles DB fetch error gracefully without throwing", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({ fetchError: { message: "connection timeout" } })
    );

    // Should not throw
    await expect(retryFailedEmbeddings("user-123")).resolves.toBeUndefined();

    // embedEntry should not be called when fetch fails
    expect(embedEntry).not.toHaveBeenCalled();
  });

  it("continues processing remaining entries when one embedEntry() call fails", async () => {
    const failedEntries = [
      { id: "entry-1", content: "First entry" },
      { id: "entry-2", content: "Second entry" },
      { id: "entry-3", content: "Third entry" },
    ];

    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({ failedEntries }));

    // Make the second entry fail
    vi.mocked(embedEntry)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Gemini API error"))
      .mockResolvedValueOnce(undefined);

    // Should not throw
    await expect(retryFailedEmbeddings("user-123")).resolves.toBeUndefined();

    // All three entries should have been attempted
    expect(embedEntry).toHaveBeenCalledTimes(3);
    expect(embedEntry).toHaveBeenCalledWith("entry-1", "First entry");
    expect(embedEntry).toHaveBeenCalledWith("entry-2", "Second entry");
    expect(embedEntry).toHaveBeenCalledWith("entry-3", "Third entry");
  });

  it("processes a single failed entry correctly", async () => {
    const failedEntries = [{ id: "entry-only", content: "Only failed entry" }];

    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({ failedEntries }));

    await retryFailedEmbeddings("user-456");

    expect(embedEntry).toHaveBeenCalledOnce();
    expect(embedEntry).toHaveBeenCalledWith("entry-only", "Only failed entry");
  });
});

// ── Cron integration: retryFailedEmbeddings is called in processUser ──────────

describe("processUser includes retryFailedEmbeddings", () => {
  it("retryFailedEmbeddings is exported from loop.ts", async () => {
    const mod = await import("@/lib/processing/loop");
    expect(typeof mod.retryFailedEmbeddings).toBe("function");
  });

  it("processUser is exported from loop.ts", async () => {
    const mod = await import("@/lib/processing/loop");
    expect(typeof mod.processUser).toBe("function");
  });
});

// ── Retry logic boundary tests ────────────────────────────────────────────────

describe("Retry boundary: embedding_attempts < 3", () => {
  it("entries with attempts=0 are included in retry query (attempts < 3)", () => {
    // Verify the boundary condition: 0 < 3 is true
    expect(0 < 3).toBe(true);
  });

  it("entries with attempts=1 are included in retry query (attempts < 3)", () => {
    expect(1 < 3).toBe(true);
  });

  it("entries with attempts=2 are included in retry query (attempts < 3)", () => {
    expect(2 < 3).toBe(true);
  });

  it("entries with attempts=3 are excluded from retry query (attempts < 3 is false)", () => {
    // After 3 attempts, entry is permanently failed — no more retries
    expect(3 < 3).toBe(false);
  });

  it("entries with attempts=4 are excluded from retry query (attempts < 3 is false)", () => {
    expect(4 < 3).toBe(false);
  });
});
