# Requirements Document

## Introduction

The `analytics-admin` feature adds three capabilities to the Memo Telegram mini app:

1. **PostHog event tracking** — re-integrates PostHog analytics into the mini app frontend to track key user interactions (paywall views, subscriptions, report generation, entry saves, and more). User identity is anonymized via the JWT `sub` UUID; raw Telegram IDs are never sent. All tracking calls are silent on failure.

2. **Microsoft Clarity** — adds Clarity session recording and heatmap collection to the mini app layout via a script tag driven by an environment variable. The integration is a no-op when the env var is absent.

3. **Admin panel at `/admin`** — a full-featured internal dashboard protected by Telegram `initData` HMAC-SHA256 verification plus an `ADMIN_TELEGRAM_IDS` whitelist. The panel provides overview stats, a paginated user list with detail/plan-management views, category analytics, subscription/revenue data, and system health monitoring. It is backed by a set of admin-only API routes that use the Supabase service role key and enforce admin authentication on every request.

---

## Glossary

- **Admin_Panel**: The Next.js route group at `src/app/admin/` providing the internal dashboard UI.
- **Admin_API**: The set of Next.js API routes under `/api/admin/` that serve data to the Admin_Panel.
- **Admin_Auth_Middleware**: The server-side logic that verifies Telegram `initData` and checks the `ADMIN_TELEGRAM_IDS` whitelist before allowing access to any admin resource.
- **PostHog_Client**: The PostHog JavaScript SDK instance initialized in the mini app layout.
- **Clarity_Script**: The Microsoft Clarity script tag injected into the mini app layout.
- **InitData**: The raw Telegram Mini App `initData` query string used for authentication.
- **HMAC_Verifier**: The existing `verifyInitData` function in `src/app/api/auth/telegram/route.ts` that performs HMAC-SHA256 verification of `initData`.
- **Service_Role_Client**: A Supabase client initialized with `SUPABASE_SERVICE_ROLE_KEY`, bypassing RLS, used exclusively in server-side admin routes.
- **Anonymized_UUID**: The JWT `sub` field (a UUID) derived from the Supabase auth user, used as the PostHog distinct ID instead of the raw Telegram ID.
- **Subscription_Tier**: One of `free`, `stars_basic` (Nova), or `stars_pro` (Supernova) as defined in `src/lib/stars/paywall.ts`.
- **DAU**: Distinct active users per day, measured by distinct `user_id` values in the `entries` table for a given calendar day.
- **WAU**: Distinct active users per week.
- **Embedding_Status**: The `embedding_status` column on the `entries` table; one of `pending`, `done`, or `failed`.

---

## Requirements

### Requirement 1: PostHog Analytics Integration

**User Story:** As a product owner, I want PostHog event tracking in the mini app, so that I can understand how users interact with key features and optimize conversion funnels.

#### Acceptance Criteria

1. WHEN the mini app layout mounts and `NEXT_PUBLIC_POSTHOG_KEY` is set, THE PostHog_Client SHALL initialize with the project key and host from `NEXT_PUBLIC_POSTHOG_HOST` (defaulting to `https://app.posthog.com`).
2. WHEN the PostHog_Client initializes, THE PostHog_Client SHALL identify the current user using the Anonymized_UUID obtained from the Supabase JWT `sub` field.
3. WHEN the paywall modal is displayed to the user, THE PostHog_Client SHALL capture a `paywall_shown` event with properties `{ feature: string, required_tier: string }`.
4. WHEN a user completes a subscription purchase, THE PostHog_Client SHALL capture a `subscription_started` event with properties `{ tier: string, billing_period: string }`.
5. WHEN a user successfully generates a report, THE PostHog_Client SHALL capture a `report_generated` event with property `{ period_type: string }`.
6. WHEN a user saves a journal entry, THE PostHog_Client SHALL capture an `entry_saved` event with property `{ category: string }`.
7. WHEN the trial offer UI is shown to the user, THE PostHog_Client SHALL capture a `trial_offer_shown` event.
8. WHEN the user opens the graph/connections view, THE PostHog_Client SHALL capture a `graph_opened` event.
9. WHEN the user taps the share action, THE PostHog_Client SHALL capture a `share_tapped` event.
10. IF a PostHog_Client call throws an error or the network request fails, THEN THE PostHog_Client SHALL suppress the error silently without affecting the user-facing UI.
11. WHERE `NEXT_PUBLIC_POSTHOG_KEY` is not set, THE PostHog_Client SHALL not initialize and all tracking calls SHALL be no-ops.
12. THE PostHog_Client SHALL never send the raw Telegram numeric ID as a user identifier or event property.

---

### Requirement 2: Microsoft Clarity Integration

**User Story:** As a product owner, I want Clarity session recordings and heatmaps, so that I can observe real user behavior in the mini app without instrumenting every interaction manually.

#### Acceptance Criteria

1. WHEN the mini app layout renders and `NEXT_PUBLIC_CLARITY_PROJECT_ID` is set, THE Clarity_Script SHALL be injected into the page `<head>` using Next.js `Script` with the standard Clarity initialization snippet and the configured project ID.
2. WHERE `NEXT_PUBLIC_CLARITY_PROJECT_ID` is not set or is an empty string, THE Clarity_Script SHALL not be injected and no Clarity network requests SHALL be made.
3. IF the Clarity script fails to load (network error, ad blocker), THEN THE mini app layout SHALL continue to render normally without any error thrown to the user.

---

### Requirement 3: Admin Authentication

**User Story:** As an administrator, I want to log into the admin panel using my Telegram identity, so that access is gated without requiring a separate credential system.

#### Acceptance Criteria

1. WHEN a request arrives at any `/api/admin/*` route, THE Admin_Auth_Middleware SHALL extract the `Authorization: Bearer <initData>` header and verify it using the same HMAC-SHA256 algorithm as the HMAC_Verifier.
2. WHEN `initData` verification succeeds, THE Admin_Auth_Middleware SHALL extract the `telegram_id` from the `user` field of the verified params.
3. WHEN the extracted `telegram_id` is not present in the `ADMIN_TELEGRAM_IDS` environment variable (comma-separated list), THE Admin_Auth_Middleware SHALL return HTTP 403 with `{ "error": "Forbidden" }`.
4. WHEN `initData` verification fails (invalid signature or expired), THE Admin_Auth_Middleware SHALL return HTTP 401 with `{ "error": "Unauthorized" }`.
5. WHEN `ADMIN_TELEGRAM_IDS` is not set or is empty, THE Admin_Auth_Middleware SHALL return HTTP 403 for all requests.
6. THE Admin_Panel SHALL store the verified `initData` string in `sessionStorage` under the key `memo_admin_auth` after a successful login, and attach it as the `Authorization` header on all subsequent Admin_API requests.
7. WHEN the Admin_Panel detects that the stored `initData` is absent or that an Admin_API request returns 401 or 403, THE Admin_Panel SHALL redirect the user to the admin login page.
8. THE Admin_Panel login page SHALL present a "Login with Telegram" button that reads `window.Telegram.WebApp.initData` and submits it to verify admin access.

---

### Requirement 4: Admin Overview / Stats Dashboard

**User Story:** As an administrator, I want a high-level stats dashboard, so that I can monitor the health and growth of the Memo user base at a glance.

#### Acceptance Criteria

1. THE `GET /api/admin/stats` endpoint SHALL return the following metrics computed from the `profiles` table using the Service_Role_Client:
   - `total_users`: total row count
   - `new_users_today`: profiles with `created_at` on the current calendar day (UTC)
   - `new_users_this_week`: profiles with `created_at` in the current ISO week (UTC)
   - `new_users_this_month`: profiles with `created_at` in the current calendar month (UTC)
2. THE `GET /api/admin/stats` endpoint SHALL return entry metrics from the `entries` table:
   - `total_entries`: total row count
   - `entries_today`: entries with `created_at` on the current calendar day (UTC)
   - `entries_this_week`: entries with `created_at` in the current ISO week (UTC)
3. THE `GET /api/admin/stats` endpoint SHALL return subscription breakdown counts from the `profiles` table:
   - `tier_free`: count of profiles with `subscription_tier = 'free'`
   - `tier_nova`: count of profiles with `subscription_tier = 'stars_basic'`
   - `tier_supernova`: count of profiles with `subscription_tier = 'stars_pro'`
4. THE `GET /api/admin/stats` endpoint SHALL return a `revenue_stars_this_month` value: the sum of `amount` from `subscription_transactions` where `status = 'succeeded'` and `created_at` is in the current calendar month.
5. THE `GET /api/admin/stats` endpoint SHALL return trial metrics from the `profiles` table:
   - `trials_activated`: count of profiles with `trial_used = true`
   - `trials_converted`: count of profiles with `trial_used = true` AND `subscription_tier != 'free'`
6. THE `GET /api/admin/stats` endpoint SHALL return referral metrics from the `referrals` table:
   - `referrals_total`: total row count
   - `referrals_rewarded`: count of rows with `reward_granted = true`
7. THE `GET /api/admin/stats` endpoint SHALL return embedding health counts from the `entries` table:
   - `embeddings_done`: count where `embedding_status = 'done'`
   - `embeddings_pending`: count where `embedding_status = 'pending'`
   - `embeddings_failed`: count where `embedding_status = 'failed'`
8. THE `GET /api/admin/stats` endpoint SHALL return notification metrics from the `notifications_log` table:
   - `streak_notifications_this_week`: count of rows with `type = 'streak'` and `date` in the current ISO week
   - `weekly_summaries_this_week`: count of rows with `type = 'weekly_summary'` and `date` in the current ISO week
9. THE `GET /api/admin/stats` endpoint SHALL return a `dau_wau_chart` array of 30 objects, one per calendar day for the last 30 days (UTC), each containing `{ date: string, entries_count: number, distinct_users: number }`.
10. THE `GET /api/admin/stats` endpoint SHALL return a `top_categories` array of the 10 most-used category names across all users, each with `{ category: string, entry_count: number }`, ordered by `entry_count` descending.
11. THE `GET /api/admin/stats` endpoint SHALL return `avg_entries_per_user`: total entries divided by total users, rounded to two decimal places.
12. THE `GET /api/admin/stats` endpoint SHALL return a `top_users_by_entries` array of the 10 users with the most entries, each with `{ user_id: string, username: string | null, entry_count: number }`.
13. THE Admin_Panel overview page SHALL render all stats from `GET /api/admin/stats` in a card-based layout with a DAU/WAU line chart and a top-categories bar chart.

---

### Requirement 5: Admin Users List

**User Story:** As an administrator, I want a paginated, searchable, filterable table of all users, so that I can quickly find and inspect any user account.

#### Acceptance Criteria

1. THE `GET /api/admin/users` endpoint SHALL accept query parameters `page` (integer, default 1), `limit` (integer, default 50, max 200), `search` (string, matched against `telegram_id` cast to text and `username` using case-insensitive prefix match), and `tier` (one of `free`, `stars_basic`, `stars_pro`).
2. THE `GET /api/admin/users` endpoint SHALL return a JSON object with `{ users: User[], total: number, page: number, limit: number }` where each `User` contains: `id`, `telegram_id`, `username`, `subscription_tier`, `subscription_ends_at`, `trial_used`, `entry_count`, `created_at`.
3. THE `entry_count` field in the users list SHALL be computed as the count of rows in the `entries` table for each user's `id`.
4. THE Admin_Panel users page SHALL render the user list as a table with columns matching the fields in Acceptance Criterion 2.
5. THE Admin_Panel users page SHALL provide a search input that triggers a new `GET /api/admin/users` request with the `search` parameter after a 300ms debounce.
6. THE Admin_Panel users page SHALL provide a tier filter dropdown that triggers a new `GET /api/admin/users` request with the `tier` parameter.
7. THE Admin_Panel users page SHALL provide pagination controls (previous/next page buttons and a page indicator) that update the `page` parameter.
8. WHEN a user row is clicked in the Admin_Panel users table, THE Admin_Panel SHALL navigate to the user detail page for that user's `id`.

---

### Requirement 6: Admin User Detail and Plan Management

**User Story:** As an administrator, I want to view a user's full profile and manually adjust their subscription tier, so that I can handle support requests and grant access without touching the database directly.

#### Acceptance Criteria

1. THE `GET /api/admin/users/[id]` endpoint SHALL return a single user object containing all `profiles` columns plus: `entry_count`, `entry_count_by_category` (array of `{ category: string, count: number }`), `reports_count`, `referrals_made` (count of rows in `referrals` where `referrer_id = id`), `reminders_count`.
2. THE Admin_Panel user detail page SHALL display all fields returned by `GET /api/admin/users/[id]` in a structured layout.
3. THE Admin_Panel user detail page SHALL include a plan management form with:
   - A dropdown to select the new `subscription_tier` (`free`, `stars_basic`, `stars_pro`)
   - A date-time input for `subscription_ends_at` (optional — leave empty for indefinite access)
   - A "Grant indefinite access" checkbox that clears `subscription_ends_at`
   - A "Save changes" button
4. WHEN the "Save changes" button is clicked, THE Admin_Panel SHALL send a `PATCH /api/admin/users/[id]` request with body `{ subscription_tier, subscription_status, subscription_ends_at }`.
5. THE `PATCH /api/admin/users/[id]` endpoint SHALL update `profiles.subscription_tier`, `profiles.subscription_status`, and `profiles.subscription_ends_at` for the specified user using the Service_Role_Client.
6. WHEN `subscription_ends_at` is omitted or null in the PATCH body, THE `PATCH /api/admin/users/[id]` endpoint SHALL set `profiles.subscription_ends_at` to `NULL` (indefinite access).
7. WHEN the PATCH succeeds, THE Admin_Panel SHALL display a success notification and refresh the user detail data.
8. IF the PATCH request fails, THEN THE Admin_Panel SHALL display an error message without navigating away from the page.

---

### Requirement 7: Admin Categories Analytics

**User Story:** As an administrator, I want to see how categories are used across all users, so that I can understand content patterns and inform product decisions.

#### Acceptance Criteria

1. THE `GET /api/admin/categories` endpoint SHALL return a `categories` array where each element contains: `category` (string), `total_entries` (integer), `unique_users` (integer), `avg_entries_per_user` (float, rounded to 2 decimal places), `pct_of_total` (float, percentage of all entries, rounded to 2 decimal places).
2. THE `GET /api/admin/categories` endpoint SHALL return a `weekly_trend` array of the last 8 ISO weeks, each containing `{ week_start: string, counts: { [category: string]: number } }`.
3. THE Admin_Panel categories page SHALL render the categories summary as a sortable table.
4. THE Admin_Panel categories page SHALL render the weekly trend as a stacked bar chart or line chart with one series per category.

---

### Requirement 8: Admin Subscriptions and Revenue

**User Story:** As an administrator, I want to see subscription transactions and revenue trends, so that I can track monetization performance.

#### Acceptance Criteria

1. THE `GET /api/admin/transactions` endpoint SHALL accept query parameters `page` (integer, default 1) and `limit` (integer, default 50, max 200) and return `{ transactions: Transaction[], total: number, page: number, limit: number }` where each `Transaction` contains: `id`, `user_id`, `username`, `amount`, `currency`, `tier`, `status`, `created_at`.
2. THE `GET /api/admin/transactions` endpoint SHALL join `subscription_transactions` with `profiles` to include the `username` field.
3. THE `GET /api/admin/transactions` endpoint SHALL return a `monthly_revenue` array of the last 12 calendar months, each containing `{ month: string, stars_earned: number }`.
4. THE `GET /api/admin/transactions` endpoint SHALL return a `conversion_funnel` object with: `registered` (total profiles), `trial_activated` (profiles with `trial_used = true`), `paid` (profiles with `subscription_tier != 'free'`).
5. THE Admin_Panel subscriptions page SHALL render the transactions table with pagination.
6. THE Admin_Panel subscriptions page SHALL render the monthly revenue as a bar chart.
7. THE Admin_Panel subscriptions page SHALL render the conversion funnel as a funnel or step chart.

---

### Requirement 9: Admin System Health

**User Story:** As an administrator, I want a system health view, so that I can detect and respond to operational issues like stuck embedding queues or failed notifications.

#### Acceptance Criteria

1. THE `GET /api/admin/health` endpoint SHALL return embedding queue stats from the `entries` table: `{ pending: number, done: number, failed: number }`.
2. THE `GET /api/admin/health` endpoint SHALL return reminder stats from the `reminders` table: `{ pending: number, sent: number }` where `pending` is rows with `done = false` and `remind_at` in the future, and `sent` is rows with `done = true`.
3. THE `GET /api/admin/health` endpoint SHALL return a `notifications_by_type_last_7_days` array of 7 objects (one per calendar day), each containing `{ date: string, counts: { [type: string]: number } }` derived from the `notifications_log` table.
4. THE `GET /api/admin/health` endpoint SHALL return a `referrals` array of all rows from the `referrals` table joined with `profiles` to include `referrer_username` and `referred_username`, ordered by `created_at` descending, limited to 100 rows.
5. THE Admin_Panel health page SHALL render the embedding queue, reminder stats, and notifications log in card and table components.
6. THE Admin_Panel health page SHALL render the referrals table with `referrer_username`, `referred_username`, `code`, `reward_granted`, and `created_at` columns.

---

### Requirement 10: Admin Panel Layout and Navigation

**User Story:** As an administrator, I want a consistent admin panel layout with navigation, so that I can move between sections efficiently.

#### Acceptance Criteria

1. THE Admin_Panel SHALL use a dedicated Next.js layout at `src/app/admin/layout.tsx` that is independent of the mini app layout and does not include the Telegram WebApp SDK initialization.
2. THE Admin_Panel layout SHALL include a sidebar or top navigation with links to: Overview, Users, Categories, Subscriptions, and Health sections.
3. THE Admin_Panel SHALL use a light theme with Tailwind CSS and the existing shadcn/ui components already present in `src/components/ui/`.
4. THE Admin_Panel layout SHALL check for a valid `memo_admin_auth` value in `sessionStorage` on mount; if absent, THE Admin_Panel layout SHALL redirect to `/admin/login`.
5. WHEN the admin navigates to `/admin/login`, THE Admin_Panel login page SHALL display a login button that reads `window.Telegram.WebApp.initData` and calls `POST /api/admin/auth` to verify admin access.
6. THE `POST /api/admin/auth` endpoint SHALL verify `initData` using the HMAC_Verifier and check the `ADMIN_TELEGRAM_IDS` whitelist, returning `{ ok: true }` on success or the appropriate 401/403 error.
7. WHEN `POST /api/admin/auth` returns `{ ok: true }`, THE Admin_Panel login page SHALL store the `initData` in `sessionStorage` under `memo_admin_auth` and redirect to `/admin`.
8. THE Admin_Panel SHALL be accessible only at the `/admin` path and SHALL not be linked from or affect the mini app routes under `/miniapp`.

---

### Requirement 11: Environment Variables

**User Story:** As a developer, I want all new configuration values declared as environment variables with clear documentation, so that the feature can be deployed without hardcoded secrets.

#### Acceptance Criteria

1. THE system SHALL read the PostHog project API key from the `NEXT_PUBLIC_POSTHOG_KEY` environment variable.
2. THE system SHALL read the PostHog host URL from the `NEXT_PUBLIC_POSTHOG_HOST` environment variable, defaulting to `https://app.posthog.com` when the variable is absent.
3. THE system SHALL read the Microsoft Clarity project ID from the `NEXT_PUBLIC_CLARITY_PROJECT_ID` environment variable.
4. THE system SHALL read the comma-separated admin Telegram ID whitelist from the `ADMIN_TELEGRAM_IDS` environment variable.
5. THE `.env.example` file SHALL be updated to document all four new environment variables with descriptive comments.
6. WHERE any of the four new environment variables are absent, THE system SHALL degrade gracefully: PostHog and Clarity integrations are skipped, and admin routes return 403.
