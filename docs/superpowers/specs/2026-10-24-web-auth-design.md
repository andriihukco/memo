# Web Auth and Profile Handles: Design

Date: 2026-10-24
Status: Draft, pending user review

## Goal

Make Memo a web app that works without Telegram. Telegram stays as an add-on: a linked Telegram account can feed the bot and sign in through the Login Widget. Users sign in with email magic link (Supabase), Google (Supabase OAuth), or Telegram (Login Widget). On first login they pick a handle. Other sign-in methods can be linked later from Settings.

Vercel login is out of scope.

## Decisions Already Made

- Supabase Auth user is the primary identity. `profiles.id = auth.users.id`. Existing Telegram users already have this, because the Telegram bridge at `src/app/api/auth/telegram/route.ts` sets it.
- Linking happens only from a signed-in session. An identity already linked to another profile is refused. There is no automatic merge, even when emails match.
- Handle: unique, public, 3–20 characters, `[a-zA-Z0-9_]`. Changeable once every 7 days.
- A linked Telegram account routes bot messages to its profile. Unlinked web users never touch the bot.
- The Telegram Mini App keeps signing in with `initData`.

## Architecture

### Login

- `/` is a landing page with a "Sign in" button.
- `/login` offers three options: email magic link, Google, Telegram Login Widget.
- Email: `supabase.auth.signInWithOtp`. Google: `supabase.auth.signInWithOAuth({ provider: 'google' })`. Both return to `/auth/callback`, which exchanges the code for a session cookie with `@supabase/ssr`.
- Telegram (web): the Login Widget returns a signed payload. A server route at `/api/auth/telegram/web` verifies the signature with the bot token, then reuses the bridge logic in `/api/auth/telegram` to find or create the Supabase user and set the session.
- Telegram Mini App: unchanged.
- Logout clears the session cookie.

### Session resolution

Every `/app` page and every API route accepts either a Supabase session cookie or Mini App `initData`. Both resolve to the same `profiles.id`. The shared helper is `getAuthedUserId(request)`.

## Data Model

One migration:

- `profiles.telegram_id`: drop `NOT NULL`. Keep `UNIQUE`.
- `profiles.handle TEXT UNIQUE`, with a check constraint `handle ~ '^[a-zA-Z0-9_]{3,20}$'`.
- `profiles.handle_changed_at TIMESTAMPTZ`.
- New table `linked_identities`:
  - `id UUID PK`
  - `user_id UUID → profiles.id ON DELETE CASCADE`
  - `provider TEXT CHECK (provider IN ('email','google','telegram'))`
  - `provider_user_id TEXT NOT NULL`
  - `email TEXT`
  - `created_at TIMESTAMPTZ`
  - `UNIQUE (provider, provider_user_id)`
  - RLS: a user can read and delete only their own rows.

Backfill: every profile with a `telegram_id` gets a `telegram` row. Profiles with no handle get a suggested one: the Telegram username if it passes validation, otherwise `user_<first 8 chars of id>`. The user confirms it on their first visit.

## First Login and Handles

- If `handle` is null, the app redirects to `/onboarding/handle` before anything else. The API returns 403 `handle_required` for other routes.
- Availability is checked on the server. The save sets `handle_changed_at`.
- Handle change from Settings: allowed when `handle_changed_at` is null or at least 7 days old. The server enforces this. The UI shows the date the next change is allowed.

## Linking and Unlinking

Settings → Connected accounts lists each provider with its status.

- **Google and email:** `supabase.auth.linkIdentity` for Google. `supabase.auth.updateUser({ email })` for email, which triggers a confirmation email before the link takes effect. The `linked_identities` row is written after confirmation.
- **Telegram:** the user runs the Login Widget again while signed in. The server verifies the payload and inserts the row.
- **Conflict:** if the identity already belongs to another profile, return 409 with the owning sign-in method. No merge.
- **Unlink:** allowed only when at least one other provider remains.

## Error Handling

- Expired or used magic link: "Link expired, request a new one," with a button back to `/login`.
- Cancelled Google or Telegram sign-in: return to `/login` with a message. No profile is created.
- Handle taken: inline error on submit and on blur.
- Handle change within 7 days: the form shows the next allowed date.
- Link conflict: message names the owning sign-in method.
- Expired session on an API call: 401. The client redirects to `/login?next=…`.

## Testing

- Unit (Vitest): Telegram signature verifier, handle validator, 7-day rule.
- Integration: callback routes, link and unlink endpoints, following the existing API auth test patterns.
- Migration: run on a Supabase branch. Confirm RLS still holds with nullable `telegram_id`.
- Manual: all three login paths, checked at desktop and phone widths.

## Rollout

1. Migration and backfill.
2. Auth layer: `/login`, callback, Telegram web verifier, session helper. Confirm the Mini App `initData` path has no regressions.
3. Web UI: `/app` shell, onboarding, Settings → Connected accounts.

## Setup Outside the Code

- Supabase Auth: enable Google provider, set redirect URLs, configure the magic-link email template.
- Google Cloud: OAuth client ID and secret.
- BotFather: set the bot's domain for the Login Widget.

## Risks

- Telegram web sign-in needs the production domain registered with BotFather. Local testing needs a tunnel or a test bot.
- Google and email linking depend on Supabase's identity-linking behavior. Verify against the installed Supabase version before writing the plan.
- `profiles.telegram_id` becoming nullable may affect code that assumes it is set. Audit call sites in the plan.

## Out of Scope

- Web payments. WayForPay stays as it is.
- Vercel login.
