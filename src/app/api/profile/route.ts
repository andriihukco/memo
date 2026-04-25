export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

function getUserJwt(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function makeAnonClient(jwt: string) {
  return createClient(
    env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
    {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    }
  );
}

function makeServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
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

  const supabase = makeAnonClient(jwt);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, subscription_tier, subscription_status, subscription_ends_at, subscription_start_date")
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

export async function PATCH(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  // Verify user identity
  const anonClient = makeAnonClient(jwt);
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  const body = await req.json().catch(() => ({})) as { downgrade?: boolean };

  if (body.downgrade) {
    // Immediately downgrade to free — cancel subscription
    const supabase = makeServiceClient();

    await supabase
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", user.id)
      .eq("status", "active");

    await supabase
      .from("profiles")
      .update({
        subscription_tier: "free",
        subscription_status: "canceled",
        subscription_ends_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Unknown operation" }), { status: 400, headers: { "Content-Type": "application/json" } });
}
