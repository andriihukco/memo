import { createClient } from "@supabase/supabase-js";

/**
 * Find a Supabase Auth user by email, paginating through all users.
 * Returns the user's UUID or null if not found.
 *
 * The Supabase JS admin SDK doesn't expose getUserByEmail directly, so we
 * paginate. This is the reliable fallback when createUser returns "already exists".
 * Using listUsers() without perPage only returns 50 users — broken at scale.
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

    // Fewer results than page size means we've reached the last page
    if (data.users.length < PAGE_SIZE) break;

    page++;
  }

  return null;
}

type Result = { ok: true; body: Record<string, unknown> } | { ok: false; status: number; error: string };

/**
 * Find or create the Supabase auth user + profile for a Telegram id and return
 * the session payload that Boot expects. Shared by /api/auth/telegram and /api/auth/dev.
 */
export async function createTelegramSession(opts: {
  telegramId: string;
  username?: string;
  startParam?: string;
  supabaseUrl: string;
  serviceRoleKey: string;
}): Promise<Result> {
  const { telegramId, username, startParam, supabaseUrl, serviceRoleKey } = opts;
  // Upsert Supabase auth user using a stable synthetic email + deterministic password
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const email = `telegram_${telegramId}@memo.app`;
  // Deterministic password: HMAC of telegram_id with service role key as secret
  // This is server-side only and never exposed to the client
  const password = `tg_${telegramId}_${serviceRoleKey.slice(-8)}`;

  // Try to create the auth user first (fast path for new users).
  // If the user already exists, createUser returns an error — we then look up
  // by email using paginated search to get their existing UUID.
  // NOTE: listUsers() without perPage returns only 50 users — unreliable at scale.
  const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { telegram_id: telegramId, username: username ?? "" },
  });

  let existingUserId: string | null = null;

  if (createdUser?.user) {
    // New user created successfully — nothing more to do
    existingUserId = createdUser.user.id;
  } else if (createError) {
    // User likely already exists — paginate through all auth users to find them
    existingUserId = await findAuthUserByEmail(supabase, email);

    if (!existingUserId) {
      console.error("[auth/telegram] createUser error and user not found:", createError.message);
      return { ok: false, status: 500, error: "Failed to create user" };
    }

    // Update username metadata if it changed
    if (username) {
      await supabase.auth.admin.updateUserById(existingUserId, {
        user_metadata: { telegram_id: telegramId, username },
      });
    }
  }

  // Sign in with email+password to get a real session JWT
  const { data: sessionData, error: sessionError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (sessionError || !sessionData.session) {
    console.error("[auth/telegram] signIn error:", sessionError?.message);
    return { ok: false, status: 500, error: "Failed to create session" };
  }

  const referralCode = startParam?.startsWith("ref_") ? startParam.slice(4) : undefined;

  // Upsert profile with the auth user's UUID so RLS (auth.uid()) aligns with entries.user_id
  const authUserId = sessionData.session.user.id;
  let isNewUser = false;
  let referrerUsername: string | null = null;

  try {
    const { resolveOrCreateProfile } = await import("@/lib/profile");
    const profile = await resolveOrCreateProfile(BigInt(telegramId), username ?? "", authUserId);
    // Detect new users: profile was just created (created_at within last 10 seconds)
    const createdAt = new Date(profile.created_at).getTime();
    isNewUser = Date.now() - createdAt < 10_000;
  } catch (err) {
    console.error("[auth/telegram] profile upsert error:", err);
    // Non-fatal — user can still get their token
  }

  // If this is a new user arriving via a referral link, link them to the referrer
  if (isNewUser && referralCode) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    try {
      // Look up the referral row by code
      const { data: referralRow } = await sb
        .from("referrals")
        .select("id, referrer_id, referred_id")
        .eq("code", referralCode)
        .maybeSingle() as { data: { id: string; referrer_id: string; referred_id: string | null } | null };

      if (referralRow && !referralRow.referred_id) {
        // Get the new user's profile id
        const { data: newProfile } = await sb
          .from("profiles")
          .select("id")
          .eq("telegram_id", telegramId)
          .maybeSingle() as { data: { id: string } | null };

        if (newProfile && newProfile.id !== referralRow.referrer_id) {
          // Link the referred user to this referral row
          await sb
            .from("referrals")
            .update({ referred_id: newProfile.id })
            .eq("id", referralRow.id);

          // Fetch referrer's username for the welcome banner
          const { data: referrerProfile } = await sb
            .from("profiles")
            .select("username")
            .eq("id", referralRow.referrer_id)
            .maybeSingle() as { data: { username: string | null } | null };

          referrerUsername = referrerProfile?.username ?? null;
        }
      }
    } catch (err) {
      console.error("[auth/telegram] referral linking error:", err);
      // Non-fatal
    }
  }

  return {
    ok: true,
    body: {
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      referral_code: referralCode ?? null,
      referrer_username: referrerUsername,
      is_new_user: isNewUser,
    },
  };
}
