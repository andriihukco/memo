import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";
import { findSimilarEntries, generateInsight, type Entry } from "./insight";

// ── Error ─────────────────────────────────────────────────────────────────────

export class EmbeddingError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "EmbeddingError";
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const MAX_ATTEMPTS = 3;
const BACKOFF_DELAYS_MS = [1000, 2000, 4000];

// ── Supabase service client ───────────────────────────────────────────────────

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a 768-dimensional embedding vector for the given text using
 * the gemini-embedding-001 model.
 *
 * Throws EmbeddingError on failure.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  const result = await model.embedContent({
    content: { parts: [{ text }], role: "user" },
    // @ts-expect-error outputDimensionality is supported by the API but not yet typed in the SDK
    outputDimensionality: EMBEDDING_DIMENSIONS,
  });

  const values = result.embedding.values;
  if (!values || values.length !== EMBEDDING_DIMENSIONS) {
    throw new EmbeddingError(
      `Expected ${EMBEDDING_DIMENSIONS}-dim vector, got ${values?.length ?? 0}`
    );
  }

  return values;
}

/**
 * Generate and persist a vector embedding for a single diary entry, with
 * exponential-backoff retry logic and database side effects.
 *
 * **Retry logic:** up to `MAX_ATTEMPTS` (3) attempts are made. Between each
 * attempt the function waits 1 s, 2 s, and 4 s respectively (defined in
 * `BACKOFF_DELAYS_MS`). After every failed attempt `entries.embedding_attempts`
 * is incremented in the database so that `retryFailedEmbeddings()` can skip
 * entries that have already exhausted their budget.
 *
 * **DB side effects on success:**
 *  - `entries.embedding` is set to the 768-dimensional vector string.
 *  - `entries.embedding_status` is set to `'done'`.
 *  - `entries.embedding_attempts` is reset to `0`.
 *  - If `entryContext` is provided, the RAG insight pipeline is triggered
 *    asynchronously (non-blocking) to find similar entries and generate insights.
 *
 * **DB side effects on exhaustion:**
 *  - `entries.embedding_status` is set to `'failed'`.
 *  - `entries.embedding_attempts` reflects the total number of attempts made.
 *  - The entry will be picked up by `retryFailedEmbeddings()` on the next cron
 *    run as long as `embedding_attempts < 3`.
 *
 * @param entryId - UUID of the `entries` row to embed.
 * @param content - Plain-text content to generate the embedding for.
 * @param entryContext - Optional context used to trigger the RAG insight
 *   pipeline after a successful embedding. Includes `userId`, `category`,
 *   `created_at`, and an optional `sendMessage` callback (not used for
 *   insights — they surface in the miniapp, not as Telegram messages).
 * @returns Resolves when the embedding has been stored (or all attempts are
 *   exhausted). Never rejects — failures are logged and reflected in the DB.
 */
export async function embedEntry(
  entryId: string,
  content: string,
  entryContext?: { userId: string; category: string; created_at: string; chatId?: number | string; sendMessage?: (text: string) => Promise<void> }
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, BACKOFF_DELAYS_MS[attempt - 1]));
    }

    try {
      const embedding = await generateEmbedding(content);

      const supabase = getServiceClient();
      const { error } = await supabase
        .from("entries")
        .update({ embedding: `[${embedding.join(",")}]`, embedding_status: "done", embedding_attempts: 0 })
        .eq("id", entryId);

      if (error) {
        throw new EmbeddingError(`DB update failed: ${error.message}`, error);
      }

      // Async RAG insight pipeline (non-blocking) — runs after embedding is stored
      // Note: sendMessage is intentionally not passed here — insights are visible
      // in the miniapp reports/feed, not as noisy Telegram messages.
      if (entryContext) {
        runInsightPipeline(entryId, content, embedding, entryContext).catch((err) =>
          console.error("[embedding] insight pipeline failed:", err)
        );
      }

      return;
    } catch (err) {
      lastError = err;

      // Increment embedding_attempts in the DB so retryFailedEmbeddings can
      // skip entries that have already exhausted their attempt budget.
      const supabase = getServiceClient();
      const { data: current } = await supabase
        .from("entries")
        .select("embedding_attempts")
        .eq("id", entryId)
        .single();

      const nextAttempts = ((current?.embedding_attempts as number | null) ?? 0) + 1;
      await supabase
        .from("entries")
        .update({ embedding_attempts: nextAttempts })
        .eq("id", entryId);
    }
  }

  // All attempts exhausted — mark as failed
  console.error(`[embedding] Failed to embed entry ${entryId} after ${MAX_ATTEMPTS} attempts:`, lastError);

  const supabase = getServiceClient();
  const { error: updateError } = await supabase
    .from("entries")
    .update({ embedding_status: "failed" })
    .eq("id", entryId);

  if (updateError) {
    console.error(`[embedding] Could not mark entry ${entryId} as failed:`, updateError.message);
  }
}

// ── RAG insight pipeline ──────────────────────────────────────────────────────

async function runInsightPipeline(
  entryId: string,
  content: string,
  embedding: number[],
  ctx: { userId: string; category: string; created_at: string; sendMessage?: (text: string) => Promise<void> }
): Promise<void> {
  const newEntry: Entry = {
    id: entryId,
    content,
    category: ctx.category,
    created_at: ctx.created_at,
  };

  const similarEntries = await findSimilarEntries(ctx.userId, embedding, entryId);
  // Generate and persist insight — but do NOT send to Telegram (too noisy).
  // Insights are surfaced in the miniapp feed and retrospective reports.
  await generateInsight(newEntry, similarEntries);
}
