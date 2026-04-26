# Requirements Document

## Introduction

This document captures all launch-readiness improvements for **Memo** — a Telegram mini app and bot for AI-powered personal journaling. The improvements are drawn from a multi-role team audit (engineering, QA, UX, product, growth) and cover 28 distinct items across four priority tiers:

- **P0 — Critical**: Security gaps and legal compliance issues that must be resolved before any public launch.
- **P1 — High Priority**: Core UX and retention features that directly affect user satisfaction and churn.
- **P2 — Growth & Monetization**: Features that drive acquisition, conversion, and revenue.
- **P3 — Quality & Polish**: Code quality, test coverage, and UX refinements that reduce technical debt and improve long-term maintainability.

The system under specification is the full Memo stack: the Next.js API layer (Vercel Edge + Node.js), the grammY Telegram bot, the Supabase PostgreSQL database, and the React mini app.

---

## Glossary

- **API**: The Next.js route handlers under `src/app/api/`.
- **Bot**: The grammY-based Telegram bot handler at `/api/telegram/webhook`.
- **Cron**: Vercel scheduled jobs at `/api/cron/*`.
- **Entry**: A single diary record stored in the `entries` table.
- **Embedding**: A 768-dimensional vector representation of an entry's content, stored in `entries.embedding`.
- **Embedding_Status**: The `embedding_status` column on `entries`; values are `pending`, `done`, or `failed`.
- **Feed**: The mini app's main tab showing the scrollable list of entries.
- **Free_Tier**: The `free` subscription tier (Memo Spark), limited to 100 entries and 30 days of visible history. Includes text entries, voice messages, 3 AI widgets, 5 retrospectives/month, PIN protection, and encryption.
- **Nova_Tier**: The `stars_basic` subscription tier (Memo Nova, 250 ⭐/month), limited to 2,000 entries and 365 days of history. Adds AI retrospectives, AI recommendations, goal tracking, knowledge graph, and 15 AI widgets.
- **Supernova_Tier**: The `stars_pro` subscription tier (Memo Supernova, 500 ⭐/month), with unlimited entries, unlimited history, data export, and priority processing.
- **Graph**: The D3 force-directed knowledge graph page at `/miniapp/graph`.
- **JWT**: The Supabase JSON Web Token used to authenticate mini app API calls.
- **Mini_App**: The Telegram Mini App served at `/miniapp/*`.
- **Profile**: A row in the `profiles` table representing one Telegram user.
- **Rate_Limiter**: The sliding-window rate limiting module at `src/lib/rate-limit.ts`.
- **RLS**: Supabase Row-Level Security policies that isolate data per user.
- **Simulation**: The D3 force simulation instance used to render the Graph.
- **Tier**: A subscription level — `free`, `stars_basic` (Nova), or `stars_pro` (Supernova).
- **Webhook**: The Telegram Bot API webhook endpoint at `/api/telegram/webhook`.
- **Webhook_Secret**: The `X-Telegram-Bot-Api-Secret-Token` header value used to authenticate Telegram updates.

---

## Requirements

---

### Requirement 1: Rate Limiting on All API Routes

**User Story:** As the system operator, I want all API routes and the Telegram webhook to enforce rate limits, so that malicious actors cannot cause Gemini API cost explosions or denial-of-service conditions.

#### Acceptance Criteria

1. WHEN a client sends more than 60 requests per minute to `/api/telegram/webhook` from a single IP address, THE Rate_Limiter SHALL reject subsequent requests with HTTP 429 and a `Retry-After` header.
2. WHEN a client sends more than 30 write requests per minute to `POST /api/entries` using the same JWT, THE Rate_Limiter SHALL reject subsequent requests with HTTP 429 and a `Retry-After` header.
3. WHEN a client sends more than 120 read requests per minute to `GET /api/entries` using the same JWT, THE Rate_Limiter SHALL reject subsequent requests with HTTP 429 and a `Retry-After` header.
4. WHEN a client sends more than 30 requests per minute to `POST /api/auth/telegram` from a single IP address, THE Rate_Limiter SHALL reject subsequent requests with HTTP 429 and a `Retry-After` header.
5. THE Rate_Limiter SHALL include a `Retry-After` header in all 429 responses indicating the number of seconds until the window resets.
6. WHEN the rate limit window expires, THE Rate_Limiter SHALL reset the counter and allow new requests from that client.

---

### Requirement 2: Webhook Secret Verification

**User Story:** As the system operator, I want the Telegram webhook to verify the `X-Telegram-Bot-Api-Secret-Token` header, so that only genuine Telegram updates are processed and fake updates from unauthorized actors are rejected.

#### Acceptance Criteria

1. WHEN `TELEGRAM_WEBHOOK_SECRET` is set in the environment and an incoming POST to `/api/telegram/webhook` does not include a matching `X-Telegram-Bot-Api-Secret-Token` header, THE Bot SHALL return HTTP 403 and log a warning.
2. WHEN `TELEGRAM_WEBHOOK_SECRET` is set and the incoming `X-Telegram-Bot-Api-Secret-Token` header matches the configured secret, THE Bot SHALL process the update normally.
3. WHERE `TELEGRAM_WEBHOOK_SECRET` is not set in the environment, THE Bot SHALL process all incoming updates without header verification (backward-compatible fallback for local development).
4. THE Bot SHALL perform the secret comparison using a constant-time string comparison to prevent timing attacks.

---

### Requirement 3: GDPR Data Export

**User Story:** As any Memo user, I want to export all my personal data as CSV files, so that I can exercise my right to data portability under GDPR Article 20 regardless of my subscription tier.

#### Acceptance Criteria

1. WHEN any authenticated user sends `GET /api/profile/export`, THE API SHALL return a ZIP archive containing CSV files for: entries (decrypted), categories, reports, subscriptions, and transaction history.
2. THE ZIP archive SHALL be named `memo-export-<YYYY-MM-DD>.zip` and each CSV file SHALL include a header row with column names.
3. THE API SHALL set the `Content-Disposition` header to `attachment; filename="memo-export-<YYYY-MM-DD>.zip"`.
4. WHEN a user sends more than 5 export requests per hour, THE API SHALL reject subsequent requests with HTTP 429.
5. WHEN entry content cannot be decrypted (e.g., legacy plaintext entries), THE API SHALL include the raw stored value in the CSV rather than failing the entire export.
6. THE entries CSV SHALL include columns: `id`, `created_at`, `content`, `category`, `metric_value`, `metric_unit`.
7. WHEN the user's JWT is invalid or missing, THE API SHALL return HTTP 401.

---

### Requirement 4: Embedding Recomputation on Entry Edit

**User Story:** As a user who edits a diary entry, I want the entry's semantic embedding to be updated, so that semantic search and the knowledge graph remain accurate after edits.

#### Acceptance Criteria

1. WHEN a `PATCH /api/entries` request changes the `content` field of an entry and the new content differs from the existing content, THE API SHALL set `embedding_status = 'pending'` on that entry.
2. WHEN `embedding_status` is set to `pending` after an edit, THE Cron SHALL pick up the entry on its next run and regenerate the embedding.
3. WHEN the content submitted in a PATCH request is identical to the existing decrypted content, THE API SHALL NOT reset `embedding_status`.
4. WHEN only `category` or `metric_override` is changed (not `content`), THE API SHALL NOT reset `embedding_status`.

---

### Requirement 5: Cursor-Based Pagination

**User Story:** As a user with more than 100 diary entries, I want to scroll through my entire history in the feed, so that I can access entries older than the most recent 100.

#### Acceptance Criteria

1. WHEN `GET /api/entries` is called with a `before` query parameter containing a valid entry ID, THE API SHALL return entries created strictly before that entry, ordered by `created_at` descending.
2. WHEN `GET /api/entries` is called without a `before` parameter, THE API SHALL return the most recent entries up to the specified `limit`.
3. THE API SHALL accept a `limit` query parameter with a maximum value of 50 entries per page.
4. THE API SHALL include a `has_more` boolean in the response indicating whether additional entries exist beyond the current page.
5. WHEN the Feed reaches the bottom of the loaded entries and `has_more` is true, THE Mini_App SHALL automatically fetch the next page and append the entries to the list (infinite scroll).
6. WHILE the Feed is fetching the next page, THE Mini_App SHALL display a loading indicator at the bottom of the list.
7. IF the next-page fetch fails, THE Mini_App SHALL display an error message with a retry button.

---

### Requirement 6: Embedding Retry for Failed Entries

**User Story:** As the system operator, I want failed embeddings to be automatically retried, so that entries with `embedding_status = 'failed'` do not permanently degrade semantic search quality.

#### Acceptance Criteria

1. WHEN the Cron runs, THE Cron SHALL query for all entries where `embedding_status = 'failed'` and `embedding_attempts < 3`.
2. FOR EACH such entry, THE Cron SHALL attempt to regenerate the embedding using exponential backoff delays of 1 s, 2 s, and 4 s between attempts.
3. WHEN an embedding is successfully regenerated, THE Cron SHALL set `embedding_status = 'done'` and reset `embedding_attempts` to 0.
4. WHEN all retry attempts for an entry are exhausted, THE Cron SHALL set `embedding_attempts = 3` and leave `embedding_status = 'failed'` so the entry is not retried again.
5. THE Cron SHALL process failed-embedding retries as a distinct step from new-entry embedding, so that retries do not block the processing of new entries.

---

### Requirement 7: Free Tier Soft Limit Warning

**User Story:** As a free-tier user approaching my entry limit, I want to see a progressive warning before hitting the hard limit, so that I am not surprised by an abrupt paywall and have time to consider upgrading.

#### Acceptance Criteria

1. WHEN a free-tier user has used more than 80% of their entry limit (i.e., more than 80 of 100 entries), THE Mini_App SHALL display a `UsageCounterChip` in the Feed header showing the current count and limit.
2. WHEN a free-tier user has used more than 90% of their entry limit (i.e., more than 90 of 100 entries), THE Mini_App SHALL display a dismissible warning banner above the entry list explaining that the limit is approaching and offering an upgrade CTA.
3. WHEN a free-tier user reaches exactly 100% of their entry limit, THE Mini_App SHALL display the paywall modal.
4. WHEN a paid-tier user views the Feed, THE Mini_App SHALL NOT display the usage warning chip or banner.
5. WHEN the user dismisses the 90% warning banner, THE Mini_App SHALL NOT show it again during the same session.

---

### Requirement 8: Graph Empty State

**User Story:** As a new user who has not yet sent any messages, I want to see a helpful empty state on the Graph page instead of an infinite spinner, so that I understand why the graph is empty and know what to do next.

#### Acceptance Criteria

1. WHEN the Graph page loads and the API returns zero nodes, THE Mini_App SHALL display an empty state component instead of the D3 canvas.
2. THE empty state SHALL include an explanatory message indicating that the graph will populate after the user sends their first diary entries.
3. THE empty state SHALL include a call-to-action that deep-links the user to the Telegram bot to send their first message.
4. WHEN the Graph page is loading data, THE Mini_App SHALL display a skeleton or spinner for a maximum of 10 seconds before showing an error state if no response is received.
5. IF the graph API returns an error, THE Mini_App SHALL display an error state with a retry button rather than an infinite spinner.

---

### Requirement 9: D3 Simulation Cleanup

**User Story:** As a user who navigates between tabs, I want the knowledge graph's D3 simulation to be properly stopped when I leave the Graph page, so that memory leaks do not degrade app performance over time.

#### Acceptance Criteria

1. WHEN the Graph page component unmounts, THE Mini_App SHALL call `simulation.stop()` on the active D3 force simulation.
2. WHEN the Graph page component unmounts, THE Mini_App SHALL remove all D3 event listeners attached to the SVG element.
3. WHEN the user navigates back to the Graph page after previously visiting it, THE Mini_App SHALL create a new simulation instance without interference from the previous one.

---

### Requirement 10: Reminders Feature

**User Story:** As a user, I want to set reminders via the bot, so that I receive a Telegram message at a scheduled time prompting me to log a specific entry.

#### Acceptance Criteria

1. WHEN a user sends `/remind <text> at <time>` to the Bot, THE Bot SHALL parse the reminder text and scheduled time, store a row in the `reminders` table, and confirm the reminder to the user.
2. WHEN the Cron runs and finds a reminder whose `scheduled_at` time has passed and `status = 'pending'`, THE Cron SHALL send the reminder text to the user via the Bot and set `status = 'sent'`.
3. IF the Bot cannot parse a valid time from the `/remind` command, THE Bot SHALL reply with an error message explaining the expected format (e.g., `/remind drink water at 15:00`).
4. WHEN a reminder is successfully created, THE Bot SHALL confirm the scheduled time in the user's local timezone if available, or in UTC otherwise.
5. THE Cron SHALL process reminders with `ON CONFLICT DO NOTHING` semantics so that double-firing does not send duplicate messages.

---

### Requirement 11: Streak Notifications

**User Story:** As a user who wants to maintain a journaling habit, I want to receive a gentle reminder from the bot when I haven't logged anything today, so that I am prompted to keep my streak alive.

#### Acceptance Criteria

1. WHEN the daily Cron runs and a user has not created any entries in the past 24 hours, THE Cron SHALL send a streak reminder message to that user via the Bot.
2. WHEN a user has opted out of streak notifications (via a settings flag), THE Cron SHALL NOT send a streak reminder to that user.
3. THE streak reminder message SHALL be friendly and non-intrusive, referencing the user's current streak count if available.
4. THE Cron SHALL process streak notifications with idempotency so that double-firing does not send duplicate messages to the same user on the same day.
5. WHEN a user has no entries at all (new user), THE Cron SHALL NOT send a streak notification.

---

### Requirement 12: Free Weekly Summary

**User Story:** As a free-tier user, I want to receive an automatically generated weekly summary every Monday, so that I can experience the value of AI retrospectives before deciding to upgrade.

#### Acceptance Criteria

1. WHEN the weekly Cron runs on Monday, THE Cron SHALL generate a simplified summary for every user (free and paid) who has created at least 3 entries in the past 7 days.
2. THE Cron SHALL deliver the summary as a Telegram bot message containing key highlights from the week's entries.
3. THE summary for free-tier users SHALL be a simplified version (highlights only) while paid-tier users receive the full retrospective format.
4. WHEN a user has opted out of weekly summaries (via a settings flag), THE Cron SHALL NOT send a summary to that user.
5. THE Cron SHALL process weekly summaries with idempotency so that double-firing does not send duplicate summaries.

---

### Requirement 13: Free Trial for Nova

**User Story:** As a prospective paying user, I want to try the Nova (stars_basic) tier for 3 days before committing to a subscription, so that I can experience premium features before paying.

#### Acceptance Criteria

1. WHEN a new user completes onboarding or encounters the paywall for the first time and has never had a paid subscription, THE Mini_App SHALL offer a 3-day free trial of the Nova tier.
2. WHEN a user activates the free trial, THE API SHALL set `subscription_tier = 'stars_basic'` and `subscription_ends_at = now() + 3 days` on the user's profile without requiring a Stars payment.
3. WHEN the trial period expires, THE API SHALL automatically downgrade the user to the `free` tier.
4. THE free trial SHALL be available only once per user account (identified by `telegram_id`).
5. WHEN a user is on a free trial, THE Mini_App SHALL display a trial badge indicating the number of days remaining.

---

### Requirement 14: Referral System

**User Story:** As an existing user, I want to invite friends to Memo and receive a reward when they subscribe, so that I am incentivized to spread the word organically.

#### Acceptance Criteria

1. WHEN a user sends `/invite` to the Bot, THE Bot SHALL generate a unique referral link for that user and reply with the link and instructions.
2. WHEN a new user registers via a referral link and subsequently activates a paid subscription, THE API SHALL grant the referrer 30 days of free Nova access.
3. THE referral reward SHALL be applied only once per referred user (i.e., a referrer cannot earn multiple months from the same referred user).
4. WHEN a referral reward is granted, THE Bot SHALL notify the referrer with a confirmation message.
5. THE API SHALL store referral relationships in a dedicated table to enable auditing and prevent duplicate rewards.

---

### Requirement 15: Share Retrospective

**User Story:** As a user who has generated a retrospective report, I want to share it as an image card to my Telegram contacts, so that I can showcase my journaling insights and organically promote Memo.

#### Acceptance Criteria

1. WHEN a user taps the "Share" button on a retrospective report in the Mini_App, THE Mini_App SHALL generate a visually styled image card summarizing the report's key sections.
2. THE Mini_App SHALL use the Telegram Web App `shareToStory` or `openTelegramLink` API to initiate sharing the image card within Telegram.
3. THE generated image card SHALL include the Memo logo and a brief call-to-action for recipients to try the app.
4. WHEN image generation fails, THE Mini_App SHALL display an error message and offer a fallback text-only share option.

---

### Requirement 16: Free Tier Soft Limit Warning Thresholds

**User Story:** As a free-tier user approaching my entry limit, I want to see progressive warnings at meaningful thresholds before hitting the hard paywall, so that I have time to consider upgrading without being surprised.

#### Acceptance Criteria

1. THE Free_Tier entry limit SHALL remain at 100 entries as defined in `TIER_INFO.free.limits.entries`.
2. WHEN a free-tier user has more than 80 entries (>80% of 100), THE Mini_App SHALL display the soft limit warning chip per Requirement 7, criterion 1.
3. WHEN a free-tier user has more than 90 entries (>90% of 100), THE Mini_App SHALL display the dismissible warning banner per Requirement 7, criterion 2.
4. WHEN a free-tier user reaches exactly 100 entries, THE Mini_App SHALL display the paywall modal and block further entry creation per Requirement 7, criterion 3.

---

### Requirement 17: Analytics and Observability

**User Story:** As the product team, I want error tracking and product analytics instrumented in the app, so that we can detect regressions quickly and understand user behavior to inform product decisions.

#### Acceptance Criteria

1. WHEN an unhandled exception occurs in any API route or bot handler, THE API SHALL report the error to Sentry including the error message, stack trace, and request context (excluding PII).
2. WHEN a user performs a key action (entry saved, report generated, paywall shown, subscription started), THE Mini_App SHALL emit a corresponding analytics event to the configured analytics provider (Posthog or Mixpanel).
3. THE analytics events SHALL NOT include entry content or any personally identifiable information beyond an anonymized user identifier.
4. WHEN Sentry or the analytics provider is unavailable, THE API and Mini_App SHALL continue to function normally without throwing errors.
5. THE Sentry integration SHALL capture source maps so that minified stack traces are resolved to original TypeScript source lines.

---

### Requirement 18: Comprehensive Test Suite

**User Story:** As a developer, I want comprehensive automated tests for all critical code paths, so that regressions in security, payments, and AI pipeline logic are caught before deployment.

#### Acceptance Criteria

1. THE test suite SHALL include unit tests for `verifyInitData()` covering: valid initData within 24 hours, valid initData older than 24 hours (should fail), tampered hash (should fail), and missing fields (should fail).
2. THE test suite SHALL include unit tests for `classify()` covering: diary entry classification, question classification, action classification, smalltalk classification, and malformed Gemini response (fallback behavior).
3. THE test suite SHALL include unit tests for `calcPrice()` covering all combinations of tier and billing period, verifying that discounts are applied correctly and results are rounded integers.
4. THE test suite SHALL include property-based tests for `clusterEntries()` using fast-check, verifying that: the union-find algorithm is idempotent (applying clustering twice produces the same result), and the number of clusters never exceeds the number of input entries.
5. THE test suite SHALL include integration tests for `POST /api/auth/telegram` verifying that valid initData returns a JWT and invalid initData returns HTTP 401.
6. THE test suite SHALL include integration tests for `POST /api/entries` verifying that: a valid request creates an entry, a request exceeding the tier limit returns HTTP 402, and an unauthenticated request returns HTTP 401.
7. WHEN the test suite is run with `npm test`, ALL tests SHALL pass without requiring external network calls (external dependencies SHALL be mocked).

---

### Requirement 19: Graph Focus Mode

**User Story:** As a user with a large knowledge graph, I want to tap a node and zoom into its immediate neighborhood, so that I can explore connections without being overwhelmed by the full graph on a small screen.

#### Acceptance Criteria

1. WHEN a user taps a node in the Graph, THE Mini_App SHALL zoom the D3 viewport to show only the selected node and its directly connected neighbors (1-hop neighborhood).
2. WHEN focus mode is active, THE Mini_App SHALL dim all nodes and edges that are not part of the selected node's neighborhood.
3. WHEN focus mode is active, THE Mini_App SHALL display a "Show all" button that returns the graph to the full view.
4. WHEN the user taps the "Show all" button or taps on an empty area of the graph, THE Mini_App SHALL exit focus mode and restore the full graph view with a smooth zoom transition.
5. WHEN the selected node has no connections, THE Mini_App SHALL display only that node in focus mode with a message indicating it has no linked entries.

---

### Requirement 20: Per-User Encryption Salt

**User Story:** As a security-conscious user, I want my encryption key to be derived from a unique random salt stored on my account, so that my data cannot be decrypted even if my Telegram ID is known.

#### Acceptance Criteria

1. WHEN a new user account is created, THE API SHALL generate a cryptographically random 32-byte salt and store it in `profiles.encryption_salt`.
2. THE encryption key derivation function SHALL use `HKDF(telegram_id + salt)` instead of `HKDF(telegram_id)` alone.
3. WHERE `profiles.encryption_salt` is NULL (existing accounts created before this change), THE API SHALL fall back to the legacy key derivation using `telegram_id` only, ensuring backward compatibility.
4. THE migration SHALL add the `encryption_salt` column to the `profiles` table with a nullable constraint to preserve existing rows.
5. WHEN a user's encryption salt is set, THE API SHALL use the salted key for all new encryption and decryption operations on that user's entries.

---

### Requirement 21: Settings Page Restructure

**User Story:** As a user managing my account, I want the settings page to be organized into clearly labeled sections, so that I can quickly find the setting I am looking for without scrolling through an undifferentiated list.

#### Acceptance Criteria

1. THE Settings page SHALL organize its content into distinct visual sections with section headers: "Subscription", "Privacy & Security", "Notifications", "Categories", "Support", and "About".
2. WHEN a user taps the "Subscription" section, THE Mini_App SHALL navigate to the subscriptions page or display the current plan inline.
3. THE Settings page SHALL display the current subscription tier and expiry date prominently at the top of the "Subscription" section.
4. WHEN a user taps a section header, THE Mini_App SHALL smoothly scroll to that section.
5. THE Settings page SHALL maintain all existing functionality while improving visual hierarchy.

---

### Requirement 22: Normalize `bot_msg_id` Storage

**User Story:** As a developer, I want `bot_msg_id` values in entry metadata to be stored consistently as strings, so that thread resolution queries do not need to handle both number and string types.

#### Acceptance Criteria

1. THE database migration SHALL convert all existing `metadata->>'bot_msg_id'` values that are stored as JSON numbers to JSON strings.
2. WHEN the Bot stores a new `bot_msg_id` in entry metadata, THE Bot SHALL always store it as a string.
3. WHEN the thread resolution query looks up an entry by `bot_msg_id`, THE query SHALL use a single string comparison instead of the current dual-type fallback.
4. THE migration SHALL be idempotent so that running it multiple times does not corrupt data.

---

### Requirement 23: Cron Job Idempotency

**User Story:** As the system operator, I want all cron job database writes to be idempotent, so that Vercel's occasional double-firing of cron jobs does not create duplicate streak entries or other data corruption.

#### Acceptance Criteria

1. WHEN `autoIncrementStreaks()` inserts a streak entry, THE SQL statement SHALL use `ON CONFLICT DO NOTHING` on a unique constraint covering `(user_id, date)`.
2. WHEN the weekly summary cron inserts a report record, THE SQL statement SHALL use `ON CONFLICT DO NOTHING` on a unique constraint covering `(user_id, period_from, period_to)`.
3. WHEN the reminder delivery cron updates a reminder's status to `sent`, THE SQL statement SHALL use a conditional update (`WHERE status = 'pending'`) to prevent re-sending.
4. WHEN any cron job step is run twice within the same UTC day, THE system state SHALL be identical to running it once.

---

### Requirement 24: Haptic Feedback on Android

**User Story:** As an Android user, I want haptic feedback when I perform actions in the mini app, so that the app feels native and responsive on my device.

#### Acceptance Criteria

1. WHEN a user performs a tap action that currently triggers haptic feedback on iOS, THE Mini_App SHALL use `window.Telegram.WebApp.HapticFeedback.impactOccurred('medium')` instead of `navigator.vibrate()`.
2. WHEN `window.Telegram.WebApp.HapticFeedback` is not available (e.g., in a desktop browser), THE Mini_App SHALL silently skip haptic feedback without throwing an error.
3. THE haptics module SHALL be updated to use the Telegram HapticFeedback API as the primary implementation, with `navigator.vibrate()` removed or used only as a last-resort fallback.
4. WHEN a destructive action (delete) is confirmed, THE Mini_App SHALL trigger a `notificationOccurred('warning')` haptic pattern.

---

### Requirement 25: JSDoc for Complex Functions

**User Story:** As a developer onboarding to the Memo codebase, I want the most complex functions to have JSDoc comments, so that I can understand their purpose, parameters, and behavior without reading the full implementation.

#### Acceptance Criteria

1. THE `classify()` function in `src/lib/classifier.ts` SHALL have a JSDoc comment describing its input (raw message text), output (ClassificationResult), and the Gemini model it uses.
2. THE `embedEntry()` function in `src/lib/embedding.ts` SHALL have a JSDoc comment describing its retry logic, the side effects on the `entries` table, and the conditions under which it marks an entry as `failed`.
3. THE `clusterEntries()` function SHALL have a JSDoc comment describing the union-find algorithm, the similarity threshold used, and the shape of its output.
4. THE `verifyInitData()` function in the auth module SHALL have a JSDoc comment describing the HMAC-SHA256 verification process, the 24-hour expiry check, and the error conditions it throws.
5. THE `resolveOrCreateProfile()` function in `src/lib/profile.ts` SHALL have a JSDoc comment describing the upsert logic, the synthetic Supabase Auth account creation, and the `ProfileError` it may throw.

---

### Requirement 26: Revised Tier Feature Matrix

**User Story:** As a product stakeholder, I want the subscription tier feature matrix to be precisely defined in code and documentation, so that every part of the system enforces the same limits and the paywall copy is accurate.

#### Acceptance Criteria

1. THE `FEATURE_TIERS` map in `src/lib/stars/paywall.ts` SHALL set `voice_logging` to `"free"`, making voice messages available to all users without a paywall.
2. THE `TIER_INFO.free` configuration SHALL define the following limits: `entries: 100`, `ai_widgets: 3`, `reports: 5`, `historyDays: 30`; and SHALL mark `voice_logging` as included in the free tier feature list.
3. THE `TIER_INFO.stars_basic` (Memo Nova, 250 ⭐/month) configuration SHALL define the following limits: `entries: 2000`, `ai_widgets: 15`, `reports: 50`, `historyDays: 365`; and SHALL include AI retrospectives, AI recommendations, goal tracking, and knowledge graph access.
4. THE `TIER_INFO.stars_pro` (Memo Supernova, 500 ⭐/month) configuration SHALL define unlimited entries, unlimited AI widgets, unlimited reports, and `historyDays: Infinity`; and SHALL additionally include data export and priority processing.
5. WHEN a free-tier user attempts to access `ai_reports`, `ai_recommendations`, `goal_tracking`, `full_history`, `graph_full`, or `priority_processing`, THE API SHALL return HTTP 402 with the required tier indicated in the response body.
6. WHEN a free-tier user attempts to use `voice_logging`, THE API SHALL process the request normally without a paywall check.
7. THE paywall modal copy for `voice_logging` SHALL be removed or updated to reflect that voice messages are now a free feature.

---

### Requirement 27: Date Range Restriction for Free Tier

**User Story:** As a product stakeholder, I want free-tier users to be limited to a 30-day data window across all pages, so that access to historical data beyond one month is a meaningful incentive to upgrade to Nova.

#### Acceptance Criteria

1. WHILE a user's effective tier is `free`, THE Feed SHALL display only entries with `created_at >= now() - 30 days`, enforced server-side in `GET /api/entries`.
2. WHILE a user's effective tier is `free`, THE Dashboard date range picker SHALL restrict selection to a maximum window of 30 days and SHALL NOT offer presets beyond "last month".
3. WHILE a user's effective tier is `free`, THE Graph page SHALL render only nodes derived from entries with `created_at >= now() - 30 days`, enforced server-side in `GET /api/graph`.
4. WHILE a user's effective tier is `free`, THE Reports page SHALL only allow generating reports for periods entirely within the last 30 days, enforced server-side in `GET /api/reports`.
5. WHEN a free-tier user attempts to access data older than 30 days via any UI control, THE Mini_App SHALL display a paywall prompt explaining the 30-day history limitation and offering an upgrade to Nova.
6. WHILE a user's effective tier is `stars_basic`, THE system SHALL apply a `historyDays: 365` window (1 year) across all pages.
7. WHILE a user's effective tier is `stars_pro`, THE system SHALL apply no date restriction (`historyDays: Infinity`) across all pages.

---

### Requirement 28: Data Retention for Free Tier

**User Story:** As a user who upgrades from free to Nova, I want my full entry history to become immediately accessible, so that I do not lose data I created before upgrading.

#### Acceptance Criteria

1. THE database SHALL retain all entries for free-tier users regardless of age; entries older than 30 days SHALL NOT be deleted from the `entries` table.
2. WHEN `GET /api/entries` is called for a free-tier user, THE API SHALL filter the response to exclude entries with `created_at < now() - 30 days`, so that old entries are not returned but remain stored.
3. WHEN `GET /api/graph` is called for a free-tier user, THE API SHALL filter nodes and edges to only include entries with `created_at >= now() - 30 days`.
4. WHEN `GET /api/reports` is called for a free-tier user, THE API SHALL restrict the queryable date range to the last 30 days.
5. WHEN `GET /api/dashboard` is called for a free-tier user, THE API SHALL restrict aggregation to entries within the last 30 days.
6. WHEN a user's subscription tier is upgraded from `free` to `stars_basic`, THE API SHALL immediately begin returning entries up to 2,000 records and up to 365 days of history on all subsequent requests, without any additional migration step.
7. THE server-side date filter SHALL be applied after authentication and tier resolution, so that a user cannot bypass it by manipulating query parameters.
