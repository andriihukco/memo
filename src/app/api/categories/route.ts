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

export async function GET(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  const supabase = makeSupabase(jwt);
  const { data, error } = await supabase
    .from("categories")
    .select("name, label_ua, color")
    .order("created_at", { ascending: true });

  if (error) return new Response(JSON.stringify({ categories: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ categories: data ?? [] }), { status: 200, headers: { "Content-Type": "application/json" } });
}

export async function POST(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  // Rate limit: 30 writes/min per JWT
  const rl = rateLimit(`categories:write:${jwt.slice(0, 16)}`, 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const { name, label_ua, label, color } = await req.json().catch(() => ({}));
  if (!name) return new Response(JSON.stringify({ error: "name required" }), { status: 400, headers: { "Content-Type": "application/json" } });

  const resolvedLabel = label_ua ?? label ?? name;

  const supabase = makeSupabase(jwt);

  // Must include user_id explicitly for RLS WITH CHECK to pass
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  const { data, error } = await supabase.from("categories").upsert(
    {
      user_id: user.id,
      name,
      label_ua: resolvedLabel,
      color: color ?? "bg-gray-100 text-gray-700",
      icon: "tag",
    },
    { onConflict: "user_id,name", ignoreDuplicates: true }
  ).select("name, label_ua, color").single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ ok: true, category: data ?? { name, label_ua: resolvedLabel, color: color ?? "bg-gray-100 text-gray-700" } }), { status: 200, headers: { "Content-Type": "application/json" } });
}

export async function PATCH(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  const { name, label_ua } = await req.json().catch(() => ({}));
  if (!name) return new Response(JSON.stringify({ error: "name required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  if (name === 'uncategorized') return new Response(JSON.stringify({ error: "Cannot modify system category" }), { status: 400, headers: { "Content-Type": "application/json" } });

  const supabase = makeSupabase(jwt);
  const { error } = await supabase
    .from("categories")
    .update({ label_ua })
    .eq("name", name);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}
