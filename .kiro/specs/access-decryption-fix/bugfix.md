# Bugfix Requirements Document

## Introduction

After the `feat: launch readiness` push (commit `903e078`), two regressions broke the app for existing users:

1. **Encrypted content not decrypting** — entries stored before the push are displayed as raw `enc:AWlgYhnTl+6x5iQ9Iy+cOh0kqjSQg+IywF7eePnvQ/Cs6...` blobs in the UI instead of readable text. The push changed the key derivation function in `src/lib/crypto.ts` to incorporate a per-user `encryption_salt` into the IKM. Existing profiles have `encryption_salt = NULL` in the database (the column was just added by migration `20240001000016_encryption_salt.sql`), so the new code derives a different key than the one used to encrypt the data, causing all decryption to fail silently and return the raw ciphertext.

2. **Users lost their subscriptions** — paid users are being treated as `free` tier. The `src/app/api/profile/route.ts` GET handler uses `supabase.auth.getUser(jwt)` to resolve `user.id`, then queries `profiles` by `id = user.id`. However, `resolveOrCreateProfile` in `src/lib/profile.ts` explicitly does **not** migrate `profile.id` to match `authUserId` for existing users (to avoid wiping subscription data). This means `user.id` (the Supabase Auth UUID) can differ from `profile.id` (the original profile row UUID), causing the profile query to return no row or the wrong row — and the subscription tier defaults to `free`.

Both issues affect all users who existed before the push. New users created after the push are unaffected by the decryption bug (they have a salt and their entries are encrypted with the salt-inclusive key), but may still be affected by the profile ID mismatch.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user with `encryption_salt = NULL` in their profile row opens the miniapp THEN the system displays raw `enc:...` ciphertext blobs instead of decrypted entry content

1.2 WHEN the `/api/entries` GET handler derives the decryption key for a user whose `encryption_salt` is NULL THEN the system uses `telegramId:null` as IKM (producing a different key than the one used during encryption) and silently returns undecrypted ciphertext to the client

1.3 WHEN the `/api/entries` PATCH handler re-encrypts edited content for a user with `encryption_salt = NULL` THEN the system encrypts with the wrong key, making the entry permanently unreadable with either key

1.4 WHEN the `/api/profile` GET handler resolves the user via `supabase.auth.getUser(jwt)` and queries `profiles` by `id = user.id` THEN the system returns no profile row (or the wrong row) for users whose `profile.id` differs from their Supabase Auth UUID, causing `subscription_tier` to be missing

1.5 WHEN the miniapp receives a null or missing `subscription_tier` from `/api/profile` THEN the system defaults to `free` tier, stripping paid users of their subscription features

### Expected Behavior (Correct)

2.1 WHEN a user with `encryption_salt = NULL` opens the miniapp THEN the system SHALL derive the decryption key using only `telegramId` as IKM (the original pre-salt behavior) and return fully decrypted entry content

2.2 WHEN the `/api/entries` GET handler derives the decryption key for a user whose `encryption_salt` is NULL THEN the system SHALL fall back to the legacy key derivation path (`deriveUserKey(telegramId, null)` → IKM = `telegramId` only) so that existing entries decrypt correctly

2.3 WHEN the `/api/entries` PATCH handler re-encrypts edited content for a user with `encryption_salt = NULL` THEN the system SHALL use the same legacy key (IKM = `telegramId` only) so the entry remains readable

2.4 WHEN the `/api/profile` GET handler resolves the user via `supabase.auth.getUser(jwt)` THEN the system SHALL look up the profile by `telegram_id` (extracted from the auth user's metadata) rather than by `id = user.id`, ensuring the correct profile row is always found regardless of ID alignment

2.5 WHEN the miniapp receives the profile from `/api/profile` THEN the system SHALL correctly reflect the user's actual `subscription_tier` (e.g. `stars_basic`, `stars_pro`) so paid features remain accessible

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a new user (created after the push, with a non-NULL `encryption_salt`) writes and reads entries THEN the system SHALL CONTINUE TO encrypt with the salt-inclusive key (`IKM = telegramId:salt`) and decrypt correctly

3.2 WHEN a user with a non-NULL `encryption_salt` edits an entry THEN the system SHALL CONTINUE TO re-encrypt with the salt-inclusive key and return the correct plaintext

3.3 WHEN any user authenticates via `/api/auth/telegram` THEN the system SHALL CONTINUE TO issue a valid Supabase JWT and set the `accessToken` in the auth context

3.4 WHEN a free-tier user reads entries THEN the system SHALL CONTINUE TO enforce the 30-day history limit and 100-entry cap

3.5 WHEN a paid user's `subscription_ends_at` is in the past THEN the system SHALL CONTINUE TO downgrade them to `free` tier via `getEffectiveTier`

3.6 WHEN the bot handler encrypts a new entry for any user THEN the system SHALL CONTINUE TO use the correct key (salt-inclusive for users with a salt, legacy for users without)

---

## Bug Condition Pseudocode

**Bug Condition — Decryption failure:**

```pascal
FUNCTION isDecryptionBugCondition(profile)
  INPUT: profile of type ProfileRow
  OUTPUT: boolean

  // Bug triggers when the profile has no encryption_salt
  // (i.e. was created before migration 20240001000016)
  RETURN profile.encryption_salt IS NULL
END FUNCTION
```

```pascal
// Property: Fix Checking — Decryption
FOR ALL profile WHERE isDecryptionBugCondition(profile) DO
  entries ← GET /api/entries WITH jwt FOR profile
  FOR ALL entry IN entries WHERE entry.content STARTS WITH "enc:" DO
    ASSERT entry.content DOES NOT START WITH "enc:"
    ASSERT entry.content IS readable plaintext
  END FOR
END FOR

// Property: Preservation Checking — Decryption
FOR ALL profile WHERE NOT isDecryptionBugCondition(profile) DO
  ASSERT GET /api/entries behavior IS UNCHANGED
END FOR
```

**Bug Condition — Subscription loss:**

```pascal
FUNCTION isSubscriptionBugCondition(user)
  INPUT: user of type AuthUser
  OUTPUT: boolean

  // Bug triggers when the Supabase Auth UUID differs from profile.id
  RETURN user.id ≠ profile.id WHERE profile.telegram_id = user.telegram_id
END FUNCTION
```

```pascal
// Property: Fix Checking — Subscription
FOR ALL user WHERE isSubscriptionBugCondition(user) DO
  profile ← GET /api/profile WITH jwt FOR user
  ASSERT profile.subscription_tier = actual_tier_in_db
  ASSERT profile.subscription_tier ≠ NULL
END FOR

// Property: Preservation Checking — Subscription
FOR ALL user WHERE NOT isSubscriptionBugCondition(user) DO
  ASSERT GET /api/profile behavior IS UNCHANGED
END FOR
```
