export const runtime = "edge";

import { createClient } from "@supabase/supabase-js";
import { createTelegramSession } from "@/lib/auth-session";
import { isDevAuthAllowed } from "@/lib/dev-auth";
import { deriveUserKey, encryptField } from "@/lib/crypto";
import { colorForNewCategory } from "@/lib/classifier";

const DEV_TELEGRAM_ID = "999000001";

type Sample = { day: number; category: string; label: string; content: string; metric: [string, string, number, string, "sum" | "avg" | "last"] };

const SAMPLES: Sample[] = [
  { day: 0, category: "food", label: "Food", content: "Oatmeal with berries and coffee", metric: ["calories", "Calories", 420, "kcal", "sum"] },
  { day: 0, category: "sport", label: "Sport", content: "Morning run in the park", metric: ["distance", "Distance", 5.2, "km", "sum"] },
  { day: 1, category: "sleep", label: "Sleep", content: "Slept well, woke up rested", metric: ["sleep", "Sleep", 7.5, "h", "last"] },
  { day: 1, category: "money", label: "Money", content: "Groceries at the market", metric: ["amount", "Spent", 640, "UAH", "sum"] },
  { day: 2, category: "mood", label: "Mood", content: "Calm and focused day", metric: ["mood", "Mood", 8, "/10", "avg"] },
  { day: 3, category: "food", label: "Food", content: "Chicken salad for lunch", metric: ["calories", "Calories", 550, "kcal", "sum"] },
  { day: 3, category: "sport", label: "Sport", content: "Gym: legs and core", metric: ["duration", "Duration", 55, "min", "sum"] },
  { day: 4, category: "sleep", label: "Sleep", content: "Late night, short sleep", metric: ["sleep", "Sleep", 5.5, "h", "last"] },
  { day: 5, category: "money", label: "Money", content: "Bought a book and a coffee", metric: ["amount", "Spent", 320, "UAH", "sum"] },
  { day: 6, category: "mood", label: "Mood", content: "A bit tired, but happy", metric: ["mood", "Mood", 6, "/10", "avg"] },
  { day: 7, category: "sport", label: "Sport", content: "Long evening walk", metric: ["distance", "Distance", 8.1, "km", "sum"] },
  { day: 8, category: "food", label: "Food", content: "Pasta dinner with friends", metric: ["calories", "Calories", 780, "kcal", "sum"] },
  { day: 9, category: "sleep", label: "Sleep", content: "Solid night", metric: ["sleep", "Sleep", 8, "h", "last"] },
  { day: 9, category: "money", label: "Money", content: "Taxi and lunch", metric: ["amount", "Spent", 410, "UAH", "sum"] },
];

export async function POST(req: Request): Promise<Response> {
  if (!isDevAuthAllowed(process.env.NODE_ENV, req.headers.get("host"))) {
    return new Response(null, { status: 404 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { seed?: boolean };

  const result = await createTelegramSession({
    telegramId: DEV_TELEGRAM_ID,
    username: "dev_tester",
    supabaseUrl,
    serviceRoleKey,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  if (body.seed === true) {
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, encryption_salt, settings")
      .eq("telegram_id", DEV_TELEGRAM_ID)
      .single();
    if (profile) {
      const { count } = await supabase
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id);
      if (count === 0) {
        const key = await deriveUserKey(DEV_TELEGRAM_ID, profile.encryption_salt ?? null);
        const cats = [...new Map(SAMPLES.map((s) => [s.category, s.label])).entries()];
        await supabase.from("categories").upsert(
          cats.map(([name, label]) => ({
            user_id: profile.id, name, label_ua: label, color: colorForNewCategory(name), icon: "tag",
          })),
          { onConflict: "user_id,name", ignoreDuplicates: true }
        );
        const rows = await Promise.all(SAMPLES.map(async (s, i) => {
          const [k, label, value, unit, aggregate] = s.metric;
          const created = new Date(Date.now() - s.day * 86_400_000 - i * 60_000);
          return {
            user_id: profile.id,
            content: await encryptField(s.content, key),
            category: s.category,
            metadata: { dashboard_metrics: [{ key: k, label, value, unit, aggregate }] },
            raw_media_url: null,
            created_at: created.toISOString(),
          };
        }));
        const { error } = await supabase.from("entries").insert(rows);
        if (error) console.error("[dev-auth] seed insert failed:", error.message);
      }
      await supabase
        .from("profiles")
        .update({ settings: { ...(profile.settings as object), onboarded: true } })
        .eq("id", profile.id);
    }
  }

  return Response.json(result.body);
}
