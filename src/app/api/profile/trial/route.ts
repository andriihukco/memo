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
 * POST /api/profile/trial
 *
 * Activates a 3-day free trial of the Nova (stars_basic) tier for the
 * authenticated user, subject to the following conditions:
 *   1. The user has never activated a trial before (trial_used = false).
 *   2. The user has never had a paid subscription (no active/canceled
 *      subscription rows in the subscriptions table).
 *
 * The update is performed atomically using a single UPDATE … WHERE trial_used = false
 * to prevent race conditions (Req 13.4 / design property 8).
 *
 * Returns the updated profile on success, or an appropriate error response.
 */
export async function POST(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = makeServiceClient();

  // Verify token and get user id
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check that the user has never had a paid subscription
  const { count: paidCount, error: subError } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["active", "canceled", "expired"]);

  if (subError) {
    console.error("[api/profile/trial] subscription check error:", subError.message);
    return new Response(JSON.stringify({ error: "Failed to check subscription history" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if ((paidCount ?? 0) > 0) {
    return new Response(
      JSON.stringify({ error: "Trial not available: user has prior paid subscription" }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  // Compute trial end date: now + 3 days
  const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  // Atomically activate trial — only succeeds if trial_used is still false.
  // This prevents double-activation under concurrent requests.
  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({
      subscription_tier: "stars_basic",
      subscription_ends_at: trialEndsAt,
      trial_used: true,
    })
    .eq("id", user.id)
    .eq("trial_used", false)
    .select(
      "id, subscription_tier, subscription_status, subscription_ends_at, subscription_start_date, trial_used"
    )
    .single();

  if (updateError || !updated) {
    // Either a DB error or trial_used was already true (concurrent request won)
    if (!updateError) {
      return new Response(
        JSON.stringify({ error: "Trial already used" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }
    console.error("[api/profile/trial] update error:", updateError.message);
    return new Response(JSON.stringify({ error: "Failed to activate trial" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ profile: updated }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
