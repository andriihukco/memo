export const runtime = "edge";

import { createClient } from "@supabase/supabase-js";

function getUserJwt(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export async function DELETE(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

  // Use the user's JWT to identify who they are (RLS-scoped)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

  // Get the current user's auth ID from the JWT
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authUserId = user.id;

  // Delete the profile row — cascades entries, insights, categories, etc.
  const { error: profileDeleteError } = await userClient
    .from("profiles")
    .delete()
    .eq("id", authUserId);

  if (profileDeleteError) {
    console.error("[api/profile/delete] profile delete error:", profileDeleteError.message);
    return new Response(JSON.stringify({ error: profileDeleteError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Delete the Supabase auth user using service role
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(authUserId);
  if (authDeleteError) {
    // Non-fatal — profile data is already gone
    console.error("[api/profile/delete] auth user delete error:", authDeleteError.message);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
