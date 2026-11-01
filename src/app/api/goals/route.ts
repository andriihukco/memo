export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const GoalSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(60),
  metric: z.string().trim().min(1).max(32).regex(/^[a-z0-9_]+$/, "metric: lowercase letters, digits, underscore"),
  unit: z.string().trim().max(16),
  target: z.number().positive().max(1_000_000),
  period: z.enum(["day", "week"]),
});
const GoalsSchema = z.array(GoalSchema).max(20);

export type GoalInput = z.infer<typeof GoalSchema>;

function clientFor(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** GET: the user's goals, stored in profiles.settings.goals. */
export async function GET(req: Request): Promise<Response> {
  const db = clientFor(req);
  if (!db) return json({ error: "Unauthorized" }, 401);
  const { data, error } = await db.from("profiles").select("settings").single();
  if (error || !data) return json({ error: "Unauthorized" }, 401);
  const goals = (data.settings as Record<string, unknown>)?.goals ?? [];
  return json({ goals: Array.isArray(goals) ? goals : [] });
}

/** PUT: replace the goal list. Other settings are kept. */
export async function PUT(req: Request): Promise<Response> {
  const db = clientFor(req);
  if (!db) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => null) as { goals?: unknown } | null;
  const parsed = GoalsSchema.safeParse(body?.goals);
  if (!parsed.success) return json({ error: "Invalid goals", issues: parsed.error.issues.map((i) => i.message) }, 400);

  const { data: profile, error: readErr } = await db.from("profiles").select("id, settings").single();
  if (readErr || !profile) return json({ error: "Unauthorized" }, 401);

  const settings = { ...((profile.settings as Record<string, unknown>) ?? {}), goals: parsed.data };
  const { error } = await db.from("profiles").update({ settings }).eq("id", profile.id);
  if (error) return json({ error: "Could not save goals" }, 500);
  return json({ goals: parsed.data });
}
