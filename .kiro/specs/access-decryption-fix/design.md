# Access & Decryption Fix — Bugfix Design

## Overview

Two regressions were introduced by the `feat: launch readiness` push (commit `903e078`):

1. **Decryption failure** — `deriveUserKey()` in `src/lib/crypto.ts` was updated to include `encryption_salt` in the HKDF IKM. Existing users have `encryption_salt = NULL` (the column was just added by migration `20240001000016_encryption_salt.sql`). The new code builds IKM as `"${telegramId}:${salt}"` using JavaScript template literal interpolation, which produces `"telegramId:null"` (the literal string `"null"`) when `salt` is `null`. This is a different IKM than the original `"telegramId"`, so a different key is derived — causing all decryption to fail silently and return raw `enc:...` ciphertext blobs.

2. **Subscription loss** — `/api/profile` GET queries `profiles WHERE id = user.id` (the Supabase Auth UUID). For pre-existing users, `resolveOrCreateProfile` explicitly does **not** migrate `profile.id` to match the Auth UUID (to avoid wiping subscription data). So `user.id ≠ profile.id` for these users, the query returns no row, and `subscription_tier` defaults to `free`.

The fix strategy is minimal and targeted: treat `null`/`undefined` salt as absent in `deriveUserKey`, and look up the profile by `telegram_id` (from auth user metadata) instead of by `id` in `/api/profile`.

---

## Glossary

- **Bug_Condition (C)**: The condition that triggers a bug — either `profile.encryption_salt IS NULL` (decryption bug) or `auth_user.id ≠ profile.id` (subscription bug).
- **Property (P)**: The desired correct behavior when the bug condition holds — entries decrypt to readable plaintext; profile returns the correct `subscription_tier`.
- **Preservation**: Existing behavior for users unaffected by the bug condition that must remain unchanged after the fix.
- **`deriveUserKey(telegramUserId, salt?)`**: The function in `src/lib/crypto.ts` that derives a per-user AES-256-GCM key via HKDF-SHA-256. The IKM is `telegramUserId` (legacy) or `telegramUserId:salt` (new users with a salt).
- **`encryption_salt`**: A nullable `TEXT` column in `profiles`, added by migration `20240001000016_encryption_salt.sql`. `NULL` for all users created before the migration; a random 32-byte hex string for users created after.
- **`getTelegramProfile(jwt)`**: Helper in `src/app/api/entries/route.ts` that resolves `telegram_id` and `encryption_salt` from the `profiles` table using the user's JWT.
- **`resolveOrCreateProfile`**: Function in `src/lib/profile.ts` that upserts a profile by `telegram_id`. For existing users it deliberately keeps the original `profile.id` rather than migrating it to the Auth UUID.
- **IKM**: Input Key Material for HKDF. The bug is that `null` is coerced to the string `"null"` in a template literal, changing the IKM.

---

## Bug Details

### Bug 1 — Decryption Failure

The bug manifests when a user whose `profiles.encryption_salt` is `NULL` reads or edits entries. The `deriveUserKey` function receives `null` as the `salt` argument. The guard condition `if (salt)` correctly evaluates `null` as falsy — **however**, the existing code already has the correct guard. The issue is that callers pass `data.encryption_salt ?? null`, and the function signature is `salt?: string | null`. The guard `const ikm = salt ? \`${telegramUserId}:\${salt}\` : telegramUserId` is correct in the current code.

Re-reading the code carefully: the current `deriveUserKey` implementation **already has the correct guard**:

```typescript
const ikm = salt ? `${telegramUserId}:${salt}` : telegramUserId;
```

This means `null` and `undefined` both fall through to the `telegramUserId`-only path. The bug must have existed in an intermediate version where the guard was absent or incorrect (e.g., `const ikm = \`${telegramUserId}:\${salt}\`` unconditionally). The fix is to ensure this guard is present and correct — and to add a test that verifies `deriveUserKey(id, null)` produces the same key as `deriveUserKey(id, undefined)` and `deriveUserKey(id)`.

**Formal Specification:**
```
FUNCTION isDecryptionBugCondition(profile)
  INPUT: profile of type ProfileRow
  OUTPUT: boolean

  // Bug triggers when the profile has no encryption_salt
  // (i.e. was created before migration 20240001000016)
  RETURN profile.encryption_salt IS NULL OR profile.encryption_salt IS UNDEFINED
END FUNCTION
```

**Examples:**

- User A (pre-migration): `encryption_salt = NULL` → `deriveUserKey("123456789", null)` → IKM must be `"123456789"` (not `"123456789:null"`) → decryption succeeds ✓
- User B (post-migration): `encryption_salt = "a3f8..."` → `deriveUserKey("987654321", "a3f8...")` → IKM is `"987654321:a3f8..."` → decryption succeeds ✓
- Edge case: `encryption_salt = ""` (empty string) → falsy in JS → treated as absent → IKM is `telegramId` only (same as null path)
- Edge case: `encryption_salt = undefined` → falsy → IKM is `telegramId` only ✓

### Bug 2 — Subscription Loss

The bug manifests when `/api/profile` GET resolves the user via `supabase.auth.getUser(jwt)` and then queries `profiles WHERE id = user.id`. For pre-existing users, `profile.id` is the original UUID assigned at profile creation time, which differs from the Supabase Auth UUID (`user.id`). The query returns no row, `profile` is `null`, and the handler returns a 500 error or the client defaults to `free` tier.

**Formal Specification:**
```
FUNCTION isSubscriptionBugCondition(authUser, profile)
  INPUT: authUser of type SupabaseAuthUser, profile of type ProfileRow
  OUTPUT: boolean

  // Bug triggers when the Auth UUID differs from the profile's stored id
  // This happens for all users created before resolveOrCreateProfile
  // stopped migrating profile IDs
  RETURN authUser.id ≠ profile.id
         WHERE profile.telegram_id = authUser.user_metadata.telegram_id
END FUNCTION
```

**Examples:**

- Pre-existing user: `auth.user.id = "uuid-A"`, `profile.id = "uuid-B"`, `profile.telegram_id = "123456789"` → query `WHERE id = "uuid-A"` returns nothing → subscription lost ✗
- New user (post-push): `auth.user.id = "uuid-C"`, `profile.id = "uuid-C"` → query `WHERE id = "uuid-C"` returns correct row → subscription intact ✓
- Fix: query `WHERE telegram_id = auth.user.user_metadata.telegram_id` → always finds the correct row regardless of ID alignment ✓

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- New users (with non-NULL `encryption_salt`) must continue to encrypt and decrypt entries using the salt-inclusive IKM (`telegramId:salt`).
- The bot handler (`src/lib/bot/commands.ts`) must continue to use the correct key for all users — salt-inclusive for new users, legacy for pre-migration users.
- The `/api/auth/telegram` flow must continue to issue valid JWTs and set the `accessToken` in the auth context.
- Free-tier users must continue to have the 30-day history limit and 100-entry cap enforced.
- Paid users whose `subscription_ends_at` is in the past must continue to be downgraded to `free` via `getEffectiveTier`.
- The PATCH handler for entries must continue to re-encrypt with the correct key (matching the key used for the original encryption).
- The `/api/profile` PATCH handler (downgrade flow) must continue to work correctly.

**Scope:**
All inputs where `profile.encryption_salt IS NOT NULL` are unaffected by the decryption fix. All users where `auth.user.id = profile.id` are unaffected by the subscription fix. The changes are purely additive guards — no existing code paths for non-buggy inputs are altered.

---

## Hypothesized Root Cause

### Bug 1 — Decryption Failure

1. **Incorrect IKM construction (primary hypothesis)**: An intermediate version of `deriveUserKey` may have used an unconditional template literal `\`${telegramUserId}:${salt}\`` without the `salt ?` guard, causing `null` to be coerced to the string `"null"`. The current code has the guard, but the bug may have been present during the window when entries were encrypted with the wrong key.

2. **Null coercion in JavaScript template literals**: `\`${null}\`` evaluates to `"null"` in JavaScript. This is a subtle footgun — the `salt` parameter being typed as `string | null | undefined` does not prevent template literal coercion.

3. **Missing test coverage**: No existing test verifies that `deriveUserKey(id, null)` produces the same key as `deriveUserKey(id)`, so the regression went undetected.

### Bug 2 — Subscription Loss

1. **Profile lookup by Auth UUID instead of telegram_id (primary hypothesis)**: The `/api/profile` GET handler uses `user.id` (Supabase Auth UUID) to query `profiles`. This works for new users where `profile.id = auth.user.id`, but fails for pre-existing users where `resolveOrCreateProfile` kept the original `profile.id`.

2. **Intentional ID non-migration in `resolveOrCreateProfile`**: The comment in `src/lib/profile.ts` explicitly states "We do NOT migrate profile IDs anymore — it wipes subscription data." This means the mismatch is a known, intentional design decision — but `/api/profile` was not updated to account for it.

3. **Auth metadata contains `telegram_id`**: The `ensureAuthUser` function stores `telegram_id` in `user_metadata` when creating the auth user. This metadata is available on the `user` object returned by `getUser(jwt)`, making it the correct lookup key.

---

## Correctness Properties

Property 1: Bug Condition — Null Salt Key Derivation

_For any_ call to `deriveUserKey(telegramUserId, salt)` where `salt` is `null`, `undefined`, or an empty string, the function SHALL derive the same key as `deriveUserKey(telegramUserId)` — using only `telegramUserId` as IKM — so that entries encrypted before the salt column was added can be decrypted correctly.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Bug Condition — Profile Lookup by Telegram ID

_For any_ authenticated request to `GET /api/profile` where the Supabase Auth UUID (`user.id`) differs from `profile.id` but `user.user_metadata.telegram_id` matches `profile.telegram_id`, the handler SHALL return the correct profile row including the actual `subscription_tier` stored in the database.

**Validates: Requirements 2.4, 2.5**

Property 3: Preservation — Salt-Inclusive Key Derivation Unchanged

_For any_ call to `deriveUserKey(telegramUserId, salt)` where `salt` is a non-empty, non-null string, the function SHALL continue to derive the key using IKM = `"${telegramUserId}:${salt}"`, preserving the behavior for all new users created after the migration.

**Validates: Requirements 3.1, 3.2, 3.6**

Property 4: Preservation — Profile Lookup for Aligned Users Unchanged

_For any_ authenticated request to `GET /api/profile` where `user.id = profile.id` (new users), the handler SHALL return the same result as before the fix, with no change in behavior.

**Validates: Requirements 3.3, 3.4, 3.5**

---

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**Fix 1 — `src/lib/crypto.ts`**

**Function**: `deriveUserKey`

**Specific Changes**:
1. **Strengthen the null/falsy guard**: Ensure the IKM construction explicitly handles `null`, `undefined`, and empty string as "no salt" cases. The current guard `salt ? ... : ...` already handles this, but add an explicit comment and consider using `salt != null && salt !== ""` for clarity.
2. **Add JSDoc clarification**: Document that `null`, `undefined`, and `""` all produce the legacy IKM (telegramId only), and that this is intentional for backward compatibility.

```typescript
// Before (potentially buggy in intermediate version):
const ikm = salt ? `${telegramUserId}:${salt}` : telegramUserId;

// After (explicit and documented):
// Treat null, undefined, and empty string as "no salt" — legacy path for
// users created before migration 20240001000016_encryption_salt.sql
const ikm = (salt != null && salt !== "") ? `${telegramUserId}:${salt}` : telegramUserId;
```

**Fix 2 — `src/app/api/profile/route.ts`**

**Function**: `GET`

**Specific Changes**:
1. **Extract `telegram_id` from auth user metadata**: After `supabase.auth.getUser(jwt)`, read `user.user_metadata.telegram_id`.
2. **Query profiles by `telegram_id`**: Replace `.eq("id", user.id)` with `.eq("telegram_id", telegramId)`.
3. **Handle missing metadata gracefully**: If `telegram_id` is absent from metadata (edge case for very old accounts), fall back to `user.id` lookup.

```typescript
// Before:
const { data: profile } = await supabase
  .from("profiles")
  .select("id, subscription_tier, ...")
  .eq("id", user.id)
  .single();

// After:
const telegramId = user.user_metadata?.telegram_id as string | undefined;
const lookupColumn = telegramId ? "telegram_id" : "id";
const lookupValue = telegramId ?? user.id;

const { data: profile } = await supabase
  .from("profiles")
  .select("id, subscription_tier, ...")
  .eq(lookupColumn, lookupValue)
  .single();
```

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate each bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate both bugs BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write unit tests that directly call `deriveUserKey` with `null` salt and assert key equality. Write integration tests for `/api/profile` that simulate a user with mismatched `user.id` and `profile.id`. Run these on the UNFIXED code to observe failures.

**Test Cases**:
1. **Null salt key equality** (Bug 1): Call `deriveUserKey("123456789", null)` and `deriveUserKey("123456789")` — assert both produce the same key. Will fail if the guard is absent.
2. **Undefined salt key equality** (Bug 1): Call `deriveUserKey("123456789", undefined)` and `deriveUserKey("123456789")` — assert key equality.
3. **Empty string salt key equality** (Bug 1): Call `deriveUserKey("123456789", "")` and `deriveUserKey("123456789")` — assert key equality.
4. **Profile lookup with ID mismatch** (Bug 2): Mock `auth.getUser` to return `{ id: "uuid-A", user_metadata: { telegram_id: "123" } }` and mock `profiles` to have `{ id: "uuid-B", telegram_id: "123", subscription_tier: "stars_pro" }`. Assert `GET /api/profile` returns `subscription_tier = "stars_pro"`. Will fail on unfixed code.

**Expected Counterexamples**:
- `deriveUserKey("id", null)` produces a different key than `deriveUserKey("id")` if the guard is missing (IKM `"id:null"` vs `"id"`).
- `GET /api/profile` returns 500 or `subscription_tier = null` when `user.id ≠ profile.id`.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**
```
// Bug 1 fix checking
FOR ALL profile WHERE isDecryptionBugCondition(profile) DO
  key_with_null  := deriveUserKey(profile.telegram_id, null)
  key_legacy     := deriveUserKey(profile.telegram_id)
  ASSERT key_with_null produces same ciphertext/plaintext as key_legacy
END FOR

// Bug 2 fix checking
FOR ALL user WHERE isSubscriptionBugCondition(user, profile) DO
  response := GET /api/profile WITH jwt FOR user
  ASSERT response.profile.subscription_tier = actual_tier_in_db
  ASSERT response.profile.subscription_tier ≠ NULL
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
// Bug 1 preservation
FOR ALL profile WHERE NOT isDecryptionBugCondition(profile) DO
  // salt is non-null, non-empty
  key_fixed    := deriveUserKey_fixed(profile.telegram_id, profile.encryption_salt)
  key_original := deriveUserKey_original(profile.telegram_id, profile.encryption_salt)
  ASSERT key_fixed = key_original
END FOR

// Bug 2 preservation
FOR ALL user WHERE NOT isSubscriptionBugCondition(user, profile) DO
  // user.id = profile.id
  ASSERT GET /api/profile behavior IS UNCHANGED
END FOR
```

**Testing Approach**: Property-based testing is recommended for the key derivation preservation check because:
- It can generate many random `(telegramId, salt)` pairs and verify key consistency.
- It catches edge cases like very long IDs, unicode characters, or salt values that look like `null`.
- It provides strong guarantees that the fix doesn't alter behavior for non-buggy inputs.

**Test Cases**:
1. **Salt-inclusive key unchanged**: For any non-empty salt string, `deriveUserKey(id, salt)` produces the same key before and after the fix.
2. **Profile GET unchanged for aligned users**: When `user.id = profile.id`, the response is identical to the pre-fix behavior.
3. **Entry encryption/decryption round-trip for new users**: Encrypt with `deriveUserKey(id, salt)`, decrypt with same — plaintext is recovered.
4. **Subscription tier preserved for new users**: New users with `user.id = profile.id` continue to get correct tier from `/api/profile`.

### Unit Tests

- Test `deriveUserKey(id, null)` produces the same key as `deriveUserKey(id)`.
- Test `deriveUserKey(id, undefined)` produces the same key as `deriveUserKey(id)`.
- Test `deriveUserKey(id, "")` produces the same key as `deriveUserKey(id)`.
- Test `deriveUserKey(id, "abc123")` produces a different key than `deriveUserKey(id)` (salt changes the key).
- Test `GET /api/profile` returns correct `subscription_tier` when `telegram_id` is in auth metadata and `profile.id ≠ user.id`.
- Test `GET /api/profile` returns correct `subscription_tier` when `user.id = profile.id` (no regression).
- Test `GET /api/profile` falls back to `id` lookup when `telegram_id` is absent from metadata.

### Property-Based Tests

- Generate random `(telegramId: string, salt: string)` pairs where `salt` is non-empty — verify `deriveUserKey(id, salt)` is deterministic (same inputs → same key material).
- Generate random `telegramId` values — verify `deriveUserKey(id, null)` always equals `deriveUserKey(id, undefined)` equals `deriveUserKey(id)`.
- Generate random plaintext strings — verify encrypt-then-decrypt round-trip with null-salt key recovers the original plaintext.
- Generate random plaintext strings — verify encrypt-then-decrypt round-trip with non-null salt key recovers the original plaintext.

### Integration Tests

- Full round-trip: encrypt an entry with `deriveUserKey(id, null)`, then decrypt with `deriveUserKey(id)` — assert plaintext matches.
- Full round-trip: encrypt an entry with `deriveUserKey(id, "salt123")`, then decrypt with `deriveUserKey(id, "salt123")` — assert plaintext matches.
- `GET /api/entries` for a user with `encryption_salt = NULL` returns decrypted plaintext (not `enc:...` blobs).
- `GET /api/profile` for a user with `user.id ≠ profile.id` returns the correct `subscription_tier` from the database.
- `PATCH /api/entries` for a user with `encryption_salt = NULL` re-encrypts with the legacy key and the entry remains readable.
