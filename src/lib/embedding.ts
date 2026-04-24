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
 * Orchestrate embedding generation with retry + DB update for a single entry.
 *
 * On success: updates entries.embedding and sets embedding_status = 'done',
 * then asynchronously triggers the RAG insight pipeline if entryContext is provided.
 * On exhaustion: sets embedding_status = 'failed' and logs with entry_id.
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
        .update({ embedding: `[${embedding.join(",")}]`, embedding_status: "done" })
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
