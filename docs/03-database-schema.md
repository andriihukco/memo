# Database Schema — Memo

Supabase (PostgreSQL) with pgvector extension. All tables have Row Level Security enabled.

---

## Tables

### `profiles`
One row per Telegram user. The `id` equals the Supabase Auth UUID so `auth.uid()` works in RLS.

```sql
CREATE TABLE profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id           BIGINT UNIQUE NOT NULL,
  username              TEXT,
  settings              JSONB NOT NULL DEFAULT '{}',
  subscription_tier     TEXT DEFAULT 'free'
                        CHECK (subscription_tier IN ('free','stars_basic','stars_pro')),
  subscription_status   TEXT DEFAULT 'free'
                        CHECK (subscription_status IN ('free','active','past_due','canceled','paused')),
  subscription_ends_at  TIMESTAMPTZ,        -- NULL = permanent / free
  subscription_start_date TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**`settings` JSONB structure:**
```json
{
  "dashboard_widgets": [...],
  "custom_widgets": [...],
  "report_schedule": { "enabled": true, "period": "daily" },
  "pending_delete": { "ids": [...], "expires_at": "..." }
}
```

---

### `entries`
Core diary entries. Every non-question, non-action message becomes an entry.

```sql
CREATE TABLE entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content           TEXT NOT NULL,              -- AES-GCM encrypted
  category          TEXT NOT NULL,              -- snake_case, open-ended
  metadata          JSONB NOT NULL DEFAULT '{}',
  raw_media_url     TEXT,                       -- reserved for future media
  embedding         vector(768),                -- gemini-embedding-001
  embedding_status  TEXT NOT NULL DEFAULT 'pending'
                    CHECK (embedding_status IN ('pending','done','failed')),
  branch_id         UUID,                       -- semantic cluster ID
  thread_id         UUID,                       -- conversation thread
  reply_to_entry_id UUID REFERENCES entries(id),
  bot_reply         TEXT,                       -- encrypted bot reply
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**`metadata` JSONB structure:**
```json
{
  "dashboard_metrics": [
    { "key": "kcal_intake", "label": "Калорії", "value": 525, "unit": "ккал", "icon": "flame", "aggregate": "sum" }
  ],
  "goal_metrics": [
    { "key": "steps_goal", "label": "Кроки", "target": 10000, "unit": "кроків", "period": "day" }
  ],
  "bot_msg_id": 12345,
  "entry_type": "log",
  "expense_amount": 150,
  "expense_currency": "UAH"
}
```

**Indexes:**
```sql
CREATE INDEX entries_user_id_idx      ON entries(user_id);
CREATE INDEX entries_category_idx     ON entries(category);
CREATE INDEX entries_branch_id_idx    ON entries(branch_id);
CREATE INDEX entries_thread_id_idx    ON entries(thread_id);
CREATE INDEX entries_reply_to_idx     ON entries(reply_to_entry_id);
CREATE INDEX entries_embedding_idx    ON entries
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

### `insights`
AI-generated insights linking a new entry to semantically similar past entries.

```sql
CREATE TABLE insights (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_id     UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  insight_text TEXT NOT NULL,
  branch_id    UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `categories`
Per-user category registry. Built-in categories are seeded on first use; new ones are created dynamically by the AI.

```sql
CREATE TABLE categories (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,        -- snake_case key, e.g. "sleep"
  label_ua  TEXT NOT NULL,        -- human-readable, e.g. "Сон"
  color     TEXT NOT NULL,        -- Tailwind class string
  icon      TEXT NOT NULL,        -- Lucide icon name
  UNIQUE (user_id, name)
);
```

**Built-in categories:**
`thoughts`, `ideas`, `feelings`, `expenses`, `calories`, `workout`, `goals`, `sleep`, `health`, `dreams`, `books`, `work`, `relationships`, `travel`, `gratitude`, `music`, `social`

---

### `reports`
AI-generated agile retrospective reports.

```sql
CREATE TABLE reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_type         TEXT NOT NULL CHECK (period_type IN ('daily','weekly','monthly','custom')),
  period_from         TIMESTAMPTZ NOT NULL,
  period_to           TIMESTAMPTZ NOT NULL,
  content             TEXT NOT NULL,        -- full Telegram Markdown report
  summary             TEXT,                 -- 1-2 sentence TLDR
  went_well           TEXT,                 -- ✅ section
  didnt_go_well       TEXT,                 -- 🔴 section
  start_stop_continue TEXT,                 -- 🔄 section
  experiment          TEXT,                 -- 🧪 section
  lesson              TEXT,                 -- 💡 section
  insights            JSONB DEFAULT '[]',   -- structured insight objects
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `subscriptions`
Payment tracking. One row per payment event.

```sql
CREATE TABLE subscriptions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  telegram_payment_charge_id  TEXT NOT NULL UNIQUE,
  provider_payment_charge_id  TEXT NOT NULL UNIQUE,
  tier                        TEXT NOT NULL CHECK (tier IN ('free','stars_basic','stars_pro')),
  status                      TEXT NOT NULL CHECK (status IN ('active','past_due','canceled','paused')),
  start_date                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date                    TIMESTAMPTZ,   -- NULL = permanent
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `subscription_transactions`
Full payment history for audit and refund tracking.

```sql
CREATE TABLE subscription_transactions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id             UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id                     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount                      BIGINT NOT NULL,          -- in Stars
  currency                    TEXT NOT NULL DEFAULT 'XTR',
  telegram_payment_charge_id  TEXT NOT NULL UNIQUE,
  provider_payment_charge_id  TEXT NOT NULL UNIQUE,
  description                 TEXT,
  status                      TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed','refunded')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `subscription_invoices`
Invoice generation tracking for idempotency.

```sql
CREATE TABLE subscription_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier            TEXT NOT NULL CHECK (tier IN ('stars_basic','stars_pro')),
  invoice_payload TEXT NOT NULL,
  amount          BIGINT NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'XTR',
  status          TEXT NOT NULL CHECK (status IN ('pending','completed','failed','expired')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
```

---

### `reminders` / `todos`
Standard tables with RLS. Reserved for future bot features (scheduled reminders, task tracking).

---

## Key SQL Functions

### `find_similar_entries`
```sql
find_similar_entries(
  p_user_id   UUID,
  p_embedding vector(768),
  p_exclude_id UUID,
  p_top_k     INT DEFAULT 5
)
RETURNS TABLE(id UUID, content TEXT, category TEXT, created_at TIMESTAMPTZ, similarity FLOAT)
```
Returns top-K entries ordered by cosine similarity (`1 - (embedding <=> p_embedding)`).

### `get_active_subscription`
```sql
get_active_subscription(p_user_id UUID)
RETURNS TABLE(id UUID, tier TEXT, status TEXT, start_date TIMESTAMPTZ, end_date TIMESTAMPTZ)
```

### `has_premium_access`
```sql
has_premium_access(p_user_id UUID) RETURNS BOOLEAN
```
Returns true if `subscription_tier IN ('stars_basic', 'stars_pro')`.

### `upgrade_subscription`
```sql
upgrade_subscription(
  p_user_id UUID,
  p_tier TEXT,
  p_telegram_payment_charge_id TEXT,
  p_provider_payment_charge_id TEXT
) RETURNS UUID
```
Creates subscription row and updates profile tier atomically.

### `downgrade_subscription`
```sql
downgrade_subscription(p_user_id UUID) RETURNS VOID
```
Cancels active subscription and resets profile to free tier.

### `get_user_usage_counts`
Returns `{ entries: INT, widgets: INT, reports: INT }` for paywall enforcement.

---

## RLS Policies

All tables use the same pattern:
```sql
CREATE POLICY <table>_owner ON <table>
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

- Bot operations use the **service role key** (bypasses RLS)
- Mini App operations use the **user JWT** (enforced by RLS)
- Cron jobs use the **service role key**

---

## Migrations Order

```
20240001000000_initial_schema.sql       — profiles, entries, insights
20240001000001_*                        — additional indexes
20240001000003_threads.sql              — thread_id, reply_to_entry_id, bot_reply
20240001000004_open_categories.sql      — categories table, open-ended category column
20240001000005_reminders_todos.sql      — reminders, todos
20240001000007_reports.sql              — reports table
20240001000008_retro_columns.sql        — went_well, didnt_go_well, etc.
20240001000009_hnsw_tuning.sql          — HNSW index parameters
20240001000010_memory_and_alltime_search.sql — memory functions
20240001000011_stars_paywall.sql        — subscriptions, transactions, invoices
20240001000012_grant_free_access.sql    — free access grants
20240001000015_subscription_start_date.sql — subscription_start_date column
```
