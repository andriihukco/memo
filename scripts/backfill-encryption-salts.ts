/**
 * Backfill encryption salts for existing users.
 *
 * OVERVIEW
 * --------
 * When the `encryption_salt` column was added (migration 20240001000016), existing
 * profiles were left with `encryption_salt = NULL`.  Those users' entries are
 * encrypted with the legacy key:
 *
 *   IKM = SHA-256(telegram_id)
 *
 * New users get a random 32-byte hex salt and their entries are encrypted with:
 *
 *   IKM = SHA-256(telegram_id + ":" + salt)
 *
 * This script migrates every profile that still has `encryption_salt IS NULL`:
 *   1. Generate a random 32-byte hex salt.
 *   2. Derive the OLD key  (telegram_id only — legacy path).
 *   3. Derive the NEW key  (telegram_id + ":" + salt).
 *   4. Decrypt every entry with the old key, re-encrypt with the new key.
 *   5. In a single Supabase transaction-like batch:
 *      a. Update `profiles.encryption_salt` to the new salt.
 *      b. Update every affected entry's `content` to the new ciphertext.
 *
 * IDEMPOTENCY
 * -----------
 * The script skips any profile where `encryption_salt IS NOT NULL`.  It is safe
 * to run multiple times — subsequent runs are no-ops for already-migrated users.
 *
 * PREREQUISITES
 * -------------
 * Required env vars (copy from .env.local or Vercel):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ENTRY_ENCRYPTION_PEPPER
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/backfill-encryption-salts.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ROLLBACK PROCEDURE
 * ─────────────────────────────────────────────────────────────────────────────
 * If the migration must be reversed (e.g. a bug is discovered after running):
 *
 * 1. STOP all running instances of the application immediately to prevent new
 *    writes that use the new salt-derived keys.
 *
 * 2. For each migrated profile, the old ciphertext is GONE — the only way to
 *    recover is from a database backup taken BEFORE this script ran.
 *    → Restore the Supabase database from the pre-migration snapshot.
 *    → Supabase dashboard → Settings → Backups → Point-in-time restore.
 *
 * 3. If a full restore is not possible, run the REVERSE script below (manual):
 *    For each profile that was migrated (you can identify them by checking
 *    `profiles.encryption_salt IS NOT NULL` and comparing `updated_at`):
 *      a. Derive the NEW key using the stored salt.
 *      b. Decrypt all entries with the new key.
 *      c. Re-encrypt with the OLD key (telegram_id only, no salt).
 *      d. Set `profiles.encryption_salt = NULL`.
 *    This is the exact inverse of what this script does.
 *
 * 4. After rollback, redeploy the previous application version that uses the
 *    legacy key derivation path.
 *
 * IMPORTANT: Take a database snapshot BEFORE running this script.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * RUN IN MAINTENANCE WINDOW
 * ─────────────────────────────────────────────────────────────────────────────
 * This script re-encrypts all entries for affected users.  During execution,
 * the application should be in maintenance mode (or at minimum, the affected
 * users should not be actively writing new entries) to avoid a race condition
 * where a new entry is written with the old key after the profile salt has
 * already been updated.
 *
 * Coordinate with the team before executing.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";

// ── Env ───────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ENTRY_ENCRYPTION_PEPPER = process.env.ENTRY_ENCRYPTION_PEPPER!;

// ── Crypto constants (must match src/lib/crypto.ts exactly) ──────────────────

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const VERSION = 0x01;
const ENC_PREFIX = "enc:";
const INFO = new TextEncoder().encode("memo-entry-encryption-v1");

// ── Crypto helpers ────────────────────────────────────────────────────────────

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive a per-user AES-256-GCM key.
 * When `salt` is null/undefined/"" → legacy path (telegram_id only).
 * When `salt` is a non-empty string → new path (telegram_id:salt).
 */
async function deriveUserKey(telegramUserId: string, salt?: string | null): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  const ikm = salt != null && salt !== "" ? `${telegramUserId}:${salt}` : telegramUserId;
  const ikmRaw = new TextEncoder().encode(ikm);
  const ikmHash = await subtle.digest("SHA-256", ikmRaw);

  const hkdfKey = await subtle.importKey("raw", ikmHash, { name: "HKDF" }, false, ["deriveKey"]);
  const hkdfSalt = new TextEncoder().encode(ENTRY_ENCRYPTION_PEPPER);

  return subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: hkdfSalt, info: INFO },
    hkdfKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Decrypt a value produced by encryptField().
 * Returns the original plaintext, or the input unchanged if it is not encrypted
 * (legacy plaintext entries during migration window).
 */
async function decryptField(value: string, key: CryptoKey): Promise<string> {
  if (!value.startsWith(ENC_PREFIX)) {
    // Legacy plaintext — return as-is (no re-encryption needed for these)
    return value;
  }

  const subtle = globalThis.crypto.subtle;
  const packed = base64ToUint8(value.slice(ENC_PREFIX.length));

  if (packed[0] !== VERSION) {
    throw new Error(`[crypto] Unknown encryption version: ${packed[0]}`);
  }

  const iv = packed.slice(1, 1 + IV_LENGTH);
  const ciphertext = packed.slice(1 + IV_LENGTH);

  const plaintext = await subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

/**
 * Encrypt a plaintext string. Returns "enc:<base64>".
 */
async function encryptField(plaintext: string, key: CryptoKey): Promise<string> {
  const subtle = globalThis.crypto.subtle;
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await subtle.encrypt({ name: ALGORITHM, iv }, key, encoded);

  const packed = new Uint8Array(1 + IV_LENGTH + ciphertext.byteLength);
  packed[0] = VERSION;
  packed.set(iv, 1);
  packed.set(new Uint8Array(ciphertext), 1 + IV_LENGTH);

  return ENC_PREFIX + uint8ToBase64(packed);
}

/**
 * Generate a random 32-byte hex salt.
 */
function generateSalt(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  telegram_id: string;
  encryption_salt: string | null;
}

interface Entry {
  id: string;
  content: string;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Validate env vars
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ENTRY_ENCRYPTION_PEPPER) {
    console.error(
      "❌ Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENTRY_ENCRYPTION_PEPPER"
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  console.log("🔍 Querying profiles with encryption_salt IS NULL...");

  // 17.2 — Query all profiles where encryption_salt IS NULL
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, telegram_id, encryption_salt")
    .is("encryption_salt", null);

  if (profilesError) {
    console.error("❌ Failed to fetch profiles:", profilesError.message);
    process.exit(1);
  }

  if (!profiles || profiles.length === 0) {
    console.log("✅ No profiles with NULL encryption_salt found. Nothing to do.");
    return;
  }

  console.log(`📋 Found ${profiles.length} profile(s) to migrate.\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const profile of profiles as Profile[]) {
    // 17.6 — Idempotency: skip profiles that already have a salt
    // (This guard is redundant given the IS NULL query above, but kept for
    // safety in case the script is modified to query differently in future.)
    if (profile.encryption_salt != null && profile.encryption_salt !== "") {
      console.log(`  ⏭  [${profile.id}] Already has salt — skipping.`);
      skippedCount++;
      continue;
    }

    const telegramId = String(profile.telegram_id);
    console.log(`  🔄 [${profile.id}] telegram_id=${telegramId} — migrating...`);

    try {
      // 17.3 — Generate a random 32-byte hex salt
      const newSalt = generateSalt();

      // Derive old key (legacy: telegram_id only, no salt)
      const oldKey = await deriveUserKey(telegramId, null);

      // Derive new key (telegram_id + salt)
      const newKey = await deriveUserKey(telegramId, newSalt);

      // Fetch all entries for this user
      const { data: entries, error: entriesError } = await supabase
        .from("entries")
        .select("id, content")
        .eq("user_id", profile.id);

      if (entriesError) {
        console.error(`     ❌ Failed to fetch entries: ${entriesError.message}`);
        errorCount++;
        continue;
      }

      const entryList = (entries ?? []) as Entry[];
      console.log(`     📝 ${entryList.length} entries to re-encrypt.`);

      // 17.4 — Re-encrypt all entries: decrypt with old key, encrypt with new key
      const reencryptedEntries: Array<{ id: string; content: string }> = [];

      for (const entry of entryList) {
        // Decrypt with old key (handles both "enc:" prefixed and legacy plaintext)
        const plaintext = await decryptField(entry.content, oldKey);

        // Only re-encrypt values that were actually encrypted (enc: prefix).
        // Plaintext entries stay plaintext — they were never encrypted, so
        // there is nothing to re-key. The new key will be used for future writes.
        if (entry.content.startsWith(ENC_PREFIX)) {
          const newCiphertext = await encryptField(plaintext, newKey);
          reencryptedEntries.push({ id: entry.id, content: newCiphertext });
        }
        // Plaintext entries: no update needed
      }

      // 17.5 — Update entries and profile salt atomically
      // Supabase JS does not expose raw transactions, so we update entries first
      // and then the profile salt. If the profile update fails, the entries will
      // have been re-encrypted with the new key but the profile still has NULL
      // salt — on the next run, the script will re-derive the old key (NULL path)
      // which will fail to decrypt the new ciphertext. To guard against this,
      // we update the profile salt FIRST, then the entries.
      //
      // Order: profile salt → entries
      // If entries update fails after profile salt is set, the entries are still
      // encrypted with the old key but the profile now has a salt. The next run
      // will skip this profile (salt IS NOT NULL). Manual intervention is needed.
      // This is why a maintenance window and pre-migration backup are required.

      // Step 1: Update profile salt
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ encryption_salt: newSalt })
        .eq("id", profile.id);

      if (profileUpdateError) {
        console.error(`     ❌ Failed to update profile salt: ${profileUpdateError.message}`);
        errorCount++;
        continue;
      }

      // Step 2: Update re-encrypted entries (in batches of 50)
      const BATCH_SIZE = 50;
      let entryErrors = 0;

      for (let i = 0; i < reencryptedEntries.length; i += BATCH_SIZE) {
        const batch = reencryptedEntries.slice(i, i + BATCH_SIZE);

        // Update each entry individually (Supabase JS doesn't support bulk update
        // with different values per row without using RPC or raw SQL)
        for (const { id, content } of batch) {
          const { error: entryUpdateError } = await supabase
            .from("entries")
            .update({ content })
            .eq("id", id);

          if (entryUpdateError) {
            console.error(`     ❌ Failed to update entry ${id}: ${entryUpdateError.message}`);
            entryErrors++;
          }
        }
      }

      if (entryErrors > 0) {
        console.error(
          `     ⚠️  ${entryErrors} entry update(s) failed. Profile salt was already updated.`
        );
        console.error(
          `     ⚠️  Manual intervention required for profile ${profile.id}.`
        );
        errorCount++;
      } else {
        const reencryptedCount = reencryptedEntries.length;
        const plaintextCount = entryList.length - reencryptedCount;
        console.log(
          `     ✅ Done. Re-encrypted ${reencryptedCount} entries` +
          (plaintextCount > 0 ? `, ${plaintextCount} plaintext entries left as-is.` : ".")
        );
        migratedCount++;
      }
    } catch (err) {
      console.error(`     ❌ Unexpected error for profile ${profile.id}:`, err);
      errorCount++;
    }
  }

  console.log("\n─────────────────────────────────────────────────────────");
  console.log(`✅ Migrated:  ${migratedCount} profile(s)`);
  console.log(`⏭  Skipped:   ${skippedCount} profile(s) (already had salt)`);
  console.log(`❌ Errors:    ${errorCount} profile(s)`);
  console.log("─────────────────────────────────────────────────────────");

  if (errorCount > 0) {
    console.error("\n⚠️  Some profiles failed to migrate. Check logs above.");
    console.error("   Do NOT restart the application until all errors are resolved.");
    process.exit(1);
  }

  console.log("\n🎉 Backfill complete. All existing users now have per-user encryption salts.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
