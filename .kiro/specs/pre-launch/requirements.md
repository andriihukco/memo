# Requirements — Pre-Launch Action Plan

## Overview

Memo is ready for launch after completing a structured set of improvements across security, stability, growth, retention, and quality. The goal is to reach 1,000 users in the first month with 10% paid conversion.

This spec covers all work required before and immediately after launch, organized into 5 sprints.

---

## Sprint 0 — Blockers (must ship before launch)

### REQ-01: Per-IP Rate Limiting on All API Routes
**Priority:** P0 — Security  
**Status:** Not implemented

The system has zero rate limiting. A single actor can spam the Telegram webhook and exhaust the Gemini API budget within minutes.

**Acceptance criteria:**
- Telegram webhook: max 60 updates/min per IP (already partially done — verify)
- `/api/auth/telegram`: max 30 requests/min per IP (already done — verify)
- `/api/entries`, `/api/reports`, `/api/widgets`: max 60 requests/min per user JWT
- `/api/cron/*`: protected by `CRON_SECRET` only (no rate limit needed)
- Rate limit responses return HTTP 429 with `Retry-After` header
- Rate limit state stored in-memory (Vercel Edge) or Upstash Redis

### REQ-02: Webhook Secret Verification
**Priority:** P0 — Security  
**Status:** Implemented (verify it's active in production)

The `X-Telegram-Bot-Api-Secret-Token` header must be verified on every webhook request.

**Acceptance criteria:**
- `TELEGRAM_WEBHOOK_SECRET` env var is set in Vercel production
- Webhook is registered with Telegram using `secret_token` parameter
- Requests without valid secret return HTTP 403
- Timing-safe comparison used (already implemented)

### REQ-03: Error Monitoring (Sentry)
**Priority:** P0 — Observability  
**Status:** Not implemented

Without error monitoring, production bugs are invisible.

**Acceptance criteria:**
- Sentry Next.js SDK installed and configured
- `SENTRY_DSN` env var set in Vercel
- Unhandled errors in API routes captured with stack traces
- Bot handler errors captured with `telegram_id` context
- Source maps uploaded on deploy
- `SENTRY_DSN` is optional — if not set, Sentry is a no-op (already in env schema)

### REQ-04: Product Analytics (Posthog)
**Priority:** P0 — Growth  
**Status:** Not implemented

Without analytics, it's impossible to optimize the conversion funnel.

**Acceptance criteria:**
- Posthog JS SDK installed in Mini App
- Server-side event capture for bot events
- Key events tracked:
  - `entry_saved` (category, intent)
  - `report_generated` (period_type)
  - `paywall_shown` (feature, tier)
  - `trial_activated`
  - `subscription_started` (tier, billing_period)
  - `subscription_expired`
  - `onboarding_completed`
  - `onboarding_skipped`
- User identified by `telegram_id` (hashed for privacy)
- `NEXT_PUBLIC_POSTHOG_KEY` env var

### REQ-05: GDPR Data Export
**Priority:** P0 — Legal  
**Status:** Route exists (`/api/profile/export`) — verify implementation

EU users have a legal right to data portability (GDPR Article 20).

**Acceptance criteria:**
- `GET /api/profile/export` returns all user data as JSON
- Export includes: profile, all entries (decrypted), categories, reports, subscriptions
- `POST /api/profile/export/send` sends export via Telegram bot message
- UI button in Settings → "Export my data"
- Export completes within 30 seconds for users with up to 2,000 entries

---

## Sprint 1 — Growth Foundation (week 1–2 post-launch)

### REQ-06: Increase Free Tier Entry Limit
**Priority:** P1 — Acquisition  
**Status:** Config change only

100 entries is too restrictive. Users hit the limit before experiencing full value.

**Acceptance criteria:**
- Free tier entry limit increased from 100 → 300
- Change applied in `TIER_INFO` config in `src/lib/stars/paywall.ts`
- Paywall copy updated to reflect new limit
- Existing users below 300 entries unaffected

### REQ-07: Free Weekly Summary for All Users
**Priority:** P1 — Retention  
**Status:** Not implemented

Free users never experience the retrospective feature. A weekly summary demonstrates value and drives upgrades.

**Acceptance criteria:**
- Every Monday at 09:00 UTC, all users with ≥5 entries in the past week receive a simplified summary via bot
- Summary includes: entry count, top categories, one highlight metric, one AI-generated insight
- Summary is shorter than a full retrospective (max 300 words)
- Free users receive summary regardless of report limit
- Paid users receive their full scheduled report instead (no duplicate)
- Opt-out available via `/cancel` command or settings

### REQ-08: Streak Notifications
**Priority:** P1 — Retention  
**Status:** Not implemented

No proactive engagement when users miss a day.

**Acceptance criteria:**
- Daily cron at 20:00 UTC checks users who haven't logged any entry today
- Users with a streak of ≥3 days receive a gentle reminder: "Не забудь записати свій день 🔥 Стрік: N днів"
- Users with no streak receive a softer nudge (max once per 3 days)
- Notification only sent if user has interacted with bot in the last 7 days (avoid spamming inactive users)
- Opt-out via `/cancel` command

### REQ-09: Soft Limit Warning (Usage Counter)
**Priority:** P1 — Conversion  
**Status:** Not implemented

Paywall appears abruptly when limit is hit. Users need a warning before hitting the wall.

**Acceptance criteria:**
- Feed header shows `UsageCounterChip` when user has used ≥80% of entry limit
- At 90% usage: amber banner "Ти майже на межі — X записів залишилось"
- At 100%: existing paywall modal (unchanged)
- Dashboard and reports pages show similar warnings for their respective limits
- Chip/banner dismissed per-session (not permanently)

### REQ-10: Cursor-Based Pagination + Infinite Scroll
**Priority:** P1 — Core UX  
**Status:** Not implemented

Feed is hard-capped at 100 entries. Users with more entries lose access to their history.

**Acceptance criteria:**
- `GET /api/entries` supports `cursor` param (entry UUID) for cursor-based pagination
- Default page size: 30 entries
- Feed page implements infinite scroll: load more when user scrolls to bottom
- Loading skeleton shown during fetch
- "You've reached the beginning" message when no more entries
- Existing `offset`-based pagination preserved for backward compatibility

---

## Sprint 2 — Retention (week 3–4 post-launch)

### REQ-11: Subscription Expiry Notifications
**Priority:** P2 — Revenue  
**Status:** Not implemented

Users forget to renew. No notification = silent churn.

**Acceptance criteria:**
- Bot sends reminder 7 days before subscription expires: "Твоя підписка закінчується через 7 днів"
- Bot sends reminder 1 day before expiry
- Bot sends notification on day of expiry with renewal CTA
- Each notification sent only once (tracked in `notifications_log` table)
- Notification includes inline button to open Mini App subscriptions page

### REQ-12: Embedding Retry for Failed Entries
**Priority:** P2 — Quality  
**Status:** Not implemented

`embedding_status = 'failed'` entries are never retried. Semantic search degrades over time.

**Acceptance criteria:**
- Daily cron (`/api/cron/process`) retries entries with `embedding_status = 'failed'` and `embedding_attempts < 3`
- Exponential backoff: attempt 1 immediately, attempt 2 after 1 day, attempt 3 after 3 days
- After 3 failed attempts, entry is marked `embedding_status = 'failed'` permanently (no more retries)
- `embedding_attempts` column already exists in migration `20240001000017`

### REQ-13: Embedding Recomputation on Edit
**Priority:** P2 — Quality  
**Status:** Not implemented

Editing an entry doesn't update its embedding vector. Stale vectors break semantic search.

**Acceptance criteria:**
- `PATCH /api/entries` sets `embedding_status = 'pending'` and `embedding_attempts = 0` after content update
- Existing async embedding pipeline picks up pending entries
- No change to response latency (embedding is async)

### REQ-14: Graph Empty State + D3 Cleanup
**Priority:** P2 — UX  
**Status:** Not implemented

Graph shows infinite spinner when no embeddings exist. D3 simulation leaks memory on unmount.

**Acceptance criteria:**
- Graph page shows empty state when no entries with embeddings exist
- Empty state includes: illustration/emoji, explanation text, CTA to send first message to bot
- `simulation.stop()` called in `useEffect` cleanup function
- Empty state shown when graph API returns 0 nodes

---

## Sprint 3 — Quality (week 5–6 post-launch)

### REQ-15: Cron Job Idempotency
**Priority:** P3 — Stability  
**Status:** Not implemented

`autoIncrementStreaks()` can create duplicate entries if Vercel fires the cron twice.

**Acceptance criteria:**
- Streak entry inserts use `ON CONFLICT DO NOTHING` or equivalent upsert
- Migration adds unique constraint: `(user_id, category, date_trunc('day', created_at))`
- Cron is safe to run multiple times per day without side effects

### REQ-16: Haptic Feedback Fix
**Priority:** P3 — UX  
**Status:** Partially broken

`navigator.vibrate()` doesn't work on iOS. Telegram provides a native haptics API.

**Acceptance criteria:**
- All haptic calls use `window.Telegram.WebApp.HapticFeedback` API
- Fallback to `navigator.vibrate()` for non-Telegram contexts
- Impact types mapped: light → `impact({style:'light'})`, medium → `impact({style:'medium'})`, heavy → `impact({style:'heavy'})`
- Notification types: success → `notification({type:'success'})`, error → `notification({type:'error'})`

### REQ-17: Per-User Encryption Salt (Migration)
**Priority:** P3 — Security  
**Status:** Column exists, existing users have NULL salt

New users get a random salt (implemented). Existing users still use the legacy deterministic key.

**Acceptance criteria:**
- Migration script generates and assigns random salts to all existing profiles where `encryption_salt IS NULL`
- Script re-encrypts all entries for affected users with the new salt-derived key
- Script is idempotent (safe to run multiple times)
- Rollback plan documented
- **Note:** This is a complex migration — run in maintenance window

### REQ-18: Bot `getLocale` Fallback Fix
**Priority:** P3 — Bug  
**Status:** Failing tests confirm the bug

`getLocale({})` returns `'en'` instead of `'uk'`. Tests in `bot-multilanguage.test.ts` confirm this.

**Acceptance criteria:**
- `getLocale({})` returns `'uk'` (Ukrainian default)
- `getLocale({ language: 42 })` returns `'uk'` (invalid type fallback)
- All 5 failing tests in `bot-multilanguage.test.ts` pass
- No regression in other locale tests

### REQ-19: Normalize `bot_msg_id` Type
**Priority:** P3 — Bug  
**Status:** Migration exists but code may still write both types

Historical inconsistency: `bot_msg_id` stored as both number and string in metadata.

**Acceptance criteria:**
- All new entries store `bot_msg_id` as string in metadata
- Migration `20240001000022_normalize_bot_msg_id.sql` already handles existing data
- Thread resolution query uses single type check (string only)
- Unit test covers thread resolution with string `bot_msg_id`
