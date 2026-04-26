# API Reference — Memo

All mini app routes require `Authorization: Bearer <supabase_jwt>`.
Cron routes require `Authorization: Bearer <CRON_SECRET>`.

---

## Authentication

### `POST /api/auth/telegram`
**Runtime:** Edge

Verifies Telegram `initData` HMAC-SHA256 signature and returns a Supabase JWT.

**Request body:**
```json
{ "initData": "auth_date=...&hash=...&user=..." }
```

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "...",
  "user": { "id": "uuid", "email": "telegram_123@memo.app" }
}
```

**Response 401:** Invalid or expired initData (>24h old).

---

## Entries

### `GET /api/entries`
**Runtime:** Edge

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 50 | Max entries to return |
| `offset` | number | 0 | Pagination offset |
| `category` | string | — | Filter by category |
| `from` | ISO date | — | Start date filter |
| `to` | ISO date | — | End date filter |

**Response 200:**
```json
{
  "entries": [
    {
      "id": "uuid",
      "content": "decrypted content",
      "category": "calories",
      "category_label": "Калорії",
      "metadata": { "dashboard_metrics": [...] },
      "created_at": "2025-04-26T10:00:00Z",
      "bot_reply": "decrypted reply",
      "thread_id": "uuid",
      "reply_to_entry_id": null
    }
  ],
  "total": 42
}
```

**Response 402:** Tier limit exceeded.
```json
{ "error": "Entry limit reached", "feature": "entries", "current": 100, "limit": 100, "required_tier": "stars_basic" }
```

---

### `PATCH /api/entries`
**Runtime:** Edge

Update entry content and/or category. Re-computes `dashboard_metrics` via Gemini.

**Request body:**
```json
{ "id": "uuid", "content": "updated text", "category": "workout" }
```

**Response 200:**
```json
{ "entry": { "id": "uuid", "content": "...", "category": "workout", "metadata": {...} } }
```

---

### `DELETE /api/entries`
**Runtime:** Edge

Bulk delete entries by IDs.

**Request body:**
```json
{ "ids": ["uuid1", "uuid2"] }
```

**Response 200:**
```json
{ "deleted": 2 }
```

---

## Categories

### `GET /api/categories`
**Runtime:** Edge

Returns all user categories (built-in + custom).

**Response 200:**
```json
{
  "categories": [
    { "id": "uuid", "name": "calories", "label_ua": "Калорії", "color": "bg-orange-100 text-orange-700", "icon": "flame" }
  ]
}
```

---

### `POST /api/categories`
Create a new custom category.

**Request body:**
```json
{ "name": "meditation", "label_ua": "Медитація", "color": "bg-teal-100 text-teal-700", "icon": "sparkles" }
```

---

### `PATCH /api/categories/[id]`
Update category label, color, or icon.

---

### `DELETE /api/categories/[id]`
Delete a custom category.

---

### `POST /api/categories/merge`
Merge two categories into one.

**Request body:**
```json
{ "source_id": "uuid", "target_id": "uuid" }
```

---

## Graph

### `GET /api/graph`
**Runtime:** Node.js

Returns knowledge graph payload for D3 visualization.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `from` | ISO date | Start date filter |
| `to` | ISO date | End date filter |

**Response 200:**
```json
{
  "nodes": [
    { "id": "uuid", "label": "entry content", "category": "workout", "categories": ["workout"], "created_at": "...", "edge_count": 3 }
  ],
  "edges": [
    { "source": "uuid1", "target": "uuid2", "weight": 0.82, "type": "branch" }
  ]
}
```

**Edge types:**
- `branch` — same semantic cluster (solid indigo line)
- `similarity` — cosine similarity > 0.55 (dashed gray)
- `cross_category` — same category, similarity > 0.45 (amber)

---

## Reports

### `GET /api/reports`
**Runtime:** Node.js

**Response 200:**
```json
{
  "reports": [
    {
      "id": "uuid",
      "period_type": "weekly",
      "period_from": "2025-04-20T00:00:00Z",
      "period_to": "2025-04-26T23:59:59Z",
      "summary": "Продуктивний тиждень...",
      "went_well": "...",
      "didnt_go_well": "...",
      "start_stop_continue": "...",
      "experiment": "...",
      "lesson": "...",
      "insights": [],
      "created_at": "..."
    }
  ]
}
```

---

### `POST /api/reports`
**Runtime:** Node.js (60s timeout)

Generate a new retrospective report.

**Request body:**
```json
{
  "period_type": "weekly",
  "period_from": "2025-04-20T00:00:00Z",
  "period_to": "2025-04-26T23:59:59Z"
}
```

**Response 200:** Full report object (same as GET item).

**Response 402:** Report limit exceeded.

---

### `DELETE /api/reports`
**Request body:** `{ "id": "uuid" }`

---

## Profile

### `GET /api/profile`
**Runtime:** Edge

**Response 200:**
```json
{
  "profile": {
    "id": "uuid",
    "telegram_id": 123456789,
    "username": "john_doe",
    "subscription_tier": "stars_basic",
    "subscription_status": "active",
    "subscription_ends_at": "2025-05-26T00:00:00Z",
    "settings": {}
  }
}
```

---

### `GET /api/profile/usage`
**Runtime:** Edge

**Response 200:**
```json
{ "entries": 45, "widgets": 3, "reports": 2 }
```

---

### `DELETE /api/profile/delete`
**Runtime:** Node.js

Deletes user account and all associated data (entries, reports, categories, subscriptions).

---

## Widgets

### `GET /api/widgets`
**Runtime:** Edge

Returns custom widgets from `profiles.settings.custom_widgets`.

---

### `POST /api/widgets`
**Runtime:** Node.js

Create a custom dashboard widget.

**Request body (direct):**
```json
{
  "direct": {
    "id": "water_ml",
    "title": "Вода",
    "metric_key": "water_ml",
    "unit": "мл",
    "emoji": "💧",
    "iconColor": "cyan",
    "aggregate": "sum",
    "goal": 2000
  }
}
```

**Request body (AI-generated):**
```json
{
  "prompt": "track my meditation minutes",
  "answers": { "question": "Meditation", "unit": "хв", "goal": 20 }
}
```

**Response 402:** Widget limit exceeded.

---

## Stars Payments

### `POST /api/stars/invoice`
**Runtime:** Node.js

Create a Telegram Stars invoice link.

**Request body:**
```json
{ "tier": "stars_basic", "billingPeriod": "monthly" }
```

**Response 200:**
```json
{ "ok": true, "invoiceLink": "https://t.me/$invoice..." }
```

---

### `POST /api/stars/webhook`
**Runtime:** Node.js

Handles Telegram `pre_checkout_query` and `successful_payment` webhooks.

- `pre_checkout_query` → always answer OK
- `successful_payment` → call `createSubscription()`, update profile tier

---

## Cron

### `GET /api/cron/process`
**Runtime:** Node.js

Daily processing: clustering, widget generation, streak auto-increment.
Requires `Authorization: Bearer <CRON_SECRET>`.

---

### `GET /api/cron/reports`
**Runtime:** Node.js

Deliver scheduled reports to opted-in users.
Requires `Authorization: Bearer <CRON_SECRET>`.

---

## Telegram Webhook

### `POST /api/telegram/webhook`
**Runtime:** Edge

grammY webhook handler. Processes all Telegram updates (messages, callbacks, payments).
Verified by Telegram's webhook secret token.
