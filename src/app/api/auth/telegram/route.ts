export const runtime = "edge";

import { createClient } from "@supabase/supabase-js";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Encode a string as UTF-8 bytes */
function encode(s: string): ArrayBuffer {
  return new TextEncoder().encode(s).buffer as ArrayBuffer;
}

/** Hex-encode a byte array */
function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time comparison of two hex strings */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify a Telegram Mini App `initData` string using HMAC-SHA256.
 *
 * **Verification process (per Telegram docs):**
 * 1. Extract the `hash` field from `initData` and remove it from the parameter set.
 * 2. Sort the remaining `key=value` pairs alphabetically and join them with `\n`
 *    to form the *data-check-string*.
 * 3. Derive a *secret key*: `HMAC-SHA256("WebAppData", botToken)`.
 * 4. Compute the *expected signature*: `HMAC-SHA256(dataCheckString, secretKey)`.
 * 5. Compare the hex-encoded signature against the received `hash` using a
 *    constant-time comparison (`timingSafeEqual`) to prevent timing attacks.
 *
 * **24-hour expiry check:** after the signature is validated, the `auth_date`
 * field (Unix timestamp) is checked. If `now - auth_date > 86400` seconds the
 * data is considered stale and `null` is returned.
 *
 * @param initData - Raw `initData` query string from `Telegram.WebApp.initData`.
 * @param botToken - The Telegram bot token used as the HMAC key material.
 * @returns The parsed `URLSearchParams` on success, or `null` if:
 *   - the `hash` field is missing,
 *   - the computed signature does not match the received hash, or
 *   - the `auth_date` is older than 24 hours.
 */
async function verifyInitData(
  initData: string,
  botToken: string
): Promise<URLSearchParams | null> {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) return null;

  // Build data-check-string: sorted key=value pairs (excluding hash), \n separated
  const entries: string[] = [];
  params.forEach((value, key) => {
    if (key !== "hash") entries.push(`${key}=${value}`);
  });
  entries.sort();
  const dataCheckString = entries.join("\n");

  // secret_key = HMAC-SHA256("WebAppData", bot_token)
  const secretKey = await crypto.subtle.importKey(
    "raw",
    encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const secretKeyBytes = await crypto.subtle.sign(
    "HMAC",
    secretKey,
    encode(botToken)
  );

  // signature = HMAC-SHA256(data-check-string, secret_key)
  const signingKey = await crypto.subtle.importKey(
    "raw",
    secretKeyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    signingKey,
    encode(dataCheckString)
  );

  const computedHash = toHex(signatureBytes);
  if (!timingSafeEqual(computedHash, receivedHash)) return null;

  // Check auth_date is within 24 hours
  const authDate = parseInt(params.get("auth_date") ?? "0", 10);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - authDate > 86400) return null;

  return params;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // Rate limit: 30 auth attempts per minute per IP
  const ip =
    req.headers.get("CF-Connecting-IP") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";
  const rl = rateLimit(`auth:${ip}`, 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  let body: { initData?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { initData } = body;
  if (!initData || typeof initData !== "string") {
    return new Response(JSON.stringify({ error: "Missing initData" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!botToken || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const params = await verifyInitData(initData, botToken);
  if (!params) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Extract user info from initData
  let telegramId: string;
  let username: string | undefined;
  try {
    const userJson = params.get("user");
    if (!userJson) throw new Error("No user field");
    const user = JSON.parse(userJson) as { id: number; username?: string };
    telegramId = String(user.id);
    username = user.username;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid user data" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Upsert Supabase auth user using a stable synthetic email + deterministic password
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const email = `telegram_${telegramId}@memo.app`;
  // Deterministic password: HMAC of telegram_id with service role key as secret
  // This is server-side only and never exposed to the client
  const password = `tg_${telegramId}_${serviceRoleKey.slice(-8)}`;

  // Try to find existing user first
  const { data: listData } = await supabase.auth.admin.listUsers();
  const existingUser = listData?.users?.find((u) => u.email === email);

  if (!existingUser) {
    const { error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { telegram_id: telegramId, username: username ?? "" },
    });

    if (createError) {
      console.error("[auth/telegram] createUser error:", createError.message);
      return new Response(JSON.stringify({ error: "Failed to create user" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else if (username) {
    await supabase.auth.admin.updateUserById(existingUser.id, {
      user_metadata: { telegram_id: telegramId, username },
    });
  }

  // Sign in with email+password to get a real session JWT
  const { data: sessionData, error: sessionError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (sessionError || !sessionData.session) {
    console.error("[auth/telegram] signIn error:", sessionError?.message);
    return new Response(JSON.stringify({ error: "Failed to create session" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Extract start_param — Telegram passes it as the `start_param` field in initData
  // when the user opened the bot via a deep link like t.me/bot?start=ref_XXXX
  const startParam = params.get("start_param") ?? undefined;
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
    try {
      // Look up the referral row by code
      const { data: referralRow } = await supabase
        .from("referrals")
        .select("id, referrer_id, referred_id")
        .eq("code", referralCode)
        .maybeSingle();

      if (referralRow && !referralRow.referred_id) {
        // Get the new user's profile id
        const { data: newProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("telegram_id", telegramId)
          .maybeSingle();

        if (newProfile && newProfile.id !== referralRow.referrer_id) {
          // Link the referred user to this referral row
          await supabase
            .from("referrals")
            .update({ referred_id: newProfile.id })
            .eq("id", referralRow.id);

          // Fetch referrer's username for the welcome banner
          const { data: referrerProfile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", referralRow.referrer_id)
            .maybeSingle();

          referrerUsername = referrerProfile?.username ?? null;
        }
      }
    } catch (err) {
      console.error("[auth/telegram] referral linking error:", err);
      // Non-fatal
    }
  }

  return new Response(
    JSON.stringify({
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      referral_code: referralCode ?? null,
      referrer_username: referrerUsername,
      is_new_user: isNewUser,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
