# Environment & Deployment — Memo

---

## Environment Variables

### Required

```env
# ── Telegram ──────────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=           # Bot token from @BotFather
TELEGRAM_BOT_USERNAME=        # Bot username without @, e.g. memo_r0bot
MINIAPP_URL=                  # Full URL to miniapp, e.g. https://your-domain.vercel.app/miniapp

# ── Supabase (server-side only — NEVER expose to client) ─────────────────────
SUPABASE_URL=                 # https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=    # Service role key — bypasses RLS

# ── Supabase (client-side — safe to expose, RLS enforces isolation) ───────────
NEXT_PUBLIC_SUPABASE_URL=     # Same as SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Anon key

# ── Google AI ─────────────────────────────────────────────────────────────────
GEMINI_API_KEY=               # Google AI Studio API key

# ── Cron Security ─────────────────────────────────────────────────────────────
CRON_SECRET=                  # Secret for /api/cron/* routes (Vercel injects automatically)
```

### Validation
All server-side env vars are validated at request time via Zod in `src/lib/env.ts`:
```typescript
const EnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  CRON_SECRET: z.string().min(1),
});
```
Uses a lazy proxy — fails fast on first use if a variable is missing.

---

## Vercel Deployment

### Project Setup
1. Push to GitHub
2. Import repo in Vercel dashboard
3. Framework preset: **Next.js**
4. Add all environment variables in Vercel → Settings → Environment Variables

### Build Command
```bash
next build
```

### Cron Jobs (`vercel.json`)
```json
{
  "crons": [
    { "path": "/api/cron/process", "schedule": "0 0 * * *" },
    { "path": "/api/cron/reports", "schedule": "0 9 * * *" }
  ]
}
```
Vercel automatically injects `Authorization: Bearer <CRON_SECRET>` for cron requests.

### Runtime Configuration
- Edge routes: `export const runtime = "edge"` at top of route file
- Node.js routes: default (no export needed)
- Max duration for reports: 60s (configured in route handler)

---

## Supabase Setup

### 1. Create Project
- Go to supabase.com → New Project
- Choose region closest to your users (recommend `eu-central-1` for Ukrainian users)

### 2. Enable pgvector
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. Run Migrations
Run all files in `supabase/migrations/` in order:
```bash
# Using Supabase CLI
supabase db push

# Or manually in SQL editor, in order:
20240001000000_initial_schema.sql
20240001000003_threads.sql
20240001000004_open_categories.sql
20240001000005_reminders_todos.sql
20240001000007_reports.sql
20240001000008_retro_columns.sql
20240001000009_hnsw_tuning.sql
20240001000010_memory_and_alltime_search.sql
20240001000011_stars_paywall.sql
20240001000012_grant_free_access.sql
20240001000015_subscription_start_date.sql
```

### 4. Copy Keys
From Supabase dashboard → Settings → API:
- `Project URL` → `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Telegram Bot Setup

### 1. Create Bot
1. Message @BotFather in Telegram
2. `/newbot` → follow prompts
3. Copy the bot token → `TELEGRAM_BOT_TOKEN`

### 2. Register Webhook
After first Vercel deployment:
```bash
TELEGRAM_BOT_TOKEN=<token> \
WEBHOOK_URL=https://<your-domain>/api/telegram/webhook \
npx ts-node scripts/set-webhook.ts
```

Or directly:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-domain>/api/telegram/webhook
```

### 3. Configure Mini App
In @BotFather:
- `/mybots` → select your bot → Bot Settings → Menu Button
- Set URL to `https://<your-domain>/miniapp`

Or use `/newapp` to create a dedicated mini app entry.

### 4. Set Bot Commands
```
/setcommands → select bot → paste:
start - Почати роботу з Memo
help - Довідка та команди
report - Згенерувати ретроспективу
stats - Статистика за сьогодні
recommendations - AI рекомендації
```

---

## Local Development

### Prerequisites
- Node.js 20+
- npm or pnpm
- Supabase project (or local Supabase via Docker)
- Google AI Studio API key
- Telegram bot token

### Setup
```bash
# Install dependencies
npm install

# Copy env file
cp .env.example .env.local
# Fill in all values in .env.local

# Run dev server
npm run dev
```

### Testing the Bot Locally
Use [ngrok](https://ngrok.com/) to expose localhost:
```bash
ngrok http 3000
# Copy the https URL, e.g. https://abc123.ngrok.io

# Register webhook
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://abc123.ngrok.io/api/telegram/webhook"
```

### Testing the Mini App Locally
The mini app requires `window.Telegram.WebApp.initData` to authenticate. Options:

1. **Use Telegram's test environment** — Open the mini app via Telegram on your phone pointing to ngrok URL
2. **Mock auth context** — In `src/lib/supabase/auth-context.tsx`, add a dev bypass:
```typescript
if (process.env.NODE_ENV === 'development') {
  // Use a test JWT from Supabase dashboard
}
```

### Available Scripts
```bash
npm run dev        # Start development server
npm run build      # Production build
npm run start      # Start production server
npm run lint       # ESLint
npm run test       # Run tests (vitest --run)
npm run test:watch # Watch mode tests
```

---

## Database Seeding

Test data scripts in `/scripts/`:

```bash
# Seed a specific user with test entries
npx ts-node scripts/seed_user_8481763864.ts

# Grant Nova access to a user
psql $DATABASE_URL < scripts/grant_nova_7633172724.sql

# Grant Pro to all users (testing)
psql $DATABASE_URL < scripts/grant_pro_all_users.sql
```

---

## Monitoring & Observability

**Current state:** No monitoring configured.

**Recommended setup:**
```bash
# Error tracking
npm install @sentry/nextjs

# Analytics
npm install posthog-js
```

**Key metrics to track:**
- Webhook processing time (p50, p95, p99)
- Gemini API latency and error rate
- Embedding success/failure rate
- Paywall conversion rate
- Daily/weekly active users
- Subscription churn rate
