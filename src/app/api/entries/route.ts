export const runtime = "edge";

import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

function getUserJwt(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function makeSupabase(jwt: string) {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
}

// Re-extract dashboard_metrics from updated content using Gemini
async function recomputeMetrics(content: string): Promise<Record<string, unknown>[] | null> {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {},
    });

    const prompt = `Extract all measurable metrics from this diary entry as a JSON array.
Use nutritional knowledge to calculate kcal/protein/carbs/fat from food+weight mentions.
Standard values per 100g: chicken breast 165kcal/31g prot/0g carbs/3.6g fat, rice(cooked) 130kcal/2.7g prot/28g carbs/0.3g fat, buckwheat(cooked) 92kcal/3.4g prot/20g carbs/0.6g fat, egg 155kcal/13g prot/1g carbs/11g fat, salmon 208kcal/20g prot/0g carbs/13g fat, oats 389kcal/17g prot/66g carbs/7g fat.

Return ONLY a JSON array like: [{"key":"kcal_intake","label":"Калорії","value":330,"unit":"ккал","icon":"utensils","aggregate":"sum"},{"key":"protein_g","label":"Білки","value":62,"unit":"г","icon":"beef","aggregate":"sum"}]
If no measurable data, return: []

Entry: "${content.replace(/"/g, "'")}"`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim()
      .replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function PATCH(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  let id: string, content: string | undefined, category: string | undefined;
  try {
    const body = await req.json();
    id = body.id;
    content = body.content;
    category = body.category;
    if (!id || (!content && !category)) throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: "id and at least one of content/category required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const supabase = makeSupabase(jwt);

  // Fetch current entry to get existing metadata
  const { data: existing } = await supabase
    .from("entries")
    .select("metadata, content")
    .eq("id", id)
    .single();

  const updates: Record<string, unknown> = {};
  if (content !== undefined) updates.content = content.trim();
  if (category !== undefined) updates.category = category.trim();

  // Re-compute metrics when content changes
  if (content !== undefined && content.trim() !== existing?.content) {
    const newMetrics = await recomputeMetrics(content.trim());
    if (newMetrics !== null) {
      const existingMeta = (existing?.metadata as Record<string, unknown>) ?? {};
      // Preserve non-metric metadata (bot_msg_id, etc.), replace dashboard_metrics
      updates.metadata = { ...existingMeta, dashboard_metrics: newMetrics };
    }
  }

  const { data, error } = await supabase
    .from("entries")
    .update(updates)
    .eq("id", id)
    .select("id, content, category, metadata, bot_reply, thread_id, reply_to_entry_id, created_at")
    .single();

  if (error) {
    console.error("[api/entries] patch error:", error.message);
    return new Response(JSON.stringify({ error: "Failed to update entry" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ entry: data }), { status: 200, headers: { "Content-Type": "application/json" } });
}

export async function DELETE(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let ids: string[];
  try {
    const body = await req.json();
    ids = body.ids;
    if (!Array.isArray(ids) || ids.length === 0) throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: "ids array required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = makeSupabase(jwt);
  const { error } = await supabase.from("entries").delete().in("id", ids);

  if (error) {
    console.error("[api/entries] delete error:", error.message);
    return new Response(JSON.stringify({ error: "Failed to delete entries" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ deleted: ids.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = makeSupabase(jwt);

  const { searchParams } = new URL(req.url);
  const categoryParam = searchParams.get("category");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;
  const fromParam = searchParams.get("from");
  const toParam   = searchParams.get("to");

  // category filter — open-ended, any string
  const category = categoryParam ?? null;

  // Build query
  let query = supabase
    .from("entries")
    .select("id, content, category, metadata, bot_reply, thread_id, reply_to_entry_id, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) query = query.eq("category", category);
  if (fromParam) query = query.gte("created_at", fromParam);
  if (toParam)   query = query.lte("created_at", toParam);

  const { data, error, count } = await query;

  if (error) {
    console.error("[api/entries] query error:", error.message);
    return new Response(JSON.stringify({ error: "Failed to fetch entries" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ entries: data ?? [], total: count ?? 0, page }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
