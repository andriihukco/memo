# Design — Pre-Launch Action Plan

## Architecture Overview

All changes are additive — no breaking changes to existing APIs or DB schema. The design follows existing patterns in the codebase.

---

## REQ-01: Rate Limiting

**Existing:** `src/lib/rate-limit.ts` already implements in-memory sliding window rate limiting used on webhook and auth routes.

**Design:** Extend the existing `rateLimit()` utility to all remaining API routes via a shared middleware pattern.

```typescript
// src/lib/rate-limit.ts — already exists, reuse as-is
// Apply to: /api/entries, /api/reports, /api/widgets, /api/graph, /api/categories
// Key: `route:${userId}` for authenticated routes
// Limits: 60 req/min for read, 30 req/min for write
```

**Implementation:** Add rate limit check at the top of each route handler, after JWT verification, keyed on the user's UUID from the JWT.

---

## REQ-03: Sentry Integration

**Design:** Use `@sentry/nextjs` with the existing `SENTRY_DSN` env var (already in schema as optional).

```
src/
  sentry.client.config.ts   — browser SDK init
  sentry.server.config.ts   — server SDK init  
  sentry.edge.config.ts     — edge runtime SDK init
next.config.mjs             — withSentryConfig() wrapper
```

Bot errors captured with `Sentry.setUser({ id: telegram_id })` in the profile middleware.

---

## REQ-04: Posthog Analytics

**Design:** Server-side capture for bot events (no client bundle impact on bot path). Client-side for Mini App events.

```typescript
// src/lib/analytics.ts — new file
export function capture(event: string, properties: Record<string, unknown>, distinctId: string): void
// Uses posthog-node for server-side, posthog-js for client-side
```

Mini App: `PostHogProvider` wraps the layout, `usePostHog()` hook in components.

Bot: `capture()` called after key actions in webhook handler (fire-and-forget, non-blocking).

---

## REQ-06: Free Tier Limit

**Design:** Single config change in `src/lib/stars/paywall.ts`.

```typescript
// TIER_INFO.free.limits.entries: 100 → 300
```

No migration needed — the limit is enforced at query time, not stored in DB.

---

## REQ-07: Free Weekly Summary

**Design:** Extend the existing `/api/cron/reports` route.

```
/api/cron/reports (existing)
  ├── deliver scheduled reports for paid users (existing)
  └── deliver weekly summary for free users (new)
       └── generateWeeklySummary(userId, entries) → Gemini
           → bot.api.sendMessage(telegram_id, summary)
```

New function `generateWeeklySummary()` in `src/lib/bot/retrospective.ts` — lighter version of `generateReport()`, max 300 words, no structured sections.

Cron schedule: already runs at 09:00 UTC daily. Monday check: `new Date().getDay() === 1`.

---

## REQ-08: Streak Notifications

**Design:** New cron step in `/api/cron/process`.

```typescript
// src/lib/processing/notifications.ts — new file
async function sendStreakReminders(): Promise<void>
  // 1. Find users active in last 7 days
  // 2. Filter: no entry today
  // 3. Calculate streak length from yesterday's entries
  // 4. Check notifications_log to avoid duplicates
  // 5. Send via bot.api.sendMessage()
  // 6. Insert into notifications_log
```

Uses existing `notifications_log` table (migration `20240001000019`).

---

## REQ-09: Soft Limit Warning

**Design:** New `UsageCounterChip` component + hook.

```typescript
// src/lib/hooks/use-usage-counts.ts — already exists
// src/components/ui/usage-warning-banner.tsx — new component

// Feed page: show chip when entries > 80% of limit
// Props: current, limit, onUpgrade
```

Threshold logic:
- `pct >= 80 && pct < 90` → amber chip in feed header
- `pct >= 90 && pct < 100` → amber banner with CTA
- `pct >= 100` → existing paywall modal (unchanged)

---

## REQ-10: Cursor-Based Pagination

**Design:** Extend `GET /api/entries` with cursor support.

```typescript
// New query param: cursor (UUID of last seen entry)
// Query: WHERE created_at < (SELECT created_at FROM entries WHERE id = cursor)
// ORDER BY created_at DESC LIMIT 30

// Response adds:
{ entries: [...], next_cursor: "uuid" | null, has_more: boolean }
```

Feed page: `useInfiniteScroll` hook with `IntersectionObserver` on a sentinel div at the bottom of the list.

---

## REQ-11: Subscription Expiry Notifications

**Design:** New cron step checking `subscription_ends_at`.

```typescript
// src/lib/processing/notifications.ts (same file as REQ-08)
async function sendExpiryReminders(): Promise<void>
  // Query: profiles WHERE subscription_ends_at IN (now()+7d, now()+1d, now())
  // Check notifications_log for deduplication
  // Send via bot with InlineKeyboard button → miniapp/subscriptions
```

Notification types stored in `notifications_log.notification_type`:
- `subscription_expiry_7d`
- `subscription_expiry_1d`  
- `subscription_expired`

---

## REQ-12 & REQ-13: Embedding Retry + Recomputation

**Design:** Extend existing `embedEntry()` pipeline.

```typescript
// REQ-13: In PATCH /api/entries handler
await supabase.from('entries')
  .update({ embedding_status: 'pending', embedding_attempts: 0 })
  .eq('id', entryId)

// REQ-12: In /api/cron/process
async function retryFailedEmbeddings(userId: string): Promise<void>
  // SELECT entries WHERE embedding_status='failed' AND embedding_attempts < 3
  // For each: call embedEntry(), increment embedding_attempts
```

---

## REQ-14: Graph Empty State + D3 Cleanup

**Design:** Minimal changes to `src/app/miniapp/graph/page.tsx`.

```typescript
// Empty state condition: nodes.length === 0 && !loading
// D3 cleanup: useEffect return () => { simulation.stop(); }
```

Empty state component: reuse existing `EmptyState` component pattern from the codebase.

---

## REQ-15: Cron Idempotency

**Design:** Add unique constraint migration + update streak insert.

```sql
-- New migration: 20240001000025_streak_unique_constraint.sql
-- Already exists: 20240001000021_entries_streak_unique.sql — verify it covers this
```

Check existing migration first before adding a new one.

---

## REQ-18: `getLocale` Fallback Fix

**Design:** Fix the default locale in `src/i18n/t.ts` (or wherever `getLocale` is defined).

```typescript
// Current (broken): returns 'en' as default
// Fixed: returns 'uk' as default
export function getLocale(settings?: Record<string, unknown>): Locale {
  const lang = settings?.language;
  if (typeof lang === 'string' && SUPPORTED_LOCALES.includes(lang as Locale)) {
    return lang as Locale;
  }
  return 'uk'; // default
}
```

---

## Database Changes

No new migrations required for most items. Existing migrations cover:
- `encryption_salt` — migration 16
- `embedding_attempts` — migration 17
- `notifications_log` — migration 19
- `entries_streak_unique` — migration 21

New migration needed only for REQ-17 (encryption salt backfill script).

---

## File Change Summary

| File | Change | REQ |
|------|--------|-----|
| `src/lib/stars/paywall.ts` | entries limit 100→300 | REQ-06 |
| `src/lib/rate-limit.ts` | verify/extend | REQ-01 |
| `src/app/api/entries/route.ts` | rate limit + cursor pagination + embedding reset on edit | REQ-01, REQ-10, REQ-13 |
| `src/app/api/reports/route.ts` | rate limit | REQ-01 |
| `src/app/api/widgets/route.ts` | rate limit | REQ-01 |
| `src/app/api/graph/route.ts` | rate limit | REQ-01 |
| `src/app/api/cron/process/route.ts` | embedding retry + streak idempotency + notifications | REQ-08, REQ-11, REQ-12, REQ-15 |
| `src/app/api/cron/reports/route.ts` | weekly summary for free users | REQ-07 |
| `src/app/miniapp/page.tsx` | soft limit warning + infinite scroll | REQ-09, REQ-10 |
| `src/app/miniapp/graph/page.tsx` | empty state + D3 cleanup | REQ-14 |
| `src/lib/bot/retrospective.ts` | generateWeeklySummary() | REQ-07 |
| `src/lib/processing/notifications.ts` | streak + expiry notifications | REQ-08, REQ-11 |
| `src/lib/analytics.ts` | Posthog capture utility | REQ-04 |
| `src/i18n/t.ts` | getLocale default 'uk' | REQ-18 |
| `src/components/ui/usage-warning-banner.tsx` | new component | REQ-09 |
| `sentry.*.config.ts` | Sentry init | REQ-03 |
| `next.config.mjs` | withSentryConfig | REQ-03 |
| `scripts/backfill-encryption-salts.ts` | one-time migration script | REQ-17 |
