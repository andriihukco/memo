export const runtime = "edge";
import { createClient } from "@supabase/supabase-js";

function getUserJwt(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function makeSupabase(jwt: string) {
  return createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
}

export async function POST(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  const { source, target } = await req.json().catch(() => ({}));
  if (!source || !target) {
    return new Response(JSON.stringify({ error: "source and target required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  if (source === 'uncategorized') {
    return new Response(JSON.stringify({ error: "Cannot merge system category" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const supabase = makeSupabase(jwt);

  // Step 1: Count entries in source category before reassigning
  const { count, error: countError } = await supabase
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("category", source);

  if (countError) {
    return new Response(JSON.stringify({ error: countError.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  // Step 2: Reassign all entries from source to target
  const { error: updateError } = await supabase
    .from("entries")
    .update({ category: target })
    .eq("category", source);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  // Step 3: Delete the source category (guard against deleting 'uncategorized')
  const { error: deleteError } = await supabase
    .from("categories")
    .delete()
    .eq("name", source)
    .neq("name", "uncategorized");

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true, reassigned: count ?? 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
}
