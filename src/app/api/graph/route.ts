export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { deriveUserKey, decryptField } from "@/lib/crypto";
import { env } from "@/lib/env";
import { getEffectiveTier, TIER_INFO } from "@/lib/stars/paywall";

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = string;

interface GraphNode {
  id: string;
  label: string;
  category: Category;       // primary category (for color)
  categories: Category[];   // all categories this entry belongs to
  created_at: string;
  edge_count: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: "branch" | "similarity" | "cross_category";
}

interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface EntryRow {
  id: string;
  content: string;
  category: string;
  created_at: string;
  branch_id: string | null;
  embedding: number[] | null;
  embedding_status: string;
}

interface InsightRow {
  entry_id: string;
  branch_id: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getUserJwt(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

/** Cosine similarity between two equal-length vectors */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

const SIMILARITY_THRESHOLD = 0.55; // lowered from 0.75 — embeddings vary widely
const SAME_CATEGORY_THRESHOLD = 0.45; // connect same-category entries even with lower similarity

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  // SUPABASE_ANON_KEY first (server-side), then NEXT_PUBLIC fallback
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Resolve user_id via anon client + RLS (same pattern as entries/profile routes)
  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

  const { data: profileRow, error: profileErr } = await anonClient
    .from("profiles")
    .select("id, telegram_id, encryption_salt")
    .single();

  if (profileErr || !profileRow) {
    console.error("[api/graph] profile lookup failed:", profileErr?.message, "anonKey present:", !!anonKey);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = profileRow.id as string;
  const telegramId = profileRow.telegram_id ? String(profileRow.telegram_id) : null;
  const encryptionSalt = profileRow.encryption_salt ?? null;

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Apply historyDays cutoff based on user's tier
  const tier = await getEffectiveTier(userId);
  const historyDays = TIER_INFO[tier].limits.historyDays;
  const cutoff = historyDays !== Infinity
    ? new Date(Date.now() - historyDays * 86_400_000).toISOString()
    : null;

  // Fetch entries (with embeddings for similarity computation)
  let entriesQuery = supabase
    .from("entries")
    .select("id, content, category, created_at, branch_id, embedding, embedding_status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (cutoff) {
    entriesQuery = entriesQuery.gte("created_at", cutoff);
  }

  const { data: entriesData, error: entriesError } = await entriesQuery;

  if (entriesError) {
    console.error("[api/graph] entries query error:", entriesError.message);
    return new Response(JSON.stringify({ error: "Failed to fetch graph data" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch insights for branch-based edges
  const { data: insightsData, error: insightsError } = await supabase
    .from("insights")
    .select("entry_id, branch_id")
    .eq("user_id", userId);

  if (insightsError) {
    console.error("[api/graph] insights query error:", insightsError.message);
    return new Response(JSON.stringify({ error: "Failed to fetch graph data" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const entries = (entriesData ?? []) as EntryRow[];
  const insights = (insightsData ?? []) as InsightRow[];

  // Decrypt entry content using per-user key derived from telegram_id + encryption_salt
  if (telegramId) {
    try {
      const cryptoKey = await deriveUserKey(telegramId, encryptionSalt);
      await Promise.all(entries.map(async (e) => {
        try { e.content = await decryptField(e.content, cryptoKey); } catch { /* use as-is */ }
      }));
    } catch { /* fallback: use as-is */ }
  }

  // ── Build edges ───────────────────────────────────────────────────────────

  const edgeSet = new Map<string, GraphEdge>();

  const addEdge = (source: string, target: string, weight: number, type: "branch" | "similarity" | "cross_category") => {
    const key = source < target ? `${source}:${target}` : `${target}:${source}`;
    // cross_category and branch edges take priority over similarity
    const existing = edgeSet.get(key);
    if (!existing || (type === "branch") || (type === "cross_category" && existing.type === "similarity")) {
      edgeSet.set(key, { source, target, weight, type });
    }
  };

  // Branch edges: entries sharing a branch_id via insights
  const branchMap = new Map<string, string[]>(); // branch_id → entry_ids
  for (const insight of insights) {
    if (!insight.branch_id) continue;
    const list = branchMap.get(insight.branch_id) ?? [];
    if (!list.includes(insight.entry_id)) list.push(insight.entry_id);
    branchMap.set(insight.branch_id, list);
  }
  // Also include entries.branch_id
  for (const entry of entries) {
    if (!entry.branch_id) continue;
    const list = branchMap.get(entry.branch_id) ?? [];
    if (!list.includes(entry.id)) list.push(entry.id);
    branchMap.set(entry.branch_id, list);
  }

  for (const ids of Array.from(branchMap.values())) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        addEdge(ids[i], ids[j], 1.0, "branch");
      }
    }
  }

  // Similarity edges: cosine similarity between entries with embeddings
  const withEmbeddings = entries.filter(
    (e) => e.embedding_status === "done" && Array.isArray(e.embedding) && e.embedding.length > 0
  );
  for (let i = 0; i < withEmbeddings.length; i++) {
    for (let j = i + 1; j < withEmbeddings.length; j++) {
      const a = withEmbeddings[i];
      const b = withEmbeddings[j];
      const sim = cosineSimilarity(a.embedding as number[], b.embedding as number[]);
      const threshold = a.category === b.category ? SAME_CATEGORY_THRESHOLD : SIMILARITY_THRESHOLD;
      if (sim > threshold) {
        addEdge(a.id, b.id, sim, "similarity");
      }
    }
  }

  // Cross-category bridge edges:
  // When a single entry contains multiple categories (multi-intent classifier result),
  // it acts as a semantic bridge. We create a "cross_category" edge between the most
  // recent entry of each category pair that this entry spans.
  // This pulls those category clusters closer in the force layout.
  const entryCategories = new Map<string, string[]>();
  for (const entry of entries) {
    const cats = entry.category.split(",").map((c: string) => c.trim()).filter(Boolean);
    entryCategories.set(entry.id, cats);
  }

  // Build: category → most recent entry ids (up to 3)
  const byCategoryTag = new Map<string, string[]>();
  for (const [id, cats] of entryCategories) {
    for (const cat of cats) {
      if (!byCategoryTag.has(cat)) byCategoryTag.set(cat, []);
      byCategoryTag.get(cat)!.push(id);
    }
  }

  // For each entry that spans multiple categories, connect the representative
  // entries of those categories with a cross_category bridge edge.
  // This is the "smart" part: goals entries near workout entries, etc.
  for (const [entryId, cats] of entryCategories) {
    if (cats.length < 2) continue;
    // For each pair of categories this entry bridges
    for (let i = 0; i < cats.length; i++) {
      for (let j = i + 1; j < cats.length; j++) {
        const catA = cats[i], catB = cats[j];
        const idsA = byCategoryTag.get(catA) ?? [];
        const idsB = byCategoryTag.get(catB) ?? [];
        // Connect this entry to the nearest entry of the other category
        const nearestB = idsB.find(id => id !== entryId);
        const nearestA = idsA.find(id => id !== entryId);
        if (nearestB) addEdge(entryId, nearestB, 0.8, "cross_category");
        if (nearestA) addEdge(entryId, nearestA, 0.8, "cross_category");
      }
    }
  }

  // Also: connect same-category entries by recency (chain, not full mesh)
  for (const [, ids] of byCategoryTag) {
    const recent = ids.slice(0, 5);
    for (let i = 0; i < recent.length - 1; i++) {
      addEdge(recent[i], recent[i + 1], 0.4, "similarity");
    }
  }

  // Fallback: if still no edges, connect entries of the same primary category
  if (edgeSet.size === 0 && entries.length > 1) {
    const byPrimary = new Map<string, string[]>();
    for (const e of entries) {
      const primary = e.category.split(",")[0].trim();
      const list = byPrimary.get(primary) ?? [];
      list.push(e.id);
      byPrimary.set(primary, list);
    }
    for (const ids of byPrimary.values()) {
      const recent = ids.slice(0, 4);
      for (let i = 0; i < recent.length - 1; i++) {
        addEdge(recent[i], recent[i + 1], 0.5, "similarity");
      }
    }
  }

  const edges = Array.from(edgeSet.values());

  // ── Build nodes with edge_count ───────────────────────────────────────────

  const edgeCountMap = new Map<string, number>();
  for (const edge of edges) {
    edgeCountMap.set(edge.source, (edgeCountMap.get(edge.source) ?? 0) + 1);
    edgeCountMap.set(edge.target, (edgeCountMap.get(edge.target) ?? 0) + 1);
  }

  const nodes: GraphNode[] = entries.map((entry) => {
    const cats = entry.category.split(",").map((c: string) => c.trim()).filter(Boolean);
    return {
      id: entry.id,
      label: entry.content,
      category: cats[0] as Category,       // primary category for color
      categories: cats as Category[],       // all categories for detail panel
      created_at: entry.created_at,
      edge_count: edgeCountMap.get(entry.id) ?? 0,
    };
  });

  const payload: GraphPayload = { nodes, edges };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
