# Memo — AI Personal Diary

Memo is a Telegram bot + mini-app that acts as an intelligent personal diary. You send it text or voice messages about anything — food, workouts, expenses, feelings, thoughts — and it automatically classifies, stores, and analyzes everything. A built-in Telegram Mini App gives you a dashboard, knowledge graph, and retrospective reports.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [AI Pipeline](#ai-pipeline)
- [Telegram Bot](#telegram-bot)
- [Mini App (Frontend)](#mini-app-frontend)
- [API Routes](#api-routes)
- [Background Processing](#background-processing)
- [Authentication](#authentication)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Local Development](#local-development)

---

## What It Does

**Bot side (Telegram):**
- Accepts free-form text and voice messages in any language
- Classifies intent: diary entry, question, action command, or smalltalk
- Extracts structured metrics automatically (calories, macros, distance, sleep, mood, expenses, etc.)
- Generates a natural conversational reply using the user's own writing style
- Answers questions about past entries using semantic search (RAG)
- Executes action commands: delete entries, create dashboard widgets
- Generates agile-style retrospective reports (`/report`, `/report daily`, `/report monthly`)
- Supports conversation threads — replies to bot messages continue the same thread

**Mini App side (Telegram WebApp):**
- Feed — scrollable list of all entries with swipe-to-delete, long-press multi-select, thread grouping
- Dashboard — dynamic metric widgets (calories, macros, water, sleep, mood, expenses, etc.) with date range filter and drill-down to source entries
- Goals tab — progress bars toward stated goals
- Graph — D3 force-directed knowledge graph of entries connected by semantic similarity and branch clusters
- Reports — generate and browse agile retrospectives (daily / weekly / monthly / custom range)
- Settings — 4-digit passcode lock with configurable auto-lock timer

---

## Architecture Overview

```
Telegram User
     │
     ▼
Telegram Bot API
     │  webhook POST
     ▼
/api/telegram/webhook  (Edge runtime, grammY)
     │
     ├─ classify()          ← Gemini 2.5 Flash (intent + metrics extraction)
     ├─ handleTextMessage()
     │    ├─ answerQuestion()   ← RAG: embed → pgvector search → Gemini answer
     │    ├─ handleAction()     ← delete entries / create widget
     │    └─ generateConverseReply()  ← Gemini conversational reply
     │
     ├─ handleVoiceMessage()
     │    └─ classifyAudio()   ← Gemini multimodal (transcribe + classify)
     │
     └─ embedEntry()  [async, non-blocking]
          ├─ generateEmbedding()  ← gemini-embedding-001 (768-dim)
          ├─ findSimilarEntries() ← pgvector cosine similarity RPC
          ├─ generateInsight()    ← Gemini insight from similar entries
          └─ generateConversationalReply()  ← pattern-aware reply

Supabase (PostgreSQL + pgvector)
  ├─ profiles
  ├─ entries  (+ vector index HNSW)
  ├─ insights
  ├─ categories
  ├─ reports
  ├─ reminders
  └─ todos

Vercel Cron Jobs
  ├─ /api/cron/process  (daily 00:00 UTC)
  │    ├─ clusterEntries()    ← pgvector union-find clustering
  │    ├─ buildAndSaveWidgets()  ← Gemini widget summaries
  │    └─ autoIncrementStreaks()
  └─ /api/cron/reports  (daily 09:00 UTC)

Telegram Mini App
  └─ Next.js pages under /miniapp/*
       ├─ /miniapp           → Feed
       ├─ /miniapp/dashboard → Dashboard
       ├─ /miniapp/graph     → Knowledge Graph
       ├─ /miniapp/reports   → Retrospectives
       └─ /miniapp/settings  → Passcode / Privacy
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Bot library | grammY |
| AI / LLM | Google Gemini 2.5 Flash (`gemini-2.5-flash`) |
| Embeddings | Google `gemini-embedding-001` (768 dimensions) |
| Database | Supabase (PostgreSQL) |
| Vector search | pgvector (HNSW index, cosine similarity) |
| Auth | Supabase Auth (synthetic email/password per Telegram user) |
| Frontend | React 18, Tailwind CSS, shadcn/ui, Radix UI |
| Graph visualization | D3.js (force simulation) |
| Validation | Zod |
| Deployment | Vercel (Edge + Node.js runtimes) |
| Cron | Vercel Cron Jobs |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/telegram/route.ts     # Telegram initData verification → Supabase JWT
│   │   ├── categories/route.ts        # User categories CRUD
│   │   ├── entries/route.ts           # Entries GET / PATCH / DELETE
│   │   ├── graph/route.ts             # Knowledge graph payload
│   │   ├── reports/route.ts           # Retrospective reports CRUD + generation
│   │   ├── cron/
│   │   │   ├── process/route.ts       # Daily processing cron
│   │   │   └── reports/route.ts       # Daily report cron
│   │   └── telegram/webhook/route.ts  # Telegram bot webhook
│   └── miniapp/
│       ├── layout.tsx                 # Auth + tab bar + passcode lock
│       ├── page.tsx                   # Feed (entry list)
│       ├── dashboard/page.tsx         # Metrics dashboard
│       ├── graph/page.tsx             # D3 knowledge graph
│       ├── reports/page.tsx           # Retrospective reports
│       └── settings/page.tsx          # Passcode settings
├── components/ui/                     # shadcn/ui components + custom
│   ├── edit-drawer.tsx                # Slide-up entry editor
│   ├── lock-button.tsx                # Manual lock trigger
│   └── passcode-screen.tsx            # 4-digit PIN screen
└── lib/
    ├── bot/
    │   ├── commands.ts                # /start /help /report handlers
    │   ├── conversational.ts          # Pattern-aware reply (with similar entries)
    │   ├── converse.ts                # General conversational reply (tone learning)
    │   ├── qa.ts                      # RAG question answering
    │   ├── retrospective.ts           # Report generation + DB persistence
    │   └── handlers/
    │       ├── action.ts              # Action commands (delete, create widget)
    │       ├── text.ts                # Text message handler (main flow)
    │       └── voice.ts               # Voice message handler
    ├── processing/
    │   ├── loop.ts                    # Clustering + streak auto-increment
    │   └── widgets.ts                 # Dashboard widget generation
    ├── classifier.ts                  # Gemini classification (intent + metrics)
    ├── embedding.ts                   # Embedding generation + RAG pipeline trigger
    ├── env.ts                         # Zod-validated env vars (lazy proxy)
    ├── insight.ts                     # Insight generation + pgvector search
    ├── passcode.ts                    # PIN hash + lock timer (localStorage)
    ├── profile.ts                     # Supabase profile resolve/create
    ├── supabase/
    │   ├── auth-context.tsx           # React auth context (access token)
    │   └── client.ts                  # Supabase browser client
    └── utils.ts                       # cn(), sanitizeMarkdown()

supabase/migrations/                   # Ordered SQL migrations
scripts/
└── set-webhook.ts                     # One-time webhook registration script
```

---

## Database Schema

### `profiles`
Stores one row per Telegram user. The `id` is the Supabase Auth UUID so RLS (`auth.uid()`) works for both bot and mini app.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | = Supabase Auth user UUID |
| `telegram_id` | BIGINT UNIQUE | Telegram user ID |
| `username` | TEXT | Telegram username |
| `settings` | JSONB | Dashboard widgets, report schedule, pending deletes, etc. |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### `entries`
Core diary entries. Every message that isn't a question, action, or smalltalk becomes an entry.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → profiles | |
| `content` | TEXT | Cleaned entry text |
| `category` | TEXT | Open-ended snake_case (thoughts, workout, sleep, etc.) |
| `metadata` | JSONB | Structured data: `dashboard_metrics[]`, `goal_metrics[]`, expense amount/currency, food calories, `bot_msg_id`, etc. |
| `raw_media_url` | TEXT | Reserved for future media attachments |
| `embedding` | vector(768) | Gemini embedding for semantic search |
| `embedding_status` | TEXT | `pending` / `done` / `failed` |
| `branch_id` | UUID | Cluster ID assigned by the processing loop |
| `thread_id` | UUID | Groups a conversation thread |
| `bot_reply` | TEXT | Bot's reply stored alongside the entry |
| `reply_to_entry_id` | UUID FK → entries | Thread parent link |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Indexes: `user_id`, `category`, `branch_id`, `thread_id`, `reply_to_entry_id`, HNSW vector index on `embedding`.

### `insights`
AI-generated insights linking a new entry to semantically similar past entries.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → profiles | |
| `entry_id` | UUID FK → entries | The entry that triggered this insight |
| `insight_text` | TEXT | Generated insight text |
| `branch_id` | UUID | Cluster this insight belongs to |
| `created_at` | TIMESTAMPTZ | |

### `categories`
Per-user category registry. Built-in categories are seeded on first use; new categories are created dynamically by the AI.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → profiles | |
| `name` | TEXT | snake_case key (e.g. `sleep`, `dreams`) |
| `label_ua` | TEXT | Human-readable label in user's language |
| `color` | TEXT | Tailwind class string |
| `icon` | TEXT | Lucide icon name |

### `reports`
AI-generated agile retrospective reports.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → profiles | |
| `period_type` | TEXT | `daily` / `weekly` / `monthly` / `custom` |
| `period_from` / `period_to` | TIMESTAMPTZ | Report date range |
| `content` | TEXT | Full Telegram Markdown report |
| `summary` | TEXT | 1-2 sentence TLDR |
| `went_well` | TEXT | Retro section: what went well |
| `didnt_go_well` | TEXT | Retro section: what didn't work |
| `start_stop_continue` | TEXT | Retro section: actions |
| `experiment` | TEXT | Retro section: next experiment |
| `lesson` | TEXT | Retro section: main lesson |
| `insights` | JSONB | Structured insight objects array |

### `reminders` / `todos`
Standard reminder and todo tables with RLS. Used for future bot features.

### pgvector function: `find_similar_entries`
```sql
find_similar_entries(p_user_id, p_embedding, p_exclude_id, p_top_k)
→ TABLE(id, content, category, created_at, similarity)
```
Returns top-K entries ordered by cosine similarity (`1 - (embedding <=> p_embedding)`).

---

## AI Pipeline

### 1. Classification (`src/lib/classifier.ts`)

Every incoming message goes through `classify()` (text) or `classifyAudio()` (voice). Uses **Gemini 2.5 Flash** with a detailed system prompt that returns a strict JSON schema validated by Zod.

**Output fields:**
- `intent`: `save_entry` | `question` | `converse` | `smalltalk` | `action`
- `category`: open-ended snake_case string
- `is_new_category`: whether to create a new category row
- `content`: cleaned text
- `metadata`: structured data (expense amount, food calories, etc.)
- `dashboard_metrics[]`: all measurable quantities extracted and derived (e.g. 5km run → distance_km, kcal_burned, active_min, steps_count)
- `goal_metrics[]`: stated goals/targets (e.g. "want to run 100km this month")
- `action_type` + `action_params`: for action intents

The classifier applies **decomposition intelligence** — from a single input like "ran 5km" it derives 4+ metrics using built-in formulas (running: 1km ≈ 80 kcal, 6 min, 1200 steps). Nutrition entries get full macro breakdowns.

### 2. Embedding (`src/lib/embedding.ts`)

After saving an entry, `embedEntry()` runs asynchronously (non-blocking):
1. Calls `gemini-embedding-001` to generate a 768-dimensional vector
2. Stores it in `entries.embedding` with `embedding_status = 'done'`
3. Calls `findSimilarEntries()` via pgvector RPC
4. If similar entries exist (similarity > 0.75), generates an insight via Gemini and sends it to the user
5. Generates a pattern-aware conversational reply referencing specific past data

### 3. Question Answering (`src/lib/bot/qa.ts`)

RAG pipeline for `intent = "question"`:
1. Embed the question with `gemini-embedding-001`
2. Resolve temporal filter (today / yesterday / this week / last week / this month) from natural language
3. Resolve category filter from keywords
4. Semantic search via pgvector → intersect with structured filters → fallback to structured-only if empty
5. Synthesize answer with Gemini 2.5 Flash, including metadata (macros, amounts, streaks)

### 4. Conversational Reply (`src/lib/bot/converse.ts`)

For all saved entries, a natural reply is generated using:
- The user's last 10 entries to learn their writing style/tone
- Thread context (up to 6 previous messages in the thread)
- A system prompt that avoids robotic confirmations and asks follow-up questions

### 5. Retrospective Reports (`src/lib/bot/retrospective.ts`)

Generates agile-style retrospectives with 5 structured sections:
1. ✅ What went well
2. ❌ What didn't work
3. 🔄 Start / Stop / Continue
4. 🧪 One experiment
5. 💡 Main lesson

Uses all entries in the period with their metrics. Output is structured JSON with both a full Telegram Markdown report and individual section fields for the mini app UI.

---

## Telegram Bot

**Entry point:** `src/app/api/telegram/webhook/route.ts` (Edge runtime)

The bot uses **grammY** with a middleware that resolves/creates the user profile before any handler runs.

**Commands:**
- `/start` — welcome message with feature overview
- `/help` — full command reference
- `/report [daily|weekly|monthly]` — generate retrospective with rotating status messages

**Message flow (text):**
1. Check for pending delete confirmation (two-step delete safety)
2. Prefetch user tone (last 10 entries)
3. Classify with Gemini
4. Route by intent:
   - `question` → RAG answer (shows "thinking" message, edits it with answer)
   - `smalltalk` → conversational reply, no save
   - `action` → execute (delete entries / create widget), no save
   - `save_entry` / `converse` → resolve thread → save entry → generate reply → embed async

**Message flow (voice):**
1. Download audio buffer from Telegram CDN (in-memory, never written to disk)
2. `classifyAudio()` — Gemini multimodal transcription + classification in one call
3. Same routing as text from step 4

**Thread system:**
- When the bot replies, it stores `bot_msg_id` in `entry.metadata`
- When the user replies to that bot message, Telegram provides `reply_to_message.message_id`
- The handler looks up the entry by `bot_msg_id` to find the thread
- Thread context (up to 6 messages) is prepended to the conversational reply prompt

---

## Mini App (Frontend)

The mini app is a Next.js app served under `/miniapp/*`. It runs inside Telegram as a WebApp.

**Layout (`src/app/miniapp/layout.tsx`):**
- Calls `window.Telegram.WebApp.ready()` and `.expand()`
- Reads safe area insets for proper iOS/Android padding
- Authenticates via `/api/auth/telegram` using `initData`
- Stores the Supabase JWT in React context
- Renders a floating pill-shaped tab bar (dark, 5 tabs)
- Passcode lock screen overlays everything when triggered

**Feed (`/miniapp`):**
- Loads last 100 entries
- Groups threaded entries into Reddit-style conversation cards
- Standalone entries are swipeable cards (swipe left to reveal delete)
- Long-press enters multi-select mode with bulk delete
- Category filter bar (horizontal scroll)
- Tap any entry to open the edit drawer

**Dashboard (`/miniapp/dashboard`):**
- Date range picker (today / 7 days / 30 days / custom)
- Aggregates `dashboard_metrics` from all entries in range
- Special energy balance card when both `kcal_intake` and `kcal_burned` exist
- Generic metric cards with color-coded icons, drill-down to source entries
- Finance section: total spend + category breakdown bars
- Mood section: sentiment scoring + sparkline
- Goals tab: progress bars toward `goal_metrics` targets

**Graph (`/miniapp/graph`):**
- Fetches graph payload from `/api/graph`
- D3 force simulation with:
  - Branch edges (solid indigo) — entries in the same semantic cluster
  - Similarity edges (dashed gray) — cosine similarity above threshold
  - Node size proportional to edge count
  - Node color by category
  - Cluster labels for connected components
  - Pinch-to-zoom, drag nodes
- Tap a node to see full content + linked entries in a bottom sheet

**Reports (`/miniapp/reports`):**
- List of saved retrospectives
- Generate new report via bottom sheet (preset periods or custom date range)
- Rotating progress labels during generation
- Expandable report cards showing all 5 retro sections with color-coded borders

**Settings (`/miniapp/settings`):**
- Enable / change / disable 4-digit passcode
- Auto-lock timer: immediately / 1 min / 5 min / 15 min / 1 hour
- PIN stored as SHA-256 hash in `localStorage`

---

## API Routes

All mini app routes require `Authorization: Bearer <supabase_jwt>`.

| Method | Path | Runtime | Description |
|---|---|---|---|
| POST | `/api/telegram/webhook` | Edge | grammY webhook handler |
| POST | `/api/auth/telegram` | Edge | Verify Telegram initData → return Supabase JWT |
| GET | `/api/entries` | Edge | List entries (pagination, category, date range filters) |
| PATCH | `/api/entries` | Edge | Update entry content/category (re-computes metrics via Gemini) |
| DELETE | `/api/entries` | Edge | Bulk delete by IDs |
| GET | `/api/graph` | Edge | Knowledge graph nodes + edges |
| GET | `/api/reports` | Node.js | List reports |
| POST | `/api/reports` | Node.js | Generate new report (60s timeout) |
| DELETE | `/api/reports` | Node.js | Delete report |
| GET | `/api/categories` | Edge | List user categories |
| GET | `/api/cron/process` | Node.js | Daily processing (cron, requires `CRON_SECRET`) |
| GET | `/api/cron/reports` | Node.js | Daily report delivery (cron, requires `CRON_SECRET`) |

---

## Background Processing

**Daily cron at 00:00 UTC** — `/api/cron/process`:

1. **`clusterEntries(userId)`** — For each entry with an embedding, calls `find_similar_entries` RPC to find neighbors (similarity > 0.75). Builds a union-find graph and assigns shared `branch_id` UUIDs to clusters of ≥ 3 entries. Updates both `entries.branch_id` and `insights.branch_id`.

2. **`buildAndSaveWidgets(userId)`** — Generates dashboard widget configs and saves them to `profiles.settings.dashboard_widgets`:
   - `calories_today` — sum of today's calorie entries
   - `expenses_today` — sum by currency
   - `mood_trend` — Gemini analysis of feeling entries (improving / stable / declining)
   - `life_theme` — per-cluster theme label generated by Gemini
   - `daily_summary` / `weekly_summary` / `monthly_summary` — narrative summaries
   - `insight_cluster` — summarized insight clusters

3. **`autoIncrementStreaks(userId)`** — Finds entries from yesterday with `aggregate=last` streak metrics (keys ending in `_days`). If no entry exists today for that category, creates a new entry with value+1.

**Daily cron at 09:00 UTC** — `/api/cron/reports`:
Delivers scheduled reports to users who have enabled auto-reports in `profiles.settings.report_schedule`.

---

## Authentication

The system uses a **synthetic Supabase Auth account** per Telegram user:

1. **Bot side**: `resolveOrCreateProfile()` in `src/lib/profile.ts` creates a Supabase Auth user with email `telegram_<id>@memo.app` and a deterministic password. The profile `id` is set to the Supabase Auth UUID so `auth.uid()` in RLS policies matches `entries.user_id`.

2. **Mini App side**: `/api/auth/telegram` verifies the Telegram `initData` HMAC-SHA256 signature (with 24-hour expiry check), then signs in with the same synthetic credentials to get a real Supabase session JWT. This JWT is stored in React context and sent as `Authorization: Bearer` on all API calls.

3. **RLS**: All tables have Row Level Security enabled. Policies use `auth.uid()` to ensure users can only access their own data.

---

## Environment Variables

```env
# Telegram
TELEGRAM_BOT_TOKEN=          # Bot token from @BotFather

# Supabase
SUPABASE_URL=                # https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=   # Service role key (server-side only)
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Anon key (used in browser/edge with user JWT)

# Google AI
GEMINI_API_KEY=              # Google AI Studio API key

# Cron security
CRON_SECRET=                 # Secret for /api/cron/* routes
```

All server-side vars are validated at request time via a Zod schema in `src/lib/env.ts` (lazy proxy — fails fast on first use if missing).

---

## Deployment

The project is deployed on **Vercel**.

### 1. Push to GitHub and import into Vercel

Connect your GitHub repo to Vercel. Framework preset: **Next.js**.

### 2. Set environment variables

In Vercel project settings → Environment Variables, add all vars from the section above.

### 3. Deploy

Vercel auto-deploys on push. The build runs `next build`.

### 4. Register the Telegram webhook

After first deploy, run the webhook registration script once:

```bash
TELEGRAM_BOT_TOKEN=<token> WEBHOOK_URL=https://<your-domain>/api/telegram/webhook npx ts-node scripts/set-webhook.ts
```

Or call the Telegram API directly:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-domain>/api/telegram/webhook
```

### 5. Set up Supabase

1. Create a Supabase project
2. Enable the `vector` extension in the SQL editor: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Run all migrations in order from `supabase/migrations/`
4. Copy the project URL and keys to Vercel env vars

### 6. Configure the Telegram Mini App

In @BotFather:
- `/newapp` or edit existing bot
- Set the Web App URL to `https://<your-domain>/miniapp`

### Vercel Cron Jobs

Defined in `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/process", "schedule": "0 0 * * *" },
    { "path": "/api/cron/reports", "schedule": "0 9 * * *" }
  ]
}
```
Vercel automatically calls these with `Authorization: Bearer <CRON_SECRET>` (set in env vars).

---

## Local Development

```bash
# Install dependencies
npm install

# Copy env file and fill in values
cp .env.example .env.local

# Run dev server
npm run dev
```

For local bot testing, use [ngrok](https://ngrok.com/) to expose localhost and register the webhook:
```bash
ngrok http 3000
# Then set webhook to https://<ngrok-id>.ngrok.io/api/telegram/webhook
```

The mini app requires Telegram context (`window.Telegram.WebApp.initData`) to authenticate. For local UI development you can mock the auth context in `src/lib/supabase/auth-context.tsx`.

```bash
# Lint
npm run lint

# Build
npm run build
```
