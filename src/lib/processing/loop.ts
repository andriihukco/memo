import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

interface EntryRow {
  id: string;
  content: string;
  category: string;
  metadata: Record<string, unknown>;
  embedding: string | null;
  branch_id: string | null;
  created_at: string;
}

/**
 * Re-cluster entries for a user using pgvector cosine similarity.
 * Assigns shared branch_id UUIDs to clusters of ≥ 3 entries (cosine > 0.75).
 * Updates entries.branch_id and insights.branch_id accordingly.
 */
export async function clusterEntries(userId: string): Promise<void> {
  const supabase = getServiceClient();

  // Fetch all entries with embeddings for this user
  const { data: entries, error } = await supabase
    .from("entries")
    .select("id, content, category, metadata, embedding, branch_id, created_at")
    .eq("user_id", userId)
    .eq("embedding_status", "done")
    .not("embedding", "is", null);

  if (error) {
    throw new Error(`[loop] Failed to fetch entries for user ${userId}: ${error.message}`);
  }

  if (!entries || entries.length < 3) {
    return; // Not enough entries to form any cluster
  }

  // Build adjacency: for each entry, find top-5 similar entries with similarity > 0.75
  const adjacency = new Map<string, Set<string>>();

  for (const entry of entries as EntryRow[]) {
    if (!entry.embedding) continue;

    const { data: similar, error: rpcError } = await supabase.rpc("find_similar_entries", {
      p_user_id: userId,
      p_embedding: entry.embedding,
      p_exclude_id: entry.id,
      p_top_k: 5,
    });

    if (rpcError) {
      console.error(`[loop] RPC error for entry ${entry.id}:`, rpcError.message);
      continue;
    }

    const neighbors = (similar ?? []).filter((s: { similarity: number }) => s.similarity > 0.75);
    if (neighbors.length > 0) {
      if (!adjacency.has(entry.id)) adjacency.set(entry.id, new Set());
      for (const n of neighbors) {
        adjacency.get(entry.id)!.add(n.id);
        if (!adjacency.has(n.id)) adjacency.set(n.id, new Set());
        adjacency.get(n.id)!.add(entry.id);
      }
    }
  }

  // Union-Find to group connected components
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  };
  const union = (a: string, b: string) => {
    parent.set(find(a), find(b));
  };

  for (const [node, neighbors] of adjacency) {
    for (const neighbor of neighbors) {
      union(node, neighbor);
    }
  }

  // Group entries by cluster root
  const clusters = new Map<string, string[]>();
  for (const [node] of adjacency) {
    const root = find(node);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(node);
  }

  // Only keep clusters with ≥ 3 entries; assign a stable branch_id UUID per cluster
  for (const [, members] of clusters) {
    if (members.length < 3) continue;

    // Prefer existing branch_id from a member entry, else generate new
    const existingEntry = (entries as EntryRow[]).find(
      (e) => members.includes(e.id) && e.branch_id != null
    );
    const branchId = existingEntry?.branch_id ?? crypto.randomUUID();

    // Update entries
    const { error: entryUpdateError } = await supabase
      .from("entries")
      .update({ branch_id: branchId })
      .in("id", members);

    if (entryUpdateError) {
      console.error(`[loop] Failed to update branch_id for cluster:`, entryUpdateError.message);
    }

    // Update insights referencing these entries
    const { error: insightUpdateError } = await supabase
      .from("insights")
      .update({ branch_id: branchId })
      .in("entry_id", members);

    if (insightUpdateError) {
      console.error(`[loop] Failed to update insights branch_id:`, insightUpdateError.message);
    }
  }
}

/**
 * Auto-increment active streaks for a user.
 * Finds the most recent entry with a "last" aggregate metric (streak),
 * and if it was created yesterday or earlier today, creates a new entry with value+1.
 */
export async function autoIncrementStreaks(userId: string): Promise<void> {
  const supabase = getServiceClient();
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(todayStart.getDate() - 1);

  // Find entries from yesterday that have streak metrics (aggregate=last)
  const { data: entries } = await supabase
    .from("entries")
    .select("id, content, category, metadata, created_at")
    .eq("user_id", userId)
    .gte("created_at", yesterdayStart.toISOString())
    .lt("created_at", todayStart.toISOString());

  if (!entries || entries.length === 0) return;

  for (const entry of entries as Array<{ id: string; content: string; category: string; metadata: Record<string, unknown>; created_at: string }>) {
    const metrics = entry.metadata.dashboard_metrics as Array<{ key: string; value: number; aggregate: string; label: string; unit: string; icon?: string }> | undefined;
    if (!Array.isArray(metrics)) continue;

    const streakMetrics = metrics.filter(m => m.aggregate === "last" && m.key.endsWith("_days"));
    if (streakMetrics.length === 0) continue;

    // Check if we already created a streak entry today
    const { data: todayEntry } = await supabase
      .from("entries")
      .select("id")
      .eq("user_id", userId)
      .eq("category", entry.category)
      .gte("created_at", todayStart.toISOString())
      .maybeSingle();

    if (todayEntry) continue; // Already logged today

    // Create auto-incremented streak entry
    const newMetrics = streakMetrics.map(m => ({ ...m, value: m.value + 1 }));
    const newContent = entry.content.replace(/\d+/, String(streakMetrics[0].value + 1));

    await supabase.from("entries").insert({
      user_id: userId,
      content: newContent,
      category: entry.category,
      metadata: { ...entry.metadata, dashboard_metrics: newMetrics, auto_streak: true },
      raw_media_url: null,
    });
  }
}

/**
 * Main per-user processing function.
 * 1. Re-clusters entries via pgvector similarity
 * 2. Builds and saves widget configs (delegated to widgets.ts)
 * 3. Auto-increments active streaks
 */
export async function processUser(userId: string): Promise<void> {
  await clusterEntries(userId);
  const { buildAndSaveWidgets } = await import("./widgets");
  await buildAndSaveWidgets(userId);
  await autoIncrementStreaks(userId).catch(err => console.error("[loop] autoIncrementStreaks failed:", err));
}

/**
 * Process all users in the system.
 * Each user is processed in an isolated try/catch — one failure does not abort others.
 */
export async function processAllUsers(): Promise<void> {
  const supabase = getServiceClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id");

  if (error) {
    throw new Error(`[loop] Failed to fetch profiles: ${error.message}`);
  }

  for (const profile of profiles ?? []) {
    try {
      await processUser(profile.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[loop] processUser failed for user_id=${profile.id}:`, message);
      // Continue to next user
    }
  }
}
