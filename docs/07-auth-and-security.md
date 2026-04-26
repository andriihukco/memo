# Authentication & Security — Memo

---

## Authentication Architecture

Memo uses a **synthetic Supabase Auth account** per Telegram user. This bridges Telegram's identity system with Supabase's RLS-based security model.

### Why synthetic accounts?
Telegram doesn't issue OAuth tokens. Supabase Auth requires a user identity for RLS. The synthetic account pattern creates a stable, deterministic identity for each Telegram user that works with both the bot (service role) and mini app (user JWT) access paths.

---

## Bot-Side Authentication

```typescript
// src/lib/profile.ts
async function resolveOrCreateProfile(telegramId: number, username?: string) {
  // 1. Check if profile exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (profile) return profile;

  // 2. Create Supabase Auth user
  const email = `telegram_${telegramId}@memo.app`;
  const password = await derivePassword(telegramId); // HMAC-SHA256

  const { data: authUser } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  // 3. Create profile row with id = auth UUID
  await supabase.from('profiles').insert({
    id: authUser.user.id,
    telegram_id: telegramId,
    username,
  });

  return profile;
}
```

The bot uses the **service role key** which bypasses RLS. All bot operations are trusted.

---

## Mini App Authentication

```typescript
// src/app/api/auth/telegram/route.ts
async function POST(req: Request) {
  const { initData } = await req.json();

  // 1. Verify Telegram HMAC-SHA256 signature
  const params = await verifyInitData(initData, TELEGRAM_BOT_TOKEN);
  if (!params) return 401;

  // 2. Check auth_date freshness (24-hour window)
  const authDate = parseInt(params.get('auth_date') ?? '0');
  if (Date.now() / 1000 - authDate > 86400) return 401;

  // 3. Extract Telegram user ID
  const user = JSON.parse(params.get('user') ?? '{}');
  const telegramId = user.id;

  // 4. Sign in with synthetic credentials
  const email = `telegram_${telegramId}@memo.app`;
  const password = await derivePassword(telegramId);

  const { data } = await supabase.auth.signInWithPassword({ email, password });

  return { access_token: data.session.access_token, ... };
}
```

### initData Verification
```
secret_key = HMAC-SHA256("WebAppData", bot_token)
signature  = HMAC-SHA256(data_check_string, secret_key)
```
Where `data_check_string` is all key=value pairs (excluding `hash`) sorted alphabetically and joined with `\n`.

Comparison uses **timing-safe equality** to prevent timing attacks.

---

## Client-Side Encryption

All diary entries are encrypted before being sent to the server.

```typescript
// src/lib/crypto.ts
async function deriveUserKey(telegramId: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(telegramId),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('memo-salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptField(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  // Returns: base64(iv) + ':' + base64(ciphertext)
  return `${btoa(String.fromCharCode(...iv))}:${btoa(String.fromCharCode(...new Uint8Array(ciphertext)))}`;
}
```

**Encryption properties:**
- Algorithm: AES-GCM (authenticated encryption)
- Key size: 256-bit
- IV: 96-bit random per encryption
- Key derivation: PBKDF2 with 100,000 iterations

**What is encrypted:**
- `entries.content` — diary entry text
- `entries.bot_reply` — bot's reply text

**What is NOT encrypted:**
- `entries.category` — needed for filtering
- `entries.metadata` — needed for dashboard aggregation
- `entries.embedding` — vector for similarity search

**Known limitation:** The encryption key is derived deterministically from `telegram_id`. If the Telegram ID is known, the key can be derived. A per-user random salt stored server-side would be stronger but would require server-side key management.

---

## Row Level Security

All tables enforce user isolation:

```sql
-- Example: entries table
CREATE POLICY entries_owner ON entries
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**Access paths:**
| Path | Key Used | RLS |
|------|----------|-----|
| Bot webhook | Service role | Bypassed |
| Cron jobs | Service role | Bypassed |
| Mini App API | User JWT (anon key) | Enforced |
| Admin scripts | Service role | Bypassed |

---

## Passcode Lock

The mini app supports a 4-digit PIN lock stored locally.

```typescript
// src/lib/passcode.ts
async function createPinHash(pin: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}
```

**Storage:** `localStorage` (never sent to server)
**Hash:** SHA-256 of the 4-digit PIN
**Auto-lock timers:** immediately / 1 min / 5 min / 15 min / 1 hour

The passcode is a UX feature, not a cryptographic security measure. It prevents casual access but does not protect against device compromise.

---

## Security Checklist

| Control | Status | Notes |
|---------|--------|-------|
| Telegram initData verification | ✅ | HMAC-SHA256, timing-safe |
| 24-hour auth_date expiry | ✅ | Prevents replay attacks |
| RLS on all tables | ✅ | auth.uid() isolation |
| Client-side encryption | ✅ | AES-GCM 256-bit |
| Service role key server-only | ✅ | Never in client bundle |
| CRON_SECRET for cron routes | ✅ | Prevents unauthorized triggers |
| Timing-safe hash comparison | ✅ | Prevents timing attacks |
| Input validation (Zod) | ✅ | All API inputs validated |
| Rate limiting | ❌ | Not implemented — gap |
| Audit logging | ❌ | Not implemented — gap |
| Per-user encryption salt | ⚠️ | Deterministic key derivation |
| GDPR data export | ❌ | Not implemented — gap |
| Webhook secret token | ⚠️ | Should verify Telegram webhook secret |
