import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deriveUserKey, encryptField } from "@/lib/crypto";

/** Bearer token from the request, or null. */
export function bearerOf(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  return auth?.startsWith("Bearer ") ? auth.slice(7) : null;
}

/** A client that acts as the signed-in user, so row-level security applies. */
export function userClient(jwt: string): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
}

/** A service client for storage. Used only after the request has been checked against the user's rows. */
export function serviceClient(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** Encrypts entry text the way the bot and the entries API do. Plain text when no key is set up. */
export async function sealText(jwt: string, text: string): Promise<string> {
  const supabase = userClient(jwt);
  const { data } = await supabase.from("profiles").select("telegram_id, encryption_key_id, encryption_salt").single();
  const keyId = data?.encryption_key_id ?? (data?.telegram_id ? String(data.telegram_id) : null);
  if (!keyId) return text;
  const key = await deriveUserKey(String(keyId), data?.encryption_salt ?? null);
  return encryptField(text, key);
}

/** The profile id of the signed-in user, or null. */
export async function profileIdOf(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("id").single();
  return (data?.id as string | undefined) ?? null;
}
