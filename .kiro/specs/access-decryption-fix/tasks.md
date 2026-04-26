# Implementation Plan

- [x] 1. Write bug condition exploration tests (BEFORE implementing any fix)
  - **Property 1: Bug Condition** - Null/Falsy Salt Key Derivation & Profile ID Mismatch
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior — they will validate the fix when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate both bugs exist
  - **Scoped PBT Approach**: For Bug 1, scope the property to the concrete failing cases: `salt = null`, `salt = undefined`, `salt = ""` with any `telegramId`. For Bug 2, scope to the concrete mismatch scenario: `user.id = "uuid-A"`, `profile.id = "uuid-B"`, `profile.telegram_id = "123"`.
  - Create `src/__tests__/access-decryption-fix.test.ts`
  - **Bug 1 — Null salt key derivation (from Bug Condition in design):**
    - Test that `deriveUserKey("123456789", null)` produces the same key as `deriveUserKey("123456789")` — assert by encrypting the same plaintext with both keys and comparing ciphertexts, or by exporting raw key bytes if extractable. On unfixed code (if guard is absent), IKM would be `"123456789:null"` vs `"123456789"` → different keys → test FAILS.
    - Test that `deriveUserKey("123456789", undefined)` produces the same key as `deriveUserKey("123456789")`.
    - Test that `deriveUserKey("123456789", "")` produces the same key as `deriveUserKey("123456789")`.
    - Use fast-check: `fc.property(fc.string(), async (id) => { const k1 = await deriveUserKey(id, null); const k2 = await deriveUserKey(id); /* assert same key */ })` — generates many telegramId values.
  - **Bug 2 — Profile lookup by Auth UUID (from Bug Condition in design):**
    - Mock `supabase.auth.getUser` to return `{ id: "uuid-A", user_metadata: { telegram_id: "123456789" } }`.
    - Mock `profiles` table to have `{ id: "uuid-B", telegram_id: "123456789", subscription_tier: "stars_pro", ... }` (ID mismatch scenario).
    - Call `GET /api/profile` and assert `response.profile.subscription_tier === "stars_pro"`.
    - On unfixed code, the query `WHERE id = "uuid-A"` returns no row → 500 error or null profile → test FAILS.
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct — it proves the bugs exist)
  - Document counterexamples found (e.g., `deriveUserKey("id", null)` produces different key than `deriveUserKey("id")` if guard is missing; `GET /api/profile` returns 500 when `user.id ≠ profile.id`)
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Salt-Inclusive Key Unchanged & Aligned-User Profile Lookup Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe on UNFIXED code for non-buggy inputs:**
    - Observe: `deriveUserKey("123456789", "a3f8deadbeef")` produces a consistent, deterministic key (same call → same key material)
    - Observe: `GET /api/profile` with `user.id = profile.id` returns the correct `subscription_tier` row
  - **Bug 1 preservation — salt-inclusive key derivation:**
    - Use fast-check: `fc.property(fc.string(), fc.string({ minLength: 1 }), async (id, salt) => { const k1 = await deriveUserKey(id, salt); const k2 = await deriveUserKey(id, salt); /* assert deterministic — same inputs → same key material */ })` — generates many `(telegramId, salt)` pairs where `salt` is non-empty (i.e. `NOT isDecryptionBugCondition`).
    - Also assert that `deriveUserKey(id, "abc123")` produces a DIFFERENT key than `deriveUserKey(id)` — the salt must change the key for new users.
    - Verify encrypt-then-decrypt round-trip with a non-null salt key recovers the original plaintext.
  - **Bug 2 preservation — aligned-user profile lookup:**
    - Mock `supabase.auth.getUser` to return `{ id: "uuid-C", user_metadata: { telegram_id: "987654321" } }`.
    - Mock `profiles` table to have `{ id: "uuid-C", telegram_id: "987654321", subscription_tier: "stars_basic", ... }` (IDs match — `NOT isSubscriptionBugCondition`).
    - Call `GET /api/profile` and assert `response.profile.subscription_tier === "stars_basic"`.
    - Also test the fallback: when `user_metadata.telegram_id` is absent, the handler falls back to `id` lookup and still returns the correct row.
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix both bugs

  - [x] 3.1 Strengthen null/falsy salt guard in `deriveUserKey` (`src/lib/crypto.ts`)
    - Replace the implicit falsy check `salt ? ...` with the explicit guard `(salt != null && salt !== "")` for clarity and correctness
    - Change: `const ikm = salt ? \`${telegramUserId}:${salt}\` : telegramUserId;`
    - To: `const ikm = (salt != null && salt !== "") ? \`${telegramUserId}:${salt}\` : telegramUserId;`
    - Add JSDoc comment: "Treat null, undefined, and empty string as 'no salt' — legacy path for users created before migration 20240001000016_encryption_salt.sql"
    - _Bug_Condition: `isDecryptionBugCondition(profile)` where `profile.encryption_salt IS NULL OR IS UNDEFINED OR IS ""`_
    - _Expected_Behavior: `deriveUserKey(telegramId, null)` → IKM = `telegramId` only → same key as `deriveUserKey(telegramId)` → existing entries decrypt correctly_
    - _Preservation: For all `salt` where `salt != null && salt !== ""`, `deriveUserKey(id, salt)` continues to use IKM = `"${id}:${salt}"` unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

  - [x] 3.2 Fix profile lookup in `GET /api/profile` (`src/app/api/profile/route.ts`)
    - After `supabase.auth.getUser(jwt)`, extract `telegramId = user.user_metadata?.telegram_id as string | undefined`
    - Replace `.eq("id", user.id)` with a dynamic lookup: use `telegram_id` column when `telegramId` is present, fall back to `id` when absent
    - Implement as:
      ```typescript
      const telegramId = user.user_metadata?.telegram_id as string | undefined;
      const lookupColumn = telegramId ? "telegram_id" : "id";
      const lookupValue = telegramId ?? user.id;
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, subscription_tier, subscription_status, subscription_ends_at, subscription_start_date, trial_used")
        .eq(lookupColumn, lookupValue)
        .single();
      ```
    - _Bug_Condition: `isSubscriptionBugCondition(user)` where `user.id ≠ profile.id` but `user.user_metadata.telegram_id = profile.telegram_id`_
    - _Expected_Behavior: `GET /api/profile` returns correct `subscription_tier` from the database regardless of `user.id` vs `profile.id` alignment_
    - _Preservation: When `user.user_metadata.telegram_id` is absent, falls back to `id` lookup — behavior unchanged for users without metadata_
    - _Requirements: 2.4, 2.5, 3.3, 3.4, 3.5_

  - [x] 3.3 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - Null/Falsy Salt Key Derivation & Profile ID Mismatch
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, it confirms the expected behavior is satisfied
    - Run `npx vitest run src/__tests__/access-decryption-fix.test.ts` (or `npm test`)
    - **EXPECTED OUTCOME**: All Bug Condition tests PASS (confirms both bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Salt-Inclusive Key Unchanged & Aligned-User Profile Lookup Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `npx vitest run src/__tests__/access-decryption-fix.test.ts`
    - **EXPECTED OUTCOME**: All Preservation tests PASS (confirms no regressions)
    - Confirm salt-inclusive key derivation is unchanged for new users
    - Confirm profile GET is unchanged for users with aligned `user.id = profile.id`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite: `npm test`
  - Ensure all tests in `src/__tests__/access-decryption-fix.test.ts` pass
  - Ensure no regressions in existing test files (`api-entries.test.ts`, `auth.test.ts`, `paywall.test.ts`, etc.)
  - Ask the user if any questions arise about edge cases (e.g., users with `telegram_id` absent from metadata, empty-string salt in the database)
