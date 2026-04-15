export const runtime = "edge";

import { createClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = "thoughts" | "ideas" | "feelings" | "expenses" | "calories" | "workout";

interface GraphNode {
  id: string;
  label: string;
  category: Category;
  created_at: string;
  edge_count: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: "branch" | "similarity";
}

interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface EntryRow {
  id: string;
  content: string;
  category: Category;
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

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

  // Fetch entries (with embeddings for similarity computation)
  const { data: entriesData, error: entriesError } = await supabase
    .from("entries")
    .select("id, content, category, created_at, branch_id, embedding, embedding_status")
    .order("created_at", { ascending: false });

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
    .select("entry_id, branch_id");

  if (insightsError) {
    console.error("[api/graph] insights query error:", insightsError.message);
    return new Response(JSON.stringify({ error: "Failed to fetch graph data" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const entries = (entriesData ?? []) as EntryRow[];
  const insights = (insightsData ?? []) as InsightRow[];

  // ── Build edges ───────────────────────────────────────────────────────────

  const edgeSet = new Map<string, GraphEdge>();

  const addEdge = (source: string, target: string, weight: number, type: "branch" | "similarity") => {
    // Canonical key: smaller id first to avoid duplicates
    const key = source < target ? `${source}:${target}` : `${target}:${source}`;
    if (!edgeSet.has(key)) {
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

  // Cross-category synapse connections:
  // Entries with multiple categories (comma-separated) act as bridges between category clusters.
  // Also connect entries that share ANY category tag.
  const entryCategories = new Map<string, string[]>();
  for (const entry of entries) {
    const cats = entry.category.split(",").map((c: string) => c.trim()).filter(Boolean);
    entryCategories.set(entry.id, cats);
  }

  // Group entries by each individual category tag
  const byCategoryTag = new Map<string, string[]>();
  for (const [id, cats] of entryCategories) {
    for (const cat of cats) {
      if (!byCategoryTag.has(cat)) byCategoryTag.set(cat, []);
      byCategoryTag.get(cat)!.push(id);
    }
  }

  // Connect entries sharing a category tag (most recent 5 per tag, cross-category allowed)
  for (const ids of byCategoryTag.values()) {
    const recent = ids.slice(0, 5);
    for (let i = 0; i < recent.length - 1; i++) {
      for (let j = i + 1; j < recent.length; j++) {
        addEdge(recent[i], recent[j], 0.4, "similarity");
      }
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

  const nodes: GraphNode[] = entries.map((entry) => ({
    id: entry.id,
    label: entry.content, // full content — frontend truncates for display
    category: entry.category.split(",")[0].trim() as Category, // primary category for color
    created_at: entry.created_at,
    edge_count: edgeCountMap.get(entry.id) ?? 0,
  }));

  const payload: GraphPayload = { nodes, edges };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
