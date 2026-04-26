# Implementation Tasks — Memo Launch Readiness

## P0 — Critical (Security & Compliance)

- [x] 1. Timing-safe webhook secret comparison
  - [x] 1.1 Add `timingSafeEqual(a, b)` helper in `src/app/api/telegram/webhook/route.ts`
  - [x] 1.2 Replace `incoming !== webhookSecret` with `!timingSafeEqual(incoming, webhookSecret)`

- [x] 2. Rate limiting on remaining routes
  - [x] 2.1 Add `rateLimit(\`auth:${ip}\`, 30, 60_000)` to `POST /api/auth/telegram`
  - [x] 2.2 Add 30 writes/min rate limit to `POST /api/categories`
  - [x] 2.3 Add 30 writes/min rate limit to `POST /api/reports`
  - [x] 2.4 Add 30 writes/min rate limit to `POST /api/widgets`

- [x] 3. Per-user encryption salt
  - [x] 3.1 Create migration `supabase/migrations/20240001000016_encryption_salt.sql` — add `encryption_salt TEXT` nullable column to `profiles`
  - [x] 3.2 Update `deriveUserKey()` in `src/lib/crypto.ts` to accept optional `salt` param and use `${telegramUserId}:${salt}` as IKM when provided
  - [x] 3.3 Update `resolveOrCreateProfile()` in `src/lib/profile.ts` to generate a random 32-byte hex salt and store it on new profile creation
  - [x] 3.4 Update all `deriveUserKey()` callers in API routes to fetch `profiles.encryption_salt` and pass it through

- [x] 4. GDPR data export — ZIP + CSV
  - [x] 4.1 Add `jszip` dependency (`npm install jszip`)
  - [x] 4.2 Rewrite `GET /api/profile/export` to produce a ZIP archive with CSV files: `entries.csv`, `categories.csv`, `reports.csv`, `subscriptions.csv`, `transactions.csv`
  - [x] 4.3 Set `Content-Type: application/zip` and `Content-Disposition: attachment; filename="memo-export-YYYY-MM-DD.zip"`
  - [x] 4.4 Handle decryption failures gracefully — include raw value rather than failing the whole export

---

## P1 — High Priority (Core UX & Data)

- [x] 5. Cursor-based pagination for entries feed
  - [x] 5.1 Update `GET /api/entries` to accept `before` (entry ID) and `limit` (max 50) query params, replacing offset pagination
  - [x] 5.2 Return `{ entries, has_more, next_cursor }` response shape
  - [x] 5.3 Update feed in `src/app/miniapp/dashboard/page.tsx` to track `nextCursor` state and implement infinite scroll
  - [x] 5.4 Show loading spinner at bottom while fetching next page
  - [x] 5.5 Show retry button on next-page fetch failure

- [x] 6. Embedding retry for failed entries
  - [x] 6.1 Create migration to add `embedding_attempts INT NOT NULL DEFAULT 0` column to `entries`
  - [x] 6.2 Update `embedEntry()` in `src/lib/embedding.ts` to increment `embedding_attempts` on each failed attempt
  - [x] 6.3 Add `retryFailedEmbeddings(userId)` function to `src/lib/processing/loop.ts` — queries `embedding_status='failed' AND embedding_attempts < 3`
  - [x] 6.4 Call `retryFailedEmbeddings` as a distinct step in `processUser()` after `reembedPendingEntries`

- [x] 7. Free tier soft limit warnings in feed
  - [x] 7.1 Fetch entry count and tier limits in `src/app/miniapp/dashboard/page.tsx`
  - [x] 7.2 Show `UsageCounterChip` when `entryCount > 80` and tier is `free`
  - [x] 7.3 Show dismissible `ErrorBanner` with upgrade CTA when `entryCount > 90` and tier is `free`
  - [x] 7.4 Show `PaywallModal` when `entryCount >= 100` and tier is `free`
  - [x] 7.5 Ensure banner dismissed state is session-scoped (not persisted)

- [x] 8. Graph empty state
  - [x] 8.1 Add empty state render in `src/app/miniapp/graph/page.tsx` when `status === 'ready' && nodes.length === 0`
  - [x] 8.2 Empty state includes message and CTA deep-linking to the Telegram bot
  - [x] 8.3 Wrap `fetchGraph` with `AbortController` and 10-second timeout; show error state on abort

- [x] 9. D3 simulation cleanup on unmount
  - [x] 9.1 Return cleanup function from the D3 `useEffect` that calls `simulation.stop()`, `svg.selectAll('*').remove()`, and `svg.on('.zoom', null)`

- [x] 10. Graph focus mode
  - [x] 10.1 Add `focusNodeId` state to `GraphPage`
  - [x] 10.2 On node click, compute 1-hop neighborhood, dim non-neighbor nodes/edges, zoom to bounding box
  - [x] 10.3 Render "Показати все" button when `focusNodeId !== null`
  - [x] 10.4 `exitFocusMode` resets opacity and zooms back to full graph
  - [x] 10.5 Handle isolated nodes (no connections) — show only that node with a message

- [x] 11. Reminders feature
  - [x] 11.1 Create migration for `reminders` table with `(user_id, text, scheduled_at, status)` and partial index on `scheduled_at WHERE status='pending'`
  - [x] 11.2 Add `handleRemind` command handler in `src/lib/bot/commands.ts` — parse `/remind <text> at <HH:MM>`, store row, confirm to user
  - [x] 11.3 Register `/remind` command in `src/app/api/telegram/webhook/route.ts`
  - [x] 11.4 Add `processReminders()` to `src/lib/processing/loop.ts` — send due reminders via bot, update `status='sent' WHERE status='pending'`
  - [x] 11.5 Call `processReminders()` from the cron handler

- [x] 12. Streak notifications
  - [x] 12.1 Create migration for `notifications_log` table with unique constraint on `(user_id, type, date)`
  - [x] 12.2 Add `processStreakNotifications()` to `src/lib/processing/loop.ts` — skip users with no entries ever, skip opted-out users, use `ON CONFLICT DO NOTHING` on `notifications_log`
  - [x] 12.3 Call `processStreakNotifications()` from the daily cron

- [x] 13. Free weekly summary
  - [x] 13.1 Add `processWeeklySummaries()` to `src/lib/processing/loop.ts` — find users with ≥3 entries in past 7 days, generate simplified (free) or full (paid) summary via Gemini, deliver via bot
  - [x] 13.2 Insert report with `ON CONFLICT DO NOTHING` on `(user_id, period_from, period_to)`
  - [x] 13.3 Respect `settings.notifications_weekly` opt-out flag
  - [x] 13.4 Add unique constraint migration on `reports(user_id, period_from, period_to)`

- [x] 14. Cron job idempotency
  - [x] 14.1 Add `ON CONFLICT DO NOTHING` to `autoIncrementStreaks` insert, keyed on `(user_id, category, DATE(created_at))`
  - [x] 14.2 Ensure reminder delivery uses conditional `WHERE status='pending'` update (already in design — verify implementation)

- [x] 15. Normalize `bot_msg_id` storage
  - [x] 15.1 Create idempotent migration to convert `metadata->'bot_msg_id'` from JSON number to JSON string for all existing rows
  - [x] 15.2 Update bot handlers to always store `bot_msg_id: String(ctx.message.message_id)`
  - [x] 15.3 Update thread resolution query to use single string comparison

- [x] 16. Settings page restructure
  - [x] 16.1 Reorganize `src/app/miniapp/settings/page.tsx` into sections: Підписка, Приватність та безпека, Сповіщення, Категорії, Підтримка, Про додаток
  - [x] 16.2 Each section is a `<section id="...">` with `<h2>` header for accessibility
  - [x] 16.3 Display current tier and expiry date at top of Підписка section
  - [x] 16.4 Preserve all existing functionality

- [x] 17. Haptic feedback on Android
  - [x] 17.1 Create `src/lib/haptics.ts` with `hapticImpact()` and `hapticNotification()` using `Telegram.WebApp.HapticFeedback` API with silent fallback
  - [x] 17.2 Replace all `navigator.vibrate()` calls across the mini app with `hapticImpact()`
  - [x] 17.3 Use `hapticNotification('warning')` on destructive action confirmations (delete)

---

## P2 — Growth & Monetization

- [x] 18. Free trial for Nova
  - [x] 18.1 Create migration to add `trial_used BOOLEAN NOT NULL DEFAULT false` to `profiles`
  - [x] 18.2 Create `POST /api/profile/trial` endpoint — check `trial_used = false` and no prior paid subscription, set `subscription_tier='stars_basic'`, `subscription_ends_at = now()+3days`, `trial_used = true`
  - [x] 18.3 Show trial offer button in `PaywallModal` when `!trialUsed`
  - [x] 18.4 Show trial badge in feed header when user is on active trial

- [x] 19. Referral system
  - [x] 19.1 Create migration for `referrals` table with `(referrer_id, referred_id, code UNIQUE, reward_granted)`
  - [x] 19.2 Add `handleInvite` command in `src/lib/bot/commands.ts` — generate/fetch referral code, reply with deep link
  - [x] 19.3 Register `/invite` command in webhook route
  - [x] 19.4 Update `/start` handler to detect `ref_<code>` param, record `referred_id` in referrals table
  - [x] 19.5 After referred user activates paid subscription, grant referrer 30 days Nova and set `reward_granted = true`
  - [x] 19.6 Notify referrer via bot message when reward is granted

- [x] 20. Share retrospective
  - [x] 20.1 Add `html-to-image` dependency (`npm install html-to-image`)
  - [x] 20.2 Add Share button to report detail view in `src/app/miniapp/reports/page.tsx`
  - [x] 20.3 Generate image card from a hidden DOM node (report highlights + Memo logo + CTA)
  - [x] 20.4 Share via `Telegram.WebApp.shareToStory` if available, else fallback to `t.me/share/url`
  - [x] 20.5 Show error message and text-only fallback if image generation fails

- [x] 21. Revised tier feature matrix
  - [x] 21.1 Change `voice_logging` from `"stars_basic"` to `"free"` in `FEATURE_TIERS` in `src/lib/stars/paywall.ts`
  - [x] 21.2 Update `TIER_INFO.free.features` to mark `Голосові повідомлення` as `included: true`
  - [x] 21.3 Remove paywall check for `voice_logging` in the voice message handler (`src/lib/bot/handlers/voice.ts`)

- [x] 22. Date range restriction for graph and reports
  - [x] 22.1 Apply `historyDays` cutoff filter to `GET /api/graph` — filter nodes by `created_at >= cutoff`
  - [x] 22.2 Apply `historyDays` cutoff filter to `GET /api/reports`
  - [x] 22.3 Disable date range picker presets beyond `historyDays` in the dashboard and graph pages for free-tier users

- [x] 23. Analytics and observability
  - [x] 23.1 Install `@sentry/nextjs` and configure `sentry.server.config.ts` and `sentry.client.config.ts`
  - [x] 23.2 Configure `beforeSend` to strip `content`, `bot_reply`, and `telegram_id` from Sentry events
  - [x] 23.3 Install `posthog-js` and initialize in the mini app layout
  - [x] 23.4 Emit `entry_saved`, `report_generated`, `paywall_shown`, `subscription_started` events with anonymized user ID
  - [x] 23.5 Ensure Sentry and PostHog failures do not throw or break app flow

---

## P3 — Quality & Polish

- [x] 24. JSDoc for complex functions
  - [x] 24.1 Add JSDoc to `classify()` in `src/lib/classifier.ts` — describe input, output (`ClassificationResult`), Gemini model used, and two-pass approach
  - [x] 24.2 Add JSDoc to `embedEntry()` in `src/lib/embedding.ts` — describe retry logic, DB side effects, failure conditions
  - [x] 24.3 Add JSDoc to `clusterEntries()` in `src/lib/processing/loop.ts` — describe union-find algorithm, similarity threshold (0.75), output shape
  - [x] 24.4 Add JSDoc to `verifyInitData()` in `src/app/api/auth/telegram/route.ts` — describe HMAC-SHA256 process, 24-hour expiry check, error conditions
  - [x] 24.5 Add JSDoc to `resolveOrCreateProfile()` in `src/lib/profile.ts` — describe upsert logic, synthetic auth account creation, `ProfileError`

- [x] 25. Comprehensive test suite
  - [x] 25.1 Create `src/__tests__/auth.test.ts` — unit tests for `verifyInitData()`: valid within 24h, expired, tampered hash, missing fields
  - [x] 25.2 Create `src/__tests__/classifier.test.ts` — unit tests for `classify()`: diary entry, question, action, smalltalk, malformed Gemini response fallback
  - [x] 25.3 Create `src/__tests__/paywall.test.ts` — unit tests for `calcPrice()`: all tier × billing period combinations, discount correctness, integer rounding
  - [x] 25.4 Create `src/__tests__/clustering.test.ts` — property-based tests for `clusterEntries()` using fast-check: idempotency and cluster count bound
  - [x] 25.5 Create `src/__tests__/api-auth.test.ts` — integration tests for `POST /api/auth/telegram`: valid initData returns JWT, invalid returns 401
  - [x] 25.6 Create `src/__tests__/api-entries.test.ts` — integration tests for `POST /api/entries`: valid creates entry, tier limit exceeded returns 402, unauthenticated returns 401
  - [x] 25.7 Ensure all tests pass with `npm test` using mocked Gemini and Supabase dependencies
