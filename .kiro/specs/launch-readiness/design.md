# Design Document — Memo Launch Readiness

## Overview

This document describes the technical design for all 28 launch-readiness improvements across the Memo stack: the Next.js API layer (Vercel Edge + Node.js), the grammY Telegram bot, the Supabase PostgreSQL database, and the React mini app.

Changes are grouped by layer. Each section maps directly to one or more requirements and describes the concrete code changes needed.

---

## Architecture Summary

```
Telegram Bot API
      │
      ▼
/api/telegram/webhook  (Node.js runtime)
      │
      ├── grammY bot handlers
      ├── rate-limit.ts (sliding window, in-memory)
      └── profile.ts (resolveOrCreateProfile)

Mini App (React, /miniapp/*)
      │
      ▼
Next.js API Routes (Edge runtime)
      ├── /api/entries       – CRUD + encryption + tier enforcement
      ├── /api/graph         – D3 graph data
      ├── /api/reports       – AI retrospectives
      ├── /api/profile       – profile + settings
      ├── /api/profile/export – GDPR export
      └── /api/cron/process  – embedding + clustering + streaks

Supabase PostgreSQL
      ├── profiles           – user identity + subscription tier
      ├── entries            – encrypted diary entries + embeddings
      ├── categories         – user-defined categories
      ├── reports            – AI retrospective reports
      ├── subscriptions      – payment records
      ├── reminders          – scheduled reminders
      └── referrals          – referral relationships (new)
```

---

## 1. Security & Infrastructure (P0)

### 1.1 Rate Limiting — All Routes (Req 1)

`src/lib/rate-limit.ts` already implements a sliding-window in-memory limiter. The existing `rateLimit()` and `rateLimitResponse()` functions are used in the webhook and entries routes. The remaining routes need the same treatment.

**Changes:**
- `POST /api/auth/telegram` — add `rateLimit(\`auth:${ip}\`, 30, 60_000)`
- `GET /api/entries` — already has 120 reads/min ✓
- `POST /api/entries` — already has 30 writes/min ✓
- `/api/telegram/webhook` — already has 60/min ✓
- All other write routes (`/api/categories`, `/api/reports`, `/api/widgets`) — add 30 writes/min per JWT

The `Retry-After` header is already included in `rateLimitResponse()`.

### 1.2 Webhook Secret Verification (Req 2)

Already implemented in `src/app/api/telegram/webhook/route.ts`:
```typescript
const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET;
if (webhookSecret) {
  const incoming = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  if (incoming !== webhookSecret) return new Response("Forbidden", { status: 403 });
}
```

The comparison is a direct string equality check. To prevent timing attacks, replace with a constant-time comparison:

```typescript
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
```

### 1.3 Per-User Encryption Salt (Req 20)

**Database migration** — add nullable column:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS encryption_salt TEXT;
```

**Key derivation update** in `src/lib/crypto.ts`:
```typescript
export async function deriveUserKey(telegramUserId: string, salt?: string | null): Promise<CryptoKey> {
  // If salt provided, append to IKM before hashing
  const ikm = salt ? `${telegramUserId}:${salt}` : telegramUserId;
  // ... rest of HKDF derivation unchanged
}
```

All callers of `deriveUserKey` in API routes must fetch `profiles.encryption_salt` and pass it through. New users get a random 32-byte hex salt on profile creation:
```typescript
const encryptionSalt = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
```

---

## 2. Data & API Layer (P1)

### 2.1 GDPR Data Export — ZIP + CSV (Req 3)

The current `/api/profile/export` returns JSON. The requirement specifies a ZIP of CSV files.

**Runtime:** `nodejs` (already set — `jszip` and CSV serialization require Node APIs).

**Dependencies:** Add `jszip` for ZIP creation. CSV serialization is done inline (no extra dep needed for simple tabular data).

**Response shape:**
```
memo-export-YYYY-MM-DD.zip
  ├── entries.csv        (id, created_at, content, category, metric_value, metric_unit)
  ├── categories.csv     (id, name, label_ua, color, icon, created_at)
  ├── reports.csv        (id, period_type, period_from, period_to, summary, created_at)
  ├── subscriptions.csv  (id, tier, status, start_date, end_date, created_at)
  └── transactions.csv   (id, amount, currency, description, status, created_at)
```

**CSV helper:**
```typescript
function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(',');
  const body = rows.map(r =>
    columns.map(c => JSON.stringify(r[c] ?? '')).join(',')
  ).join('\n');
  return `${header}\n${body}`;
}
```

Rate limit (5/hour) is already in place.

### 2.2 Embedding Recomputation on Edit (Req 4)

Already implemented in `PATCH /api/entries`:
```typescript
if (plainContent !== existingPlain) {
  updates.embedding_status = "pending";
}
```
Content-only check is correct. Category-only or metric-only changes do not reset the status. ✓

### 2.3 Cursor-Based Pagination (Req 5)

Current `GET /api/entries` uses offset pagination (`page` + `limit`). Replace with cursor-based:

**New query params:** `before` (entry ID), `limit` (max 50, default 20)

**Query logic:**
```typescript
// If 'before' provided, fetch the created_at of that entry first
if (beforeId) {
  const { data: cursor } = await supabase
    .from("entries").select("created_at").eq("id", beforeId).single();
  query = query.lt("created_at", cursor.created_at);
}
query = query.limit(limit + 1); // fetch one extra to determine has_more
```

**Response:**
```json
{
  "entries": [...],
  "has_more": true,
  "next_cursor": "<last-entry-id>"
}
```

**Mini app changes** (`src/app/miniapp/dashboard/page.tsx`, feed component):
- Track `nextCursor` state
- On scroll-to-bottom + `has_more`, fetch next page with `before=nextCursor`
- Append entries to list
- Show loading spinner at bottom while fetching
- Show retry button on error

### 2.4 Embedding Retry for Failed Entries (Req 6)

Add a dedicated step in `src/lib/processing/loop.ts`:

```typescript
export async function retryFailedEmbeddings(userId: string): Promise<void> {
  const { data: failed } = await supabase
    .from("entries")
    .select("id, content, embedding_attempts")
    .eq("user_id", userId)
    .eq("embedding_status", "failed")
    .lt("embedding_attempts", 3);

  for (const entry of failed ?? []) {
    // embedEntry already handles retry with exponential backoff internally
    await embedEntry(entry.id, entry.content);
  }
}
```

Add `embedding_attempts` column to `entries` table:
```sql
ALTER TABLE entries ADD COLUMN IF NOT EXISTS embedding_attempts INT NOT NULL DEFAULT 0;
```

`embedEntry` increments `embedding_attempts` on each failed attempt and sets `embedding_status = 'failed'` after exhaustion.

Call `retryFailedEmbeddings` as a distinct step in `processUser()`, after `reembedPendingEntries`.

### 2.5 Normalize `bot_msg_id` Storage (Req 22)

**Migration:**
```sql
UPDATE entries
SET metadata = jsonb_set(
  metadata,
  '{bot_msg_id}',
  to_jsonb((metadata->>'bot_msg_id')::text)
)
WHERE metadata ? 'bot_msg_id'
  AND jsonb_typeof(metadata->'bot_msg_id') = 'number';
```

**Bot handler change** — when storing `bot_msg_id`, always cast to string:
```typescript
metadata: { ...existingMeta, bot_msg_id: String(ctx.message.message_id) }
```

**Thread resolution query** — remove dual-type fallback, use single string comparison.

### 2.6 Cron Job Idempotency (Req 23)

- `autoIncrementStreaks` — add unique constraint `(user_id, date)` on a new `streaks` table or use `ON CONFLICT DO NOTHING` on the entries insert keyed on `(user_id, category, DATE(created_at))`.
- Weekly summary cron — add unique constraint `(user_id, period_from, period_to)` on `reports` table; use `ON CONFLICT DO NOTHING`.
- Reminder delivery — use `UPDATE reminders SET status='sent' WHERE id=? AND status='pending'` (conditional update).

---

## 3. Mini App — UX & Features (P1)

### 3.1 Free Tier Soft Limit Warning (Req 7 & 16)

`UsageCounterChip` component already exists at `src/components/ui/usage-counter-chip.tsx`.

**Feed header logic** (in dashboard/feed page):
```typescript
const usagePct = entryCount / tierLimits.entries;

// >80%: show chip
{usagePct > 0.8 && tier === 'free' && (
  <UsageCounterChip current={entryCount} limit={tierLimits.entries} />
)}

// >90%: show dismissible banner
{usagePct > 0.9 && tier === 'free' && !bannerDismissed && (
  <ErrorBanner
    message="Ти майже досяг ліміту записів. Оновись до Nova щоб продовжити."
    onDismiss={() => setBannerDismissed(true)}
    cta={{ label: 'Оновитись', href: '/miniapp/subscriptions' }}
  />
)}

// 100%: show paywall modal
{usagePct >= 1 && tier === 'free' && (
  <PaywallModal open feature="entries" requiredTier="stars_basic" />
)}
```

`bannerDismissed` is session-scoped state (not persisted).

### 3.2 Graph Empty State & D3 Cleanup (Req 8 & 9)

**Empty state** — in `src/app/miniapp/graph/page.tsx`, after data loads:
```typescript
if (status === 'ready' && graphData?.nodes.length === 0) {
  return <EmptyState
    icon="graph"
    title="Граф порожній"
    description="Надішли перші записи боту — і граф зв'язків з'явиться тут."
    cta={{ label: 'Відкрити бота', href: `https://t.me/${BOT_USERNAME}` }}
  />;
}
```

**10-second timeout** — wrap `fetchGraph` with `AbortController`:
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);
const res = await fetch('/api/graph', { signal: controller.signal, ... });
clearTimeout(timeout);
```

**D3 cleanup** — in the `useEffect` that builds the simulation, return a cleanup function:
```typescript
useEffect(() => {
  // ... build simulation ...
  return () => {
    simulation.stop();
    svg.selectAll('*').remove();
    svg.on('.zoom', null);
  };
}, [status, graphData, selectedCategory, dateRange]);
```

### 3.3 Graph Focus Mode (Req 19)

When a node is tapped, instead of only showing the detail panel, also enter focus mode:

```typescript
function enterFocusMode(nodeId: string) {
  const neighborIds = new Set(
    links
      .filter(l => l.source.id === nodeId || l.target.id === nodeId)
      .flatMap(l => [l.source.id, l.target.id])
  );
  neighborIds.add(nodeId);

  // Dim non-neighbors
  nodeSel.attr('fill-opacity', d => neighborIds.has(d.id) ? 0.9 : 0.08);
  linkSel.attr('stroke-opacity', d =>
    neighborIds.has(d.source.id) && neighborIds.has(d.target.id) ? 0.6 : 0.03
  );

  // Zoom to neighborhood bounding box
  zoomToBoundingBox(nodes.filter(n => neighborIds.has(n.id)));
  setFocusNodeId(nodeId);
}
```

**"Show all" button** — rendered when `focusNodeId !== null`:
```typescript
{focusNodeId && (
  <Button onClick={exitFocusMode} className="absolute top-4 right-4">
    Показати все
  </Button>
)}
```

`exitFocusMode` resets opacity and zooms back to full graph.

### 3.4 Settings Page Restructure (Req 21)

Reorganize `src/app/miniapp/settings/page.tsx` into sections with sticky headers:

```
┌─────────────────────────────┐
│  Підписка                   │  ← current tier + expiry + upgrade CTA
│  Приватність та безпека     │  ← PIN, encryption info
│  Сповіщення                 │  ← streak reminders, weekly summary toggles
│  Категорії                  │  ← link to /miniapp/categories
│  Підтримка                  │  ← FAQ, contact
│  Про додаток                │  ← version, changelog
└─────────────────────────────┘
```

Each section is a `<section>` with an `id` for scroll targeting. Section headers use `<h2>` for accessibility.

### 3.5 Haptic Feedback on Android (Req 24)

Update `src/lib/haptics.ts` (or create it):

```typescript
export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
  } catch { /* silent */ }
}

export function hapticNotification(type: 'error' | 'success' | 'warning') {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type);
  } catch { /* silent */ }
}
```

Replace all `navigator.vibrate()` calls with `hapticImpact()`. Use `hapticNotification('warning')` for destructive confirmations (delete).

---

## 4. Bot Features (P1 / P2)

### 4.1 Reminders (Req 10)

**Database table:**
```sql
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON reminders (scheduled_at) WHERE status = 'pending';
```

**Bot command** — add to `src/lib/bot/commands.ts`:
```typescript
export async function handleRemind(ctx: BotContext) {
  // Parse: /remind <text> at <HH:MM>
  const match = ctx.message?.text?.match(/^\/remind (.+) at (\d{1,2}:\d{2})$/i);
  if (!match) {
    return ctx.reply('Формат: /remind випити воду at 15:00');
  }
  const [, text, time] = match;
  // Build scheduled_at from today's date + parsed time (UTC)
  // Store in reminders table
  // Confirm to user
}
```

**Cron delivery** — add `processReminders()` to `src/lib/processing/loop.ts`:
```typescript
export async function processReminders(): Promise<void> {
  const { data: due } = await supabase
    .from("reminders")
    .select("id, user_id, text")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString());

  for (const reminder of due ?? []) {
    // Send message via bot
    // UPDATE reminders SET status='sent' WHERE id=? AND status='pending'
  }
}
```

### 4.2 Streak Notifications (Req 11)

Add `processStreakNotifications()` to the daily cron:

```typescript
export async function processStreakNotifications(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: inactive } = await supabase
    .from("profiles")
    .select("id, telegram_id, settings")
    .filter("settings->notifications_streak", "neq", false);

  for (const profile of inactive ?? []) {
    const { count } = await supabase
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .gte("created_at", cutoff);

    if ((count ?? 0) === 0) {
      // Check user has at least one entry ever (not a new user)
      const { count: total } = await supabase
        .from("entries").select("id", { count: "exact", head: true }).eq("user_id", profile.id);
      if ((total ?? 0) === 0) continue;

      // Send streak reminder via bot API
    }
  }
}
```

Idempotency: track sent notifications in a `notifications_log` table with `(user_id, type, date)` unique constraint and `ON CONFLICT DO NOTHING`.

### 4.3 Free Weekly Summary (Req 12)

Add `processWeeklySummaries()` to the Monday cron:

```typescript
export async function processWeeklySummaries(): Promise<void> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Find users with ≥3 entries in the past 7 days who haven't opted out
  // For free tier: generate simplified highlights via Gemini
  // For paid tier: generate full retrospective format
  // Deliver via bot message
  // Insert into reports with ON CONFLICT DO NOTHING on (user_id, period_from, period_to)
}
```

---

## 5. Growth & Monetization (P2)

### 5.1 Free Trial for Nova (Req 13)

**Profile column:**
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_used BOOLEAN NOT NULL DEFAULT false;
```

**API endpoint** `POST /api/profile/trial`:
```typescript
// Check: user has never had paid subscription AND trial_used = false
// Set: subscription_tier='stars_basic', subscription_ends_at=now()+3days, trial_used=true
// Return: updated profile
```

**Mini app** — show trial offer in `PaywallModal` when `!trialUsed`:
```typescript
{!trialUsed && (
  <Button onClick={activateTrial}>
    Спробувати Nova безкоштовно — 3 дні
  </Button>
)}
```

Trial badge in feed header: `{isTrial && <Badge>Пробний · {daysLeft} дн.</Badge>}`

### 5.2 Referral System (Req 14)

**Database table:**
```sql
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id),
  referred_id UUID REFERENCES profiles(id),
  code TEXT NOT NULL UNIQUE,
  reward_granted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Bot command** `/invite`:
```typescript
export async function handleInvite(ctx: BotContext) {
  // Generate or fetch existing referral code for this user
  // Build deep link: https://t.me/<BOT_USERNAME>?start=ref_<code>
  // Reply with link + instructions
}
```

**On new user `/start` with `ref_` param:**
- Record `referred_id` in referrals table
- When referred user activates paid subscription → grant referrer 30 days Nova via `createSubscription`
- Notify referrer via bot message
- Set `reward_granted = true`

### 5.3 Share Retrospective (Req 15)

**Mini app** — add Share button to report detail view:

```typescript
async function shareReport(report: Report) {
  // Generate image card using html-to-image or canvas
  // Include: report highlights, Memo logo, CTA text
  // Use Telegram.WebApp.openTelegramLink or shareToStory API
  // On failure: fallback to text-only share via Telegram.WebApp.switchInlineQuery
}
```

The image card is generated client-side using `html-to-image` (converts a hidden DOM node to a PNG blob). The blob is shared via `Telegram.WebApp.shareToStory` if available, otherwise via a pre-filled `t.me/share/url` link.

---

## 6. Subscription & Tier System (P2)

### 6.1 Revised Tier Feature Matrix (Req 26)

Changes to `src/lib/stars/paywall.ts`:

```typescript
export const FEATURE_TIERS: Record<string, SubscriptionTier> = {
  ai_reports:           "stars_basic",
  ai_recommendations:   "stars_basic",
  voice_logging:        "free",        // ← changed from stars_basic
  goal_tracking:        "stars_basic",
  custom_widgets:       "stars_basic",
  full_history:         "stars_pro",
  graph_full:           "stars_basic",
  data_export:          "stars_pro",
  priority_processing:  "stars_pro",
};
```

`TIER_INFO.free.features` — add `{ label: "Голосові повідомлення", included: true }`.

Remove paywall check for `voice_logging` in the voice message handler.

### 6.2 Date Range Restriction (Req 27 & 28)

Already partially implemented in `GET /api/entries`:
```typescript
const historyDays = TIER_INFO[tier].limits.historyDays;
if (historyDays !== Infinity) {
  const cutoff = new Date(Date.now() - historyDays * 86_400_000).toISOString();
  query = query.gte("created_at", cutoff);
}
```

Apply the same pattern to:
- `GET /api/graph` — filter nodes by `created_at >= cutoff`
- `GET /api/reports` — restrict queryable date range
- Dashboard date range picker — disable presets beyond `historyDays`

Data is **never deleted** from the DB — only filtered in API responses. Upgrading immediately unlocks full history.

---

## 7. Analytics & Observability (P2)

### 7.1 Sentry Integration (Req 17)

**Install:** `@sentry/nextjs`

**`sentry.server.config.ts`:**
```typescript
import * as Sentry from "@sentry/nextjs";
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
```

Wrap API route handlers with `Sentry.withSentry()` or use the Next.js instrumentation hook. Source maps uploaded via `@sentry/nextjs` Webpack plugin.

**PII exclusion** — configure `beforeSend` to strip `content`, `bot_reply`, and `telegram_id` from event data.

### 7.2 Product Analytics (Req 17)

**Install:** `posthog-js`

**Key events:**
```typescript
posthog.capture('entry_saved', { category, tier });
posthog.capture('report_generated', { period_type, tier });
posthog.capture('paywall_shown', { feature, tier });
posthog.capture('subscription_started', { tier, billing_period });
```

User identified by anonymized hash of `telegram_id` — never raw PII.

---

## 8. Code Quality (P3)

### 8.1 JSDoc for Complex Functions (Req 25)

Add JSDoc to:
- `classify()` in `src/lib/classifier.ts`
- `embedEntry()` in `src/lib/embedding.ts` (already partially documented)
- `clusterEntries()` in `src/lib/processing/loop.ts`
- `verifyInitData()` in the auth module
- `resolveOrCreateProfile()` in `src/lib/profile.ts` (already partially documented)

### 8.2 Comprehensive Test Suite (Req 18)

**Test file locations:**
- `src/__tests__/auth.test.ts` — `verifyInitData()` unit tests
- `src/__tests__/classifier.test.ts` — `classify()` unit tests
- `src/__tests__/paywall.test.ts` — `calcPrice()` unit tests
- `src/__tests__/clustering.test.ts` — `clusterEntries()` property-based tests (fast-check)
- `src/__tests__/api-auth.test.ts` — integration tests for `POST /api/auth/telegram`
- `src/__tests__/api-entries.test.ts` — integration tests for `POST /api/entries`

All external dependencies (Gemini, Supabase) are mocked. Tests run with `npm test` (Vitest).

**Property-based tests for `clusterEntries()`:**
```typescript
fc.assert(fc.property(
  fc.array(entryArbitrary, { minLength: 3, maxLength: 50 }),
  (entries) => {
    const result1 = clusterEntries(entries);
    const result2 = clusterEntries(result1); // idempotent
    expect(result2).toEqual(result1);
    expect(new Set(result1.map(e => e.branch_id)).size).toBeLessThanOrEqual(entries.length);
  }
));
```

---

## 9. Database Migrations Summary

| Migration | Change |
|-----------|--------|
| `profiles` | Add `encryption_salt TEXT`, `trial_used BOOLEAN DEFAULT false` |
| `entries` | Add `embedding_attempts INT DEFAULT 0` |
| `entries.metadata` | Normalize `bot_msg_id` from number to string |
| `reminders` | New table with `(user_id, text, scheduled_at, status)` |
| `referrals` | New table with `(referrer_id, referred_id, code, reward_granted)` |
| `notifications_log` | New table with unique `(user_id, type, date)` for idempotent notifications |
| `reports` | Add unique constraint on `(user_id, period_from, period_to)` |

---

## 10. Correctness Properties

The following properties must hold and are verified by the test suite:

1. **Rate limit monotonicity** — a client that has been rate-limited cannot receive `allowed=true` until the window resets.
2. **Encryption round-trip** — `decrypt(encrypt(x, key), key) === x` for all strings `x` and all valid keys.
3. **Tier enforcement** — a free-tier user can never receive entries with `created_at < now() - 30 days` from any API endpoint.
4. **Clustering idempotency** — applying `clusterEntries` twice produces the same `branch_id` assignments as applying it once.
5. **Cluster count bound** — the number of distinct clusters never exceeds the number of input entries.
6. **Export completeness** — the ZIP export contains exactly the rows present in the DB for that user at the time of export (no additions, no omissions).
7. **Referral uniqueness** — a referrer receives at most one reward per referred user, regardless of how many subscriptions the referred user purchases.
8. **Trial uniqueness** — `trial_used = true` is set atomically; a user cannot activate the trial twice even under concurrent requests.
