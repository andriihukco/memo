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

  const { name, label, color } = await req.json().catch(() => ({}));
  if (!name) return new Response(JSON.stringify({ error: "name required" }), { status: 400, headers: { "Content-Type": "application/json" } });

  const supabase = makeSupabase(jwt);
  await supabase.from("categories").upsert(
    {
      name,
      label_ua: label ?? name,
      color: color ?? "bg-gray-100 text-gray-700",
      icon: "tag",
    },
    { onConflict: "user_id,name", ignoreDuplicates: true }
  );

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}
