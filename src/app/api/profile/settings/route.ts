export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/locales";

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

async function resolveProfile(jwt: string) {
  const supabase = makeServiceClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) return { supabase, user: null, profile: null };

  const telegramId = user.user_metadata?.telegram_id as string | undefined;
  const lookupColumn = telegramId ? "telegram_id" : "id";
  const lookupValue = telegramId ?? user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, settings")
    .eq(lookupColumn, lookupValue)
    .single();

  return { supabase, user, profile };
}

export async function GET(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { user, profile } = await resolveProfile(jwt);
  if (!user || !profile) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const settings = (profile.settings as Record<string, unknown>) ?? {};
  const language = settings.language;
  const locale: Locale | null =
    typeof language === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(language)
      ? (language as Locale)
      : null;

  return new Response(JSON.stringify({ language: locale ?? "uk" }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function PATCH(req: Request): Promise<Response> {
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

  const body = await req.json().catch(() => ({})) as { language?: string };
  const { language } = body;

  if (!language || !(SUPPORTED_LOCALES as readonly string[]).includes(language)) {
    return new Response(JSON.stringify({ error: "Invalid locale" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const locale = language as Locale;

  // Look up profile by telegram_id when available, fall back to id
  const telegramId = user.user_metadata?.telegram_id as string | undefined;
  const lookupColumn = telegramId ? "telegram_id" : "id";
  const lookupValue = telegramId ?? user.id;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, settings")
    .eq(lookupColumn, lookupValue)
    .single();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const newSettings = {
    ...((profile.settings as Record<string, unknown>) ?? {}),
    language: locale,
  };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ settings: newSettings })
    .eq("id", profile.id);

  if (updateError) {
    console.error("[api/profile/settings] update error:", updateError.message);
    return new Response(JSON.stringify({ error: "Failed to update settings" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
