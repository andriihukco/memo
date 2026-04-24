export const runtime = "edge";

import { createClient } from "@supabase/supabase-js";

function getUserJwt(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function makeSupabase(jwt: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    }
  );
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

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, subscription_tier, subscription_status, subscription_ends_at")
    .single();

  if (error) {
    console.error("[api/profile] query error:", error.message);
    return new Response(JSON.stringify({ error: "Failed to load profile" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ profile }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
