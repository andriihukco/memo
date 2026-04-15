import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SimilarEntry {
  id: string;
  content: string;
  category: string;
  created_at: string;
  similarity: number;
}

export interface Entry {
  id: string;
  content: string;
  category: string;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INSIGHT_MODEL = "gemini-2.5-flash";
const SIMILARITY_THRESHOLD = 0.75;

// ── Supabase service client ───────────────────────────────────────────────────

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ── Insight generation prompt ─────────────────────────────────────────────────

function buildInsightPrompt(newEntry: Entry, similarEntries: SimilarEntry[]): string {
  const relatedLines = similarEntries
    .map((e) => `[${e.created_at}] ${e.content}`)
    .join("\n");

  return `You are a reflective journaling assistant. The user just wrote a new diary entry.
Below are semantically related past entries. Write a short, empathetic insight (2–4 sentences)
connecting the new entry to the patterns you observe in the past entries.
Do not repeat the entries verbatim. Focus on themes, growth, or recurring patterns.

New entry: ${newEntry.content}

Related past entries:
${relatedLines}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Query pgvector for the top-K most similar past entries for the same user.
 * Excludes the new entry itself, requires non-null embedding, orders by cosine similarity.
 */
export async function findSimilarEntries(
  userId: string,
  embedding: number[],
  newEntryId: string,
  topK = 5
): Promise<SimilarEntry[]> {
  const supabase = getServiceClient();

  // Format embedding as a pgvector literal
  const embeddingLiteral = `[${embedding.join(",")}]`;

  const { data, error } = await supabase.rpc("find_similar_entries", {
    p_user_id: userId,
    p_embedding: embeddingLiteral,
    p_exclude_id: newEntryId,
    p_top_k: topK,
  });

  if (error) {
    console.error("[insight] findSimilarEntries RPC error:", error.message);
    return [];
  }

  return (data ?? []) as SimilarEntry[];
}

/**
 * Generate an insight linking the new entry to similar past entries.
 * Only generates if at least one entry exceeds the 0.75 similarity threshold.
 * Persists the insight to the `insights` table and returns the insight text.
 * Returns null if the threshold is not met.
 */
export async function generateInsight(
  newEntry: Entry,
  similarEntries: SimilarEntry[]
): Promise<string | null> {
  // Filter to entries above the similarity threshold
  const relevant = similarEntries.filter((e) => e.similarity > SIMILARITY_THRESHOLD);
  if (relevant.length === 0) {
    return null;
  }

  // Generate insight text via gemini-2.5-flash
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: INSIGHT_MODEL });

  const prompt = buildInsightPrompt(newEntry, relevant);
  const result = await model.generateContent(prompt);
  const insightText = result.response.text().trim();

  if (!insightText) {
    return null;
  }

  // Persist to insights table
  const supabase = getServiceClient();

  // Derive a branch_id from the most similar entry's branch_id, or generate a new one
  const topEntry = relevant[0];
  const { data: topEntryData } = await supabase
    .from("entries")
    .select("branch_id, user_id")
    .eq("id", topEntry.id)
    .single();

  const branchId = topEntryData?.branch_id ?? crypto.randomUUID();
  const userId = topEntryData?.user_id;

  const { error } = await supabase.from("insights").insert({
    user_id: userId,
    entry_id: newEntry.id,
    insight_text: insightText,
    branch_id: branchId,
  });

  if (error) {
    console.error("[insight] Failed to persist insight:", error.message);
    // Still return the text so the bot can send it
  }

  return insightText;
}
