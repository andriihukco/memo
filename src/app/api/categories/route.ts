export const runtime = "edge";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { CATEGORY_NAME_MAX, isHexColor, slugFromLabel, swatchFor } from "@/lib/category-config";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

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

  // Rate limit: 30 reads/min per JWT
  const rlGet = await rateLimit(`categories:read:${jwt.slice(0, 16)}`, 30, 60_000);
  if (!rlGet.allowed) return rateLimitResponse(rlGet.resetAt);

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
  const rl = await rateLimit(`categories:write:${jwt.slice(0, 16)}`, 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const body = await req.json().catch(() => ({}));
  const label = String(body.label_ua ?? body.label ?? "").trim();
  if (!label) return json({ error: "Name required" }, 400);
  if (label.length > CATEGORY_NAME_MAX) return json({ error: `Name must be ${CATEGORY_NAME_MAX} characters or fewer` }, 400);
  if (body.color !== undefined && !isHexColor(body.color)) return json({ error: "Colour must be a hex value like #0A84FF" }, 400);

  // The slug is derived from the name and never changes, so entries keep pointing at it
  const name = slugFromLabel(label);

  const supabase = makeSupabase(jwt);

  // Must include user_id explicitly for RLS WITH CHECK to pass
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const { data, error } = await supabase
    .from("categories")
    .insert({
      user_id: user.id,
      name,
      label_ua: label,
      color: body.color ?? swatchFor(name),
      icon: "tag",
    })
    .select("name, label_ua, color")
    .single();

  if (error?.code === "23505") return json({ error: "A category with this name already exists" }, 409);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, category: data });
}

export async function PATCH(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  // Rate limit: 30 writes/min per JWT
  const rl = await rateLimit(`categories:write:${jwt.slice(0, 16)}`, 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const body = await req.json().catch(() => ({}));
  const { name } = body;
  if (!name) return json({ error: "name required" }, 400);
  if (name === 'uncategorized') return json({ error: "Cannot modify system category" }, 400);

  // Only the display name and colour change; the slug stays fixed
  const updates: { label_ua?: string; color?: string } = {};
  if (body.label_ua !== undefined) {
    const label = String(body.label_ua).trim();
    if (!label) return json({ error: "Name required" }, 400);
    if (label.length > CATEGORY_NAME_MAX) return json({ error: `Name must be ${CATEGORY_NAME_MAX} characters or fewer` }, 400);
    updates.label_ua = label;
  }
  if (body.color !== undefined) {
    if (!isHexColor(body.color)) return json({ error: "Colour must be a hex value like #0A84FF" }, 400);
    updates.color = body.color;
  }
  if (Object.keys(updates).length === 0) return json({ error: "Nothing to update" }, 400);

  const supabase = makeSupabase(jwt);
  const { data, error } = await supabase
    .from("categories")
    .update(updates)
    .eq("name", name)
    .select("name, label_ua, color");

  if (error) return json({ error: error.message }, 500);
  if (!data?.length) return json({ error: "Category not found" }, 404);
  return json({ ok: true, category: data[0] });
}
