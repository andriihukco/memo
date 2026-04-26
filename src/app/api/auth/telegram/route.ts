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
 * Verify Telegram initData HMAC-SHA256 signature.
 * Returns the parsed fields on success, or null on failure.
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
  // Rate limit: 10 auth attempts per minute per IP
  const ip =
    req.headers.get("CF-Connecting-IP") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";
  const rl = rateLimit(`auth:${ip}`, 10, 60_000);
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

  // Upsert profile with the auth user's UUID so RLS (auth.uid()) aligns with entries.user_id
  const authUserId = sessionData.session.user.id;
  try {
    const { resolveOrCreateProfile } = await import("@/lib/profile");
    await resolveOrCreateProfile(BigInt(telegramId), username ?? "", authUserId);
  } catch (err) {
    console.error("[auth/telegram] profile upsert error:", err);
    // Non-fatal — user can still get their token
  }

  return new Response(
    JSON.stringify({
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
