# Tasks — Pre-Launch Action Plan

## Sprint 0 — Blockers (ship before launch)

- [x] 1. Verify and harden rate limiting on all API routes
  - [x] 1.1 Audit existing rate limit coverage — check which routes already have `rateLimit()` calls
  - [x] 1.2 Add rate limiting to `GET /api/entries` (60 req/min per user)
  - [x] 1.3 Add rate limiting to `POST /api/reports` (10 req/min per user)
  - [x] 1.4 Add rate limiting to `POST /api/widgets` (20 req/min per user)
  - [x] 1.5 Add rate limiting to `GET /api/graph` (20 req/min per user)
  - [x] 1.6 Add rate limiting to `GET/POST /api/categories` (30 req/min per user)
  - [x] 1.7 Verify webhook rate limit (60/min per IP) is active in production
  - [x] 1.8 Verify auth rate limit (30/min per IP) is active in production

- [x] 2. Verify webhook secret is active in production
  - [x] 2.1 Confirm `TELEGRAM_WEBHOOK_SECRET` is set in Vercel production env vars
  - [x] 2.2 Confirm webhook is registered with Telegram using `secret_token` parameter (run `scripts/set-webhook.ts` if needed)
  - [x] 2.3 Test: send a request to webhook without secret → expect 403

- [x] 3. Set up Sentry error monitoring
  - [x] 3.1 Install `@sentry/nextjs` package
  - [x] 3.2 Create `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
  - [x] 3.3 Wrap `next.config.mjs` with `withSentryConfig()`
  - [x] 3.4 Add `SENTRY_DSN` to Vercel env vars and `.env.example`
  - [x] 3.5 Add `telegram_id` as Sentry user context in webhook profile middleware
  - [x] 3.6 Test: trigger a deliberate error and verify it appears in Sentry dashboard

- [x] 4. Set up Posthog product analytics
  - [x] 4.1 Install `posthog-js` and `posthog-node` packages
  - [x] 4.2 Create `src/lib/analytics.ts` with `capture()` utility (server-side + client-side)
  - [x] 4.3 Add `PostHogProvider` to Mini App layout (`src/app/miniapp/layout.tsx`)
  - [x] 4.4 Add `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` to env vars and `.env.example`
  - [x] 4.5 Track `entry_saved` event in bot text/voice handlers
  - [x] 4.6 Track `report_generated` event in retrospective handler
  - [x] 4.7 Track `paywall_shown` event in `PaywallModal` component
  - [x] 4.8 Track `trial_activated` event in trial API route
  - [x] 4.9 Track `subscription_started` event in Stars webhook handler
  - [x] 4.10 Track `onboarding_completed` and `onboarding_skipped` events in onboarding page
  - [x] 4.11 Verify events appear in Posthog dashboard

- [x] 5. Verify GDPR data export is fully implemented
  - [x] 5.1 Test `GET /api/profile/export` — verify it returns all user data including decrypted entries
  - [x] 5.2 Test `POST /api/profile/export/send` — verify it sends export via bot message
  - [x] 5.3 Add "Export my data" button to Settings page if not already present
  - [x] 5.4 Verify export includes: profile, entries, categories, reports, subscriptions, transactions

---

## Sprint 1 — Growth Foundation

- [x] 6. Increase free tier entry limit to 300
  - [x] 6.1 Update `TIER_INFO.free.limits.entries` from 100 to 300 in `src/lib/stars/paywall.ts`
  - [x] 6.2 Update paywall copy in i18n files (uk, en, ru, es, fr, zh) to reflect new limit
  - [x] 6.3 Verify paywall still triggers at 300 entries (not 100)

- [x] 7. Implement free weekly summary for all users
  - [x] 7.1 Create `generateWeeklySummary(userId, entries)` function in `src/lib/bot/retrospective.ts`
  - [x] 7.2 Summary prompt: lighter than full retro — entry count, top categories, one highlight, one AI insight, max 300 words
  - [x] 7.3 Add weekly summary delivery to `/api/cron/reports` — runs every Monday (check `new Date().getDay() === 1`)
  - [x] 7.4 Skip users who already have a scheduled paid report for that day (avoid duplicates)
  - [x] 7.5 Skip users with fewer than 5 entries in the past 7 days
  - [x] 7.6 Use `notifications_log` to prevent sending duplicate summaries on the same week
  - [x] 7.7 Test: trigger cron manually and verify summary is sent to a test user

- [x] 8. Implement streak notifications
  - [x] 8.1 Create `src/lib/processing/notifications.ts` with `sendStreakReminders()` function
  - [x] 8.2 Query: users who had entries in the last 7 days but NOT today
  - [x] 8.3 Calculate streak length: count consecutive days with entries going back from yesterday
  - [x] 8.4 Send reminder only if streak ≥ 3 days; send softer nudge for no-streak users (max once per 3 days)
  - [x] 8.5 Check `notifications_log` before sending — skip if `streak_reminder` sent today
  - [x] 8.6 Insert into `notifications_log` after sending
  - [x] 8.7 Add `sendStreakReminders()` call to `/api/cron/process` route
  - [x] 8.8 Test: verify notification is sent to user with 3+ day streak who hasn't logged today

- [x] 9. Add soft limit warning (usage counter chip + banner)
  - [x] 9.1 Create `src/components/ui/usage-warning-banner.tsx` component
  - [x] 9.2 Banner variants: `warning` (80–90%, amber chip) and `critical` (90–100%, amber banner with CTA)
  - [x] 9.3 Add usage warning to Feed page (`src/app/miniapp/page.tsx`) — show when entries > 80% of limit
  - [x] 9.4 Add usage warning to Reports page — show when reports > 80% of limit
  - [x] 9.5 Dismiss state stored in sessionStorage (not permanent)
  - [x] 9.6 "Upgrade" CTA in banner opens PaywallModal directly

- [ ] 10. Implement cursor-based pagination + infinite scroll in Feed
  - [x] 10.1 Update `GET /api/entries` to support `cursor` query param (UUID of last entry)
  - [x] 10.2 Cursor query: `WHERE created_at < (SELECT created_at FROM entries WHERE id = $cursor) ORDER BY created_at DESC LIMIT 30`
  - [x] 10.3 Response includes `next_cursor: string | null` and `has_more: boolean`
  - [x] 10.4 Preserve backward-compatible `offset` param for existing callers
  - [x] 10.5 Add `useInfiniteScroll` hook using `IntersectionObserver` on sentinel div
  - [x] 10.6 Feed page loads first 30 entries, appends more on scroll
  - [x] 10.7 Show loading skeleton during fetch
  - [x] 10.8 Show "Це всі твої записи 🎉" message when `has_more = false`
  - [x] 10.9 Test: user with 150 entries can scroll through all of them

---

## Sprint 2 — Retention

- [x] 11. Implement subscription expiry notifications
  - [x] 11.1 Add `sendExpiryReminders()` to `src/lib/processing/notifications.ts`
  - [x] 11.2 Query: `profiles WHERE subscription_ends_at BETWEEN now() AND now() + interval '8 days'`
  - [x] 11.3 Send 7-day warning: "Твоя підписка {tier} закінчується через 7 днів. Продовж, щоб не втратити доступ."
  - [x] 11.4 Send 1-day warning: "Завтра закінчується твоя підписка {tier}!"
  - [x] 11.5 Send expiry notification: "Твоя підписка {tier} закінчилась. Твої дані в безпеці — поновити підписку?"
  - [x] 11.6 Each notification includes InlineKeyboard button → Mini App subscriptions page
  - [x] 11.7 Deduplication via `notifications_log` (types: `expiry_7d`, `expiry_1d`, `expired`)
  - [x] 11.8 Add `sendExpiryReminders()` call to `/api/cron/process`

- [x] 12. Implement embedding retry for failed entries
  - [x] 12.1 Add `retryFailedEmbeddings(userId)` function to `src/lib/processing/loop.ts`
  - [x] 12.2 Query: `entries WHERE user_id=$1 AND embedding_status='failed' AND embedding_attempts < 3`
  - [x] 12.3 For each entry: call `embedEntry()`, increment `embedding_attempts` regardless of success/failure
  - [x] 12.4 Add `retryFailedEmbeddings()` call to the daily cron processing loop
  - [x] 12.5 Test: create an entry with `embedding_status='failed'`, run cron, verify retry attempt

- [x] 13. Reset embedding on entry edit
  - [x] 13.1 In `PATCH /api/entries` handler, after updating content: set `embedding_status='pending'` and `embedding_attempts=0`
  - [x] 13.2 Verify the existing async embedding pipeline picks up `pending` entries (it should — check `embedEntry()` is called after save)
  - [x] 13.3 Test: edit an entry, verify `embedding_status` resets to `pending`

- [x] 14. Fix graph empty state and D3 memory leak
  - [x] 14.1 In `src/app/miniapp/graph/page.tsx`, add empty state when `nodes.length === 0 && !loading`
  - [x] 14.2 Empty state content: 🕸️ emoji, "Граф з'явиться після того, як ти зробиш кілька записів", CTA button "Відкрити бот"
  - [x] 14.3 Add `return () => { simulation.stop(); }` to the D3 `useEffect` cleanup
  - [x] 14.4 Test: open graph page with no entries — verify empty state renders, no spinner

---

## Sprint 3 — Quality

- [x] 15. Fix cron job idempotency for streak entries
  - [x] 15.1 Check migration `20240001000021_entries_streak_unique.sql` — verify it adds the right unique constraint
  - [x] 15.2 If constraint is missing or insufficient, create migration `20240001000025_streak_idempotency.sql`
  - [x] 15.3 Update `autoIncrementStreaks()` in `src/lib/processing/loop.ts` to use `INSERT ... ON CONFLICT DO NOTHING`
  - [x] 15.4 Test: run cron twice in the same day — verify no duplicate streak entries

- [x] 16. Fix haptic feedback to use Telegram native API
  - [x] 16.1 Find all `navigator.vibrate()` calls in the codebase
  - [x] 16.2 Replace with `window.Telegram?.WebApp?.HapticFeedback?.impactOccurred()` or `notificationOccurred()`
  - [x] 16.3 Add fallback: `if (!tg?.HapticFeedback) navigator.vibrate(duration)`
  - [x] 16.4 Map vibration patterns to Telegram haptic types (light/medium/heavy impact, success/error/warning notification)

- [x] 17. Backfill encryption salts for existing users
  - [x] 17.1 Create `scripts/backfill-encryption-salts.ts` script
  - [x] 17.2 Script queries all profiles where `encryption_salt IS NULL`
  - [x] 17.3 For each profile: generate random 32-byte hex salt
  - [x] 17.4 Re-encrypt all entries for that user: decrypt with old key (telegram_id only), re-encrypt with new key (telegram_id + salt)
  - [x] 17.5 Update `profiles.encryption_salt` atomically with the re-encrypted entries
  - [x] 17.6 Script is idempotent — skip profiles that already have a salt
  - [x] 17.7 Document rollback procedure in script comments
  - [x] 17.8 **Run in maintenance window — coordinate with team before executing**

- [x] 18. Fix `getLocale` default locale fallback
  - [x] 18.1 Find `getLocale` function definition (likely in `src/i18n/t.ts`)
  - [x] 18.2 Change default return value from `'en'` to `'uk'`
  - [x] 18.3 Ensure invalid/missing language values fall back to `'uk'`
  - [x] 18.4 Run `npm test` — verify all 5 failing tests in `bot-multilanguage.test.ts` now pass
  - [x] 18.5 Verify no regression in other locale-related tests

- [x] 19. Normalize `bot_msg_id` to string type in new entries
  - [x] 19.1 Find all places where `bot_msg_id` is written to `metadata` in bot handlers
  - [x] 19.2 Ensure all new writes use `String(message.message_id)` not the raw number
  - [x] 19.3 Update thread resolution query to use string comparison only (remove dual number/string check)
  - [x] 19.4 Verify migration `20240001000022_normalize_bot_msg_id.sql` has been applied in production
  - [x] 19.5 Add unit test for thread resolution with string `bot_msg_id`
