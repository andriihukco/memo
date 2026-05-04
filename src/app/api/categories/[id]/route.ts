export const runtime = "edge";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

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

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  // Rate limit: 30 writes/min per JWT
  const rl = rateLimit(`categories:write:${jwt.slice(0, 16)}`, 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const id = params.id;
  if (!id || id === 'uncategorized') {
    return new Response(JSON.stringify({ error: "Cannot delete system category" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const supabase = makeSupabase(jwt);

  // Step 1: Count entries in this category before reassigning
  const { count, error: countError } = await supabase
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("category", id);

  if (countError) {
    return new Response(JSON.stringify({ error: countError.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  // Step 2: Reassign all entries from this category to 'uncategorized'
  const { error: updateError } = await supabase
    .from("entries")
    .update({ category: 'uncategorized' })
    .eq("category", id);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  // Step 2: Delete the category (guard against deleting 'uncategorized')
  const { error: deleteError } = await supabase
    .from("categories")
    .delete()
    .eq("name", id)
    .neq("name", "uncategorized");

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true, reassigned: count ?? 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
}
