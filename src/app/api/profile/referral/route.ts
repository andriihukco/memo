export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

function getUserJwt(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function makeServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * GET /api/profile/referral
 *
 * Returns (or creates) the referral deep-link for the authenticated user.
 * Response: { link: string }
 */
export async function GET(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = makeServiceClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Resolve profile id via telegram_id in metadata (same pattern as profile route)
  const telegramId = user.user_metadata?.telegram_id as string | undefined;
  const lookupColumn = telegramId ? "telegram_id" : "id";
  const lookupValue = telegramId ?? user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq(lookupColumn, lookupValue)
    .single();

  if (!profile) {
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch existing referral code for this user
  const { data: existing } = await supabase
    .from("referrals")
    .select("code")
    .eq("referrer_id", profile.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let code: string;

  if (existing?.code) {
    code = existing.code;
  } else {
    // Generate a new unique referral code (12 hex chars)
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    code = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");

    const { error: insertError } = await supabase.from("referrals").insert({
      referrer_id: profile.id,
      code,
    });

    if (insertError) {
      console.error("[api/profile/referral] insert error:", insertError.message);
      return new Response(JSON.stringify({ error: "Failed to create referral code" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "memo_r0bot";
  const link = `https://t.me/${botUsername}?start=ref_${code}`;

  return new Response(JSON.stringify({ link, code }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
