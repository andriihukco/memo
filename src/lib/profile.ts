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

  // Fast path: try to create the user first.
  // If it succeeds, we're done. If it fails with "already exists", look up by email.
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { telegram_id: telegramId, username },
  });

  if (created?.user) return created.user.id;

  // User already exists — look up by email using paginated search.
  // We iterate pages until we find the user or exhaust all pages.
  if (error) {
    const found = await findAuthUserByEmail(supabase, email);
    if (found) return found;
    throw new ProfileError(`Failed to create auth user for telegram_id ${telegramId}: ${error.message}`);
  }

  throw new ProfileError(`Failed to create auth user for telegram_id ${telegramId}: unknown error`);
}

/**
 * Find a Supabase Auth user by email, paginating through all users.
 * Returns the user's UUID or null if not found.
 *
 * This is the reliable fallback when createUser returns an "already exists" error.
 * The Supabase JS admin SDK doesn't expose getUserByEmail directly, so we paginate.
 */
async function findAuthUserByEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { auth: { admin: { listUsers: (opts: { page: number; perPage: number }) => Promise<{ data: { users: Array<{ id: string; email?: string }> } | null; error: unknown }> } } },
  email: string
): Promise<string | null> {
  const PAGE_SIZE = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });

    if (error || !data?.users) break;

    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;

    // If we got fewer results than the page size, we've reached the last page
    if (data.users.length < PAGE_SIZE) break;

    page++;
  }

  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve an existing profile or create a new one for the given Telegram user,
 * ensuring the profile is always aligned with a Supabase Auth account.
 *
 * **Upsert logic:**
 * 1. Call `ensureAuthUser()` to guarantee a Supabase Auth user exists for this
 *    `telegramId`. If `authUserId` is already known (e.g. from a fresh sign-in),
 *    it is used directly to skip the lookup.
 * 2. Query `profiles` by `telegram_id`. If a row is found, update `username` if
 *    it has changed and return the existing profile. The `profile.id` is **not**
 *    migrated to match `authUserId` — doing so would wipe subscription data.
 * 3. If no profile exists, generate a random 32-byte hex `encryption_salt` and
 *    insert a new row with `id = resolvedAuthId` so that `profile.id === auth.uid()`
 *    and RLS policies work for both the bot (service role) and the mini app (JWT).
 *
 * **Synthetic Auth account creation** (`ensureAuthUser`):
 * - A deterministic synthetic email `telegram_<id>@memo.app` and a derived
 *   password are used so the same credentials can be reproduced on any server.
 * - `createUser` is attempted first; if the user already exists the function
 *   falls back to `listUsers` to retrieve the existing UUID.
 *
 * @param telegramId - The user's Telegram numeric ID as a `bigint`.
 * @param username - The user's Telegram username (may be empty string).
 * @param authUserId - Optional pre-resolved Supabase Auth UUID. When provided,
 *   the `ensureAuthUser` network call is skipped.
 * @returns The resolved or newly created `Profile` record.
 * @throws {ProfileError} If the Supabase Auth user cannot be created or looked
 *   up, or if the `profiles` insert fails.
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
    // Profile exists — use it as-is, just update username if changed
    // NOTE: We do NOT migrate profile IDs anymore — it wipes subscription data
    // The profile.id may differ from authUserId; that's acceptable since we use
    // service role for all DB operations in the miniapp
    if (username && existing.username !== username) {
      await supabase.from("profiles").update({ username }).eq("id", existing.id);
    }

    return { ...existing, telegram_id: BigInt(existing.telegram_id) } as Profile;
  }

  // Generate a random 32-byte hex salt for per-user key derivation.
  // This salt is stored in profiles.encryption_salt and passed to
  // deriveUserKey() so that each user's encryption key is unique even
  // if two users share the same telegram_id (impossible in practice, but
  // the salt adds an extra layer of key isolation).
  const encryptionSalt = Buffer.from(
    globalThis.crypto.getRandomValues(new Uint8Array(32))
  ).toString("hex");

  // Create new profile with the correct auth-aligned id
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: resolvedAuthId,
      telegram_id: telegramIdStr,
      username: username || null,
      encryption_salt: encryptionSalt,
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
