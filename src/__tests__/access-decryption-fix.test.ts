/**
 * Bug Condition Exploration Tests — access-decryption-fix
 *
 * These tests are written BEFORE the fix is implemented.
 * They are EXPECTED TO FAIL on unfixed code — failure confirms the bugs exist.
 *
 * Bug 1: deriveUserKey with null/undefined/empty salt should produce the same
 *        key as deriveUserKey with no salt argument (legacy path).
 *        On unfixed code (if guard is absent), IKM would be "id:null" vs "id"
 *        → different keys → test FAILS.
 *
 * Bug 2: GET /api/profile queries profiles WHERE id = user.id.
 *        For pre-existing users, profile.id ≠ user.id but
 *        profile.telegram_id = user.user_metadata.telegram_id.
 *        On unfixed code, the query returns no row → 500 error → test FAILS.
 *
 * Validates: Requirements 1.1, 1.2, 1.4
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ── Environment setup ─────────────────────────────────────────────────────────

// Set up ALL required env vars before any imports that might need them
process.env.ENTRY_ENCRYPTION_PEPPER = 'test-pepper-for-exploration-tests-32bytes!!';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_role_key_exploration';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key_exploration';
process.env.TELEGRAM_BOT_TOKEN = 'test_bot_token_exploration';
process.env.GEMINI_API_KEY = 'test_gemini_api_key_exploration';

// Mock the env module to avoid validation issues with the lazy proxy cache
vi.mock('@/lib/env', () => ({
  env: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test_service_role_key_exploration',
    ENTRY_ENCRYPTION_PEPPER: 'test-pepper-for-exploration-tests-32bytes!!',
    TELEGRAM_BOT_TOKEN: 'test_bot_token_exploration',
    GEMINI_API_KEY: 'test_gemini_api_key_exploration',
  },
}));

// ── Supabase mock for Bug 2 tests ─────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Encrypt a known plaintext with a key and return the ciphertext.
 * Used to compare whether two keys are equivalent by checking if
 * they produce the same decryption result.
 */
async function encryptWithKey(plaintext: string, key: CryptoKey): Promise<string> {
  const { encryptField } = await import('@/lib/crypto');
  return encryptField(plaintext, key);
}

/**
 * Decrypt a ciphertext with a key. Returns the plaintext or throws.
 */
async function decryptWithKey(ciphertext: string, key: CryptoKey): Promise<string> {
  const { decryptField } = await import('@/lib/crypto');
  return decryptField(ciphertext, key);
}

/**
 * Assert that two CryptoKeys produce the same encryption/decryption behavior
 * by encrypting a known plaintext with key1 and decrypting with key2.
 * If the keys are equivalent, decryption succeeds and returns the original plaintext.
 */
async function assertKeysEquivalent(key1: CryptoKey, key2: CryptoKey, plaintext: string): Promise<void> {
  const ciphertext = await encryptWithKey(plaintext, key1);
  const decrypted = await decryptWithKey(ciphertext, key2);
  expect(decrypted).toBe(plaintext);
}

// ── Bug 1: Null/Falsy Salt Key Derivation ─────────────────────────────────────

describe('Bug 1 — Null/Falsy Salt Key Derivation', () => {
  /**
   * Property 1: Bug Condition — Null Salt Key Derivation
   *
   * For any telegramId, deriveUserKey(id, null) MUST produce the same key
   * as deriveUserKey(id) (no salt argument).
   *
   * On unfixed code where the guard is absent or uses unconditional template
   * literal interpolation, IKM would be "id:null" vs "id" → different keys.
   *
   * Validates: Requirements 1.2, 2.1, 2.2
   */
  it('deriveUserKey("123456789", null) produces the same key as deriveUserKey("123456789")', async () => {
    const { deriveUserKey } = await import('@/lib/crypto');
    const keyWithNull = await deriveUserKey('123456789', null);
    const keyLegacy = await deriveUserKey('123456789');
    await assertKeysEquivalent(keyWithNull, keyLegacy, 'hello world plaintext');
    await assertKeysEquivalent(keyLegacy, keyWithNull, 'reverse direction check');
  });

  it('deriveUserKey("123456789", undefined) produces the same key as deriveUserKey("123456789")', async () => {
    const { deriveUserKey } = await import('@/lib/crypto');
    const keyWithUndefined = await deriveUserKey('123456789', undefined);
    const keyLegacy = await deriveUserKey('123456789');
    await assertKeysEquivalent(keyWithUndefined, keyLegacy, 'hello world plaintext');
    await assertKeysEquivalent(keyLegacy, keyWithUndefined, 'reverse direction check');
  });

  it('deriveUserKey("123456789", "") produces the same key as deriveUserKey("123456789")', async () => {
    const { deriveUserKey } = await import('@/lib/crypto');
    const keyWithEmpty = await deriveUserKey('123456789', '');
    const keyLegacy = await deriveUserKey('123456789');
    await assertKeysEquivalent(keyWithEmpty, keyLegacy, 'hello world plaintext');
    await assertKeysEquivalent(keyLegacy, keyWithEmpty, 'reverse direction check');
  });

  /**
   * Property-based test: For ANY telegramId string, deriveUserKey(id, null)
   * must produce the same key as deriveUserKey(id).
   *
   * Validates: Requirements 1.2, 2.1, 2.2
   */
  it('PBT: for any telegramId, deriveUserKey(id, null) === deriveUserKey(id)', async () => {
    const { deriveUserKey } = await import('@/lib/crypto');

    await fc.assert(
      fc.asyncProperty(
        // Generate realistic Telegram user IDs (numeric strings)
        fc.integer({ min: 1, max: 9_999_999_999 }).map(String),
        async (telegramId) => {
          const keyWithNull = await deriveUserKey(telegramId, null);
          const keyLegacy = await deriveUserKey(telegramId);
          // Encrypt with null-salt key, decrypt with legacy key — must succeed
          const plaintext = `test-${telegramId}`;
          const ciphertext = await encryptWithKey(plaintext, keyWithNull);
          const decrypted = await decryptWithKey(ciphertext, keyLegacy);
          return decrypted === plaintext;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property-based test: For ANY telegramId string, deriveUserKey(id, undefined)
   * must produce the same key as deriveUserKey(id).
   *
   * Validates: Requirements 1.2, 2.1, 2.2
   */
  it('PBT: for any telegramId, deriveUserKey(id, undefined) === deriveUserKey(id)', async () => {
    const { deriveUserKey } = await import('@/lib/crypto');

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 9_999_999_999 }).map(String),
        async (telegramId) => {
          const keyWithUndefined = await deriveUserKey(telegramId, undefined);
          const keyLegacy = await deriveUserKey(telegramId);
          const plaintext = `test-${telegramId}`;
          const ciphertext = await encryptWithKey(plaintext, keyWithUndefined);
          const decrypted = await decryptWithKey(ciphertext, keyLegacy);
          return decrypted === plaintext;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property-based test: For ANY telegramId string, deriveUserKey(id, "")
   * must produce the same key as deriveUserKey(id).
   *
   * Validates: Requirements 1.2, 2.1, 2.2
   */
  it('PBT: for any telegramId, deriveUserKey(id, "") === deriveUserKey(id)', async () => {
    const { deriveUserKey } = await import('@/lib/crypto');

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 9_999_999_999 }).map(String),
        async (telegramId) => {
          const keyWithEmpty = await deriveUserKey(telegramId, '');
          const keyLegacy = await deriveUserKey(telegramId);
          const plaintext = `test-${telegramId}`;
          const ciphertext = await encryptWithKey(plaintext, keyWithEmpty);
          const decrypted = await decryptWithKey(ciphertext, keyLegacy);
          return decrypted === plaintext;
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ── Bug 2: Profile Lookup by Auth UUID ───────────────────────────────────────

describe('Bug 2 — Profile Lookup by Auth UUID (ID Mismatch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  /**
   * Property 2: Bug Condition — Profile Lookup by Telegram ID
   *
   * When user.id (Supabase Auth UUID) differs from profile.id but
   * user.user_metadata.telegram_id matches profile.telegram_id,
   * GET /api/profile MUST return the correct subscription_tier.
   *
   * On unfixed code, the query WHERE id = "uuid-A" returns no row
   * → 500 error or null profile → test FAILS.
   *
   * Validates: Requirements 1.4, 2.4, 2.5
   */
  it('GET /api/profile returns correct subscription_tier when user.id ≠ profile.id but telegram_id matches', async () => {
    // Scenario: pre-existing user with ID mismatch
    // Auth UUID: "uuid-A" (Supabase Auth UUID)
    // Profile ID: "uuid-B" (original profile UUID, different from auth UUID)
    // Profile telegram_id: "123456789" (matches auth user metadata)
    // Profile subscription_tier: "stars_pro" (paid tier)

    const authUserId = 'uuid-A';
    const profileId = 'uuid-B';
    const telegramId = '123456789';
    const subscriptionTier = 'stars_pro';

    // Mock auth.getUser to return the auth user with telegram_id in metadata
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: authUserId,
          user_metadata: {
            telegram_id: telegramId,
          },
        },
      },
      error: null,
    });

    // Mock profiles table query
    // On UNFIXED code: query is WHERE id = "uuid-A" → no row found (profile.id = "uuid-B")
    // On FIXED code: query is WHERE telegram_id = "123456789" → correct row found
    const mockSingle = vi.fn();
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    mockFrom.mockReturnValue({ select: mockSelect });

    // Simulate the unfixed behavior: WHERE id = "uuid-A" returns no row
    // The mock returns the profile only when queried by telegram_id
    mockEq.mockImplementation((column: string, value: string) => {
      if (column === 'id' && value === authUserId) {
        // Unfixed code path: no row found (ID mismatch)
        return {
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'No rows found', code: 'PGRST116' },
          }),
        };
      }
      if (column === 'telegram_id' && value === telegramId) {
        // Fixed code path: correct row found by telegram_id
        return {
          single: vi.fn().mockResolvedValue({
            data: {
              id: profileId,
              telegram_id: telegramId,
              subscription_tier: subscriptionTier,
              subscription_status: 'active',
              subscription_ends_at: null,
              subscription_start_date: null,
              trial_used: false,
            },
            error: null,
          }),
        };
      }
      // Default: no row
      return {
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };
    });

    const { GET } = await import('@/app/api/profile/route');

    const req = new Request('http://localhost/api/profile', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-jwt-token',
      },
    });

    const response = await GET(req);
    const json = await response.json();

    // On UNFIXED code: response.status === 500 (no row found) → test FAILS
    // On FIXED code: response.status === 200 with correct subscription_tier → test PASSES
    expect(response.status).toBe(200);
    expect(json.profile).toBeDefined();
    expect(json.profile.subscription_tier).toBe(subscriptionTier);
  });

  it('GET /api/profile returns 200 with correct profile when queried by telegram_id (bug is fixed)', async () => {
    // This test was originally written to demonstrate the bug (500 error when user.id ≠ profile.id).
    // After the fix, the handler uses telegram_id for lookup, so it now returns 200 with the correct profile.

    const authUserId = 'uuid-A';
    const telegramId = '123456789';
    const subscriptionTier = 'stars_pro';

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: authUserId,
          user_metadata: { telegram_id: telegramId },
        },
      },
      error: null,
    });

    // Fixed code path: query uses telegram_id → correct row found
    const mockEq = vi.fn().mockImplementation((column: string, value: string) => {
      if (column === 'telegram_id' && value === telegramId) {
        return {
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'uuid-B',
              telegram_id: telegramId,
              subscription_tier: subscriptionTier,
              subscription_status: 'active',
              subscription_ends_at: null,
              subscription_start_date: null,
              trial_used: false,
            },
            error: null,
          }),
        };
      }
      return {
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };
    });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_role_key_exploration';

    const { GET } = await import('@/app/api/profile/route');
    const req = new Request('http://localhost/api/profile', {
      method: 'GET',
      headers: { Authorization: 'Bearer test-jwt-token' },
    });

    const response = await GET(req);
    const json = await response.json();

    // Bug is fixed: the query now uses telegram_id → correct row found → 200
    expect(response.status).toBe(200);
    expect(json.profile).toBeDefined();
    expect(json.profile.subscription_tier).toBe(subscriptionTier);
  });
});


// ── Preservation Tests ────────────────────────────────────────────────────────

/**
 * Preservation Property Tests — access-decryption-fix
 *
 * These tests verify baseline behavior that MUST NOT change after the fix.
 * They are written BEFORE the fix and EXPECTED TO PASS on unfixed code.
 *
 * Property 3: For any non-empty, non-null salt, deriveUserKey(id, salt)
 *   continues to use IKM = "${id}:${salt}" unchanged.
 * Property 4: For users where user.id = profile.id, GET /api/profile
 *   returns the same result as before the fix.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

// ── Preservation 1: Salt-Inclusive Key Derivation Unchanged ──────────────────

describe('Preservation 1 — Salt-Inclusive Key Derivation Unchanged', () => {
  /**
   * PBT: For any (telegramId, salt) where salt is non-empty,
   * deriveUserKey(id, salt) is deterministic — same inputs → same key material.
   *
   * Validates: Requirements 3.1, 3.2, 3.6
   */
  it('PBT: deriveUserKey(id, salt) is deterministic for any non-empty salt', async () => {
    const { deriveUserKey } = await import('@/lib/crypto');

    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.string({ minLength: 1 }),
        async (id, salt) => {
          const k1 = await deriveUserKey(id, salt);
          const k2 = await deriveUserKey(id, salt);
          // Verify same key material by cross-encrypting/decrypting
          const plaintext = `preserve-${id}-${salt}`;
          const ciphertext = await encryptWithKey(plaintext, k1);
          const decrypted = await decryptWithKey(ciphertext, k2);
          return decrypted === plaintext;
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * A non-null, non-empty salt MUST produce a DIFFERENT key than no salt.
   * This ensures the salt actually changes the key for new users.
   *
   * Validates: Requirements 3.1, 3.2
   */
  it('deriveUserKey(id, "abc123") produces a DIFFERENT key than deriveUserKey(id)', async () => {
    const { deriveUserKey } = await import('@/lib/crypto');
    const id = '123456789';
    const keyWithSalt = await deriveUserKey(id, 'abc123');
    const keyLegacy = await deriveUserKey(id);

    // Encrypt with the salt key, then try to decrypt with the legacy key.
    // If the keys are different, decryption will throw (AES-GCM auth tag mismatch).
    const plaintext = 'salt-must-change-the-key';
    const ciphertext = await encryptWithKey(plaintext, keyWithSalt);

    let decryptionFailed = false;
    try {
      await decryptWithKey(ciphertext, keyLegacy);
    } catch {
      decryptionFailed = true;
    }

    // The keys MUST be different — decryption with the wrong key must fail
    expect(decryptionFailed).toBe(true);
  });

  /**
   * Encrypt-then-decrypt round-trip with a non-null salt key must recover
   * the original plaintext.
   *
   * Validates: Requirements 3.1, 3.2
   */
  it('encrypt-then-decrypt round-trip with non-null salt key recovers original plaintext', async () => {
    const { deriveUserKey, encryptField, decryptField } = await import('@/lib/crypto');
    const id = '987654321';
    const salt = 'a3f8deadbeef1234567890abcdef0123';
    const plaintext = 'Hello, this is a preserved entry for a new user.';

    const key = await deriveUserKey(id, salt);
    const ciphertext = await encryptField(plaintext, key);
    const decrypted = await decryptField(ciphertext, key);

    expect(decrypted).toBe(plaintext);
  });

  /**
   * PBT: Encrypt-then-decrypt round-trip with non-null salt key recovers
   * original plaintext for any (id, salt, plaintext) combination.
   *
   * Validates: Requirements 3.1, 3.2
   */
  it('PBT: encrypt-then-decrypt round-trip with non-null salt key recovers original plaintext', async () => {
    const { deriveUserKey, encryptField, decryptField } = await import('@/lib/crypto');

    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (id, salt, plaintext) => {
          const key = await deriveUserKey(id, salt);
          const ciphertext = await encryptField(plaintext, key);
          const decrypted = await decryptField(ciphertext, key);
          return decrypted === plaintext;
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ── Preservation 2: Aligned-User Profile Lookup Unchanged ────────────────────

describe('Preservation 2 — Aligned-User Profile Lookup Unchanged', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  /**
   * When user.id = profile.id (new users, NOT isSubscriptionBugCondition),
   * GET /api/profile MUST return the correct subscription_tier.
   *
   * Validates: Requirements 3.3, 3.4, 3.5
   */
  it('GET /api/profile returns correct subscription_tier when user.id = profile.id (aligned user)', async () => {
    const alignedId = 'uuid-C';
    const telegramId = '987654321';
    const subscriptionTier = 'stars_basic';

    // Mock auth.getUser: IDs are aligned (uuid-C = uuid-C)
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: alignedId,
          user_metadata: {
            telegram_id: telegramId,
          },
        },
      },
      error: null,
    });

    // Mock profiles table: profile.id = auth.user.id (aligned)
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: alignedId,
              telegram_id: telegramId,
              subscription_tier: subscriptionTier,
              subscription_status: 'active',
              subscription_ends_at: null,
              subscription_start_date: null,
              trial_used: false,
            },
            error: null,
          }),
        }),
      }),
    });

    const { GET } = await import('@/app/api/profile/route');

    const req = new Request('http://localhost/api/profile', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-jwt-aligned',
      },
    });

    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.profile).toBeDefined();
    expect(json.profile.subscription_tier).toBe(subscriptionTier);
  });

  /**
   * Fallback: when user_metadata.telegram_id is absent, the handler falls back
   * to id lookup and still returns the correct row.
   *
   * Validates: Requirements 3.3, 3.4, 3.5
   */
  it('GET /api/profile falls back to id lookup when telegram_id is absent from metadata', async () => {
    const userId = 'uuid-D';
    const subscriptionTier = 'stars_pro';

    // Mock auth.getUser: no telegram_id in metadata
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: userId,
          user_metadata: {}, // no telegram_id
        },
      },
      error: null,
    });

    // Mock profiles table: profile found by id fallback
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: userId,
              subscription_tier: subscriptionTier,
              subscription_status: 'active',
              subscription_ends_at: null,
              subscription_start_date: null,
              trial_used: false,
            },
            error: null,
          }),
        }),
      }),
    });

    const { GET } = await import('@/app/api/profile/route');

    const req = new Request('http://localhost/api/profile', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-jwt-fallback',
      },
    });

    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.profile).toBeDefined();
    expect(json.profile.subscription_tier).toBe(subscriptionTier);
  });
});
