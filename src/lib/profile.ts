import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  telegram_id: bigint;
  username: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ── Error ─────────────────────────────────────────────────────────────────────

export class ProfileError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ProfileError";
  }
}

// ── Supabase service role client ──────────────────────────────────────────────

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ── Auth user resolution ──────────────────────────────────────────────────────

/**
 * Ensure a Supabase Auth user exists for this telegram_id.
 * Returns the auth user's UUID (which must be used as profile.id for RLS to work).
 */
async function ensureAuthUser(telegramId: string, username: string): Promise<string> {
  const supabase = getServiceClient();
  const email = `telegram_${telegramId}@memo.app`;
  const password = `tg_${telegramId}_${env.SUPABASE_SERVICE_ROLE_KEY.slice(-8)}`;

  // Try to create first — if it already exists, the error code will tell us
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { telegram_id: telegramId, username },
  });

  if (created?.user) return created.user.id;

  // User already exists — look up by email
  if (error) {
    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existing = listData?.users?.find((u) => u.email === email);
    if (existing) return existing.id;
    throw new ProfileError(`Failed to create auth user for telegram_id ${telegramId}: ${error.message}`);
  }

  throw new ProfileError(`Failed to create auth user for telegram_id ${telegramId}: unknown error`);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve or create a profile, always aligned with Supabase Auth.
 * Ensures profile.id === auth.uid() so RLS works for both bot and miniapp.
 */
export async function resolveOrCreateProfile(
  telegramId: bigint,
  username: string,
  authUserId?: string
): Promise<Profile> {
  const supabase = getServiceClient();
  const telegramIdStr = telegramId.toString();

  // Always ensure an auth user exists and get their UUID
  const resolvedAuthId = authUserId ?? await ensureAuthUser(telegramIdStr, username);

  // Check if profile already exists for this telegram_id
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, telegram_id, username, settings, created_at, updated_at")
    .eq("telegram_id", telegramIdStr)
    .maybeSingle();

  if (existing) {
    // If profile id doesn't match auth id, migrate entries and update profile
    if (existing.id !== resolvedAuthId) {
      console.log(`[profile] Migrating profile ${existing.id} → ${resolvedAuthId} for telegram_id ${telegramIdStr}`);

      // Migrate all entries to the correct user_id
      await supabase.from("entries").update({ user_id: resolvedAuthId }).eq("user_id", existing.id);
      await supabase.from("insights").update({ user_id: resolvedAuthId }).eq("user_id", existing.id);

      // Delete old profile and create new one with correct id
      await supabase.from("profiles").delete().eq("id", existing.id);
      const { data: migrated, error: migrateError } = await supabase
        .from("profiles")
        .insert({
          id: resolvedAuthId,
          telegram_id: telegramIdStr,
          username: username || null,
          settings: existing.settings ?? {},
        })
        .select("id, telegram_id, username, settings, created_at, updated_at")
        .single();

      if (migrateError) {
        throw new ProfileError(`Failed to migrate profile: ${migrateError.message}`);
      }

      return { ...migrated, telegram_id: BigInt(migrated.telegram_id) } as Profile;
    }

    // Profile already aligned — just update username if changed
    if (username && existing.username !== username) {
      await supabase.from("profiles").update({ username }).eq("id", existing.id);
    }

    return { ...existing, telegram_id: BigInt(existing.telegram_id) } as Profile;
  }

  // Create new profile with the correct auth-aligned id
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: resolvedAuthId,
      telegram_id: telegramIdStr,
      username: username || null,
    })
    .select("id, telegram_id, username, settings, created_at, updated_at")
    .single();

  if (error) {
    throw new ProfileError(
      `Failed to create profile for telegram_id ${telegramId}: ${error.message}`,
      error
    );
  }

  return { ...data, telegram_id: BigInt(data.telegram_id) } as Profile;
}
