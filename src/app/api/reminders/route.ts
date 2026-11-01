export const runtime = "edge";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseBody, CreateReminderSchema } from "@/lib/schemas";

function getUserJwt(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function makeSupabase(jwt: string) {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
}

/** POST /api/reminders — schedules a reminder the bot loop delivers over Telegram. */
export async function POST(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rate limit: 30 writes/min per JWT (same budget as entries)
  const rl = await rateLimit(`reminders:write:${jwt.slice(0, 16)}`, 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const parsed = await parseBody(req, CreateReminderSchema);
  if (!parsed.success) return parsed.error;
  const { text, remind_at, repeat } = parsed.data;

  const scheduledAt = new Date(remind_at);
  // A minute of clock skew is tolerated; anything older is a mistake, not a reminder
  if (scheduledAt.getTime() < Date.now() - 60_000) {
    return new Response(JSON.stringify({ error: "remind_at must be in the future" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = makeSupabase(jwt);
  const { data: profile, error: profileErr } = await supabase.from("profiles").select("id").single();
  if (profileErr || !profile) {
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const iso = scheduledAt.toISOString();
  const { data, error } = await supabase
    .from("reminders")
    .insert({
      user_id: profile.id,
      text,
      scheduled_at: iso,
      remind_at: iso,
      status: "pending",
      repeat,
      done: false,
    })
    .select("id, text, scheduled_at, repeat, status")
    .single();

  if (error) {
    console.error("[api/reminders POST] insert error:", error.message);
    return new Response(JSON.stringify({ error: "Failed to create reminder" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ reminder: data }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
