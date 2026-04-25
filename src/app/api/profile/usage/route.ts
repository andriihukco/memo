import { createClient } from "@supabase/supabase-js";
import { getUserUsageCounts } from "@/lib/stars/paywall";

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

  // Get the authenticated user's ID from the JWT
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const counts = await getUserUsageCounts(user.id);
    return new Response(JSON.stringify(counts), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[api/profile/usage] error:", err);
    return new Response(JSON.stringify({ error: "Failed to load usage counts" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
