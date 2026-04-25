/**
 * Entry encryption — AES-256-GCM with HKDF-SHA-256 key derivation.
 *
 * Key derivation (Option A — Telegram-derived):
 *   ikm  = SHA-256(telegram_user_id)          — deterministic per user
 *   salt = ENTRY_ENCRYPTION_PEPPER            — server secret, never in DB
 *   info = "memo-entry-encryption-v1"
 *   → 256-bit AES-GCM key
 *
 * Wire format (base64-encoded):
 *   [1 byte version=0x01] [12 bytes IV] [N bytes ciphertext+16 byte GCM tag]
 *
 * Encrypted values are prefixed with "enc:" so legacy plaintext entries
 * can be detected and returned as-is during the migration window.
 *
 * All operations run server-side only (API routes + bot handlers).
 * The miniapp sends/receives plaintext over HTTPS to its own API routes —
 * encryption/decryption happens at the API boundary, never in the browser.
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;   // 96-bit nonce — GCM standard
const VERSION = 0x01;
const ENC_PREFIX = "enc:";
const INFO = new TextEncoder().encode("memo-entry-encryption-v1");

/**
 * Derive a per-user AES-256-GCM CryptoKey from the Telegram user ID and
 * the server-side pepper (ENTRY_ENCRYPTION_PEPPER env var).
 *
 * Works in both browser (crypto.subtle) and Node 18+ (globalThis.crypto.subtle).
 */
export async function deriveUserKey(telegramUserId: string): Promise<CryptoKey> {
  const pepper = getEncryptionPepper();
  const subtle = getCrypto().subtle;

  // IKM = SHA-256(telegram_user_id)
  const ikmRaw = new TextEncoder().encode(telegramUserId);
  const ikmHash = await subtle.digest("SHA-256", ikmRaw);

  // Import IKM as HKDF key material
  const hkdfKey = await subtle.importKey(
    "raw",
    ikmHash,
    { name: "HKDF" },
    false,
    ["deriveKey"]
  );

  // Salt = pepper bytes
  const salt = new TextEncoder().encode(pepper);

  // Derive AES-256-GCM key
  return subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: INFO },
    hkdfKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

// ── Encrypt ───────────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string. Returns "enc:<base64>" or throws.
 * Each call generates a fresh random 12-byte IV — never reuse IVs with AES-GCM.
 */
export async function encryptField(plaintext: string, key: CryptoKey): Promise<string> {
  const subtle = getCrypto().subtle;
  const iv = getCrypto().getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );

  // Pack: [version(1)] [iv(12)] [ciphertext+tag(N+16)]
  const packed = new Uint8Array(1 + IV_LENGTH + ciphertext.byteLength);
  packed[0] = VERSION;
  packed.set(iv, 1);
  packed.set(new Uint8Array(ciphertext), 1 + IV_LENGTH);

  return ENC_PREFIX + uint8ToBase64(packed);
}

// ── Decrypt ───────────────────────────────────────────────────────────────────

/**
 * Decrypt a value produced by encryptField().
 * Returns the original plaintext, or the input unchanged if it is not encrypted
 * (legacy plaintext entries during migration window).
 */
export async function decryptField(value: string, key: CryptoKey): Promise<string> {
  if (!value.startsWith(ENC_PREFIX)) {
    // Legacy plaintext — return as-is
    return value;
  }

  const subtle = getCrypto().subtle;
  const packed = base64ToUint8(value.slice(ENC_PREFIX.length));

  if (packed[0] !== VERSION) {
    throw new Error(`[crypto] Unknown encryption version: ${packed[0]}`);
  }

  const iv = packed.slice(1, 1 + IV_LENGTH);
  const ciphertext = packed.slice(1 + IV_LENGTH);

  const plaintext = await subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

// ── isEncrypted helper ────────────────────────────────────────────────────────

export function isEncrypted(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}

// ── Environment helpers ───────────────────────────────────────────────────────

function getEncryptionPepper(): string {
  // Import lazily to avoid circular deps and Edge runtime issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pepper = process.env.ENTRY_ENCRYPTION_PEPPER ?? "";
  if (!pepper) {
    throw new Error(
      "[crypto] ENTRY_ENCRYPTION_PEPPER env var is not set. " +
      "Generate one with: openssl rand -hex 32"
    );
  }
  return pepper;
}

function getCrypto(): Crypto {
  // globalThis.crypto is available in Edge runtime, Node 18+, and all modern browsers
  return globalThis.crypto;
}

// ── Base64 helpers (no Buffer dependency — works in Edge runtime) ─────────────

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
