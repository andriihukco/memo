# Architecture — Memo

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Telegram User                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │ text / voice / button tap
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Telegram Bot API                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │ webhook POST
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│          /api/telegram/webhook  (Edge runtime, grammY)          │
│                                                                 │
│  ┌─────────────────┐   ┌──────────────────┐                    │
│  │  Text Handler   │   │  Voice Handler   │                    │
│  │  (handlers/text)│   │ (handlers/voice) │                    │
│  └────────┬────────┘   └────────┬─────────┘                    │
│           │                     │                               │
│           └──────────┬──────────┘                               │
│                      ▼                                          │
│              classify() / classifyAudio()                       │
│              [Gemini 2.5 Flash]                                 │
│                      │                                          │
│          ┌───────────┼───────────────┐                          │
│          ▼           ▼               ▼                          │
│    answerQuestion  handleAction  generateConverseReply          │
│    [RAG + Gemini]  [delete/widget] [Gemini + tone]              │
│                                                                 │
│    embedEntry() ← async, non-blocking                           │
│    [gemini-embedding-001 → pgvector → insight]                  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL + pgvector)                   │
│                                                                 │
│  profiles · entries (vector 768) · insights · categories       │
│  reports · subscriptions · reminders · todos                   │
│                                                                 │
│  HNSW index on entries.embedding (cosine similarity)           │
│  RLS: all tables, auth.uid() isolation                         │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel Cron Jobs                             │
│                                                                 │
│  00:00 UTC → /api/cron/process                                 │
│    clusterEntries() · buildAndSaveWidgets() · autoStreaks()    │
│                                                                 │
│  09:00 UTC → /api/cron/reports                                 │
│    Deliver scheduled reports to opted-in users                 │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Telegram Mini App (Next.js /miniapp/*)             │
│                                                                 │
│  /miniapp          → Feed (entry list)                         │
│  /miniapp/dashboard → Metrics dashboard                        │
│  /miniapp/graph    → D3 knowledge graph                        │
│  /miniapp/reports  → Retrospectives                            │
│  /miniapp/settings → Passcode / Subscription                   │
│  /miniapp/subscriptions → Plan management                      │
│  /miniapp/categories → Category management                     │
│  /miniapp/onboarding → First-run flow                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Runtime Split

| Route | Runtime | Reason |
|-------|---------|--------|
| `/api/telegram/webhook` | Edge | Low latency, grammY compatible |
| `/api/auth/telegram` | Edge | Fast HMAC verification |
| `/api/entries` | Edge | Simple CRUD, RLS via JWT |
| `/api/categories` | Edge | Simple CRUD |
| `/api/graph` | Node.js | Complex pgvector queries |
| `/api/reports` | Node.js | 60s timeout for AI generation |
| `/api/stars/*` | Node.js | Payment processing |
| `/api/cron/*` | Node.js | Long-running batch jobs |
| `/api/widgets` | Node.js | AI widget generation |
| `/api/profile/*` | Edge/Node | Mixed |

---

## Data Flow: Message Processing

```
User sends "ate 200g chicken breast and 150g rice"
                    │
                    ▼
         classify() → Gemini 2.5 Flash
                    │
                    ▼
         {
           intent: "save_entry",
           category: "calories",
           content: "ate 200g chicken breast and 150g rice",
           dashboard_metrics: [
             { key: "kcal_intake", value: 525, unit: "ккал", aggregate: "sum" },
             { key: "protein_g",   value: 68,  unit: "г",    aggregate: "sum" },
             { key: "carbs_g",     value: 42,  unit: "г",    aggregate: "sum" },
             { key: "fat_g",       value: 7.7, unit: "г",    aggregate: "sum" }
           ]
         }
                    │
                    ▼
         encrypt(content) → store in entries table
                    │
                    ├──→ generateConverseReply() → send to user
                    │
                    └──→ embedEntry() [async]
                              │
                              ▼
                         gemini-embedding-001 → 768-dim vector
                              │
                              ▼
                         find_similar_entries() RPC
                              │
                         if similarity > 0.75:
                              ▼
                         generateInsight() → send insight to user
```

---

## Data Flow: Mini App Authentication

```
User opens Mini App in Telegram
        │
        ▼
window.Telegram.WebApp.initData (signed by Telegram)
        │
        ▼
POST /api/auth/telegram
  verifyInitData() — HMAC-SHA256 with bot token
  check auth_date < 24h
        │
        ▼
signInWithPassword(telegram_<id>@memo.app, deterministicPassword)
        │
        ▼
Supabase JWT returned → stored in React AuthContext
        │
        ▼
All API calls: Authorization: Bearer <jwt>
RLS enforces user isolation via auth.uid()
```

---

## Infrastructure

| Service | Provider | Purpose |
|---------|----------|---------|
| Hosting | Vercel | Next.js deployment, Edge functions, Cron |
| Database | Supabase | PostgreSQL + pgvector + Auth + RLS |
| AI/LLM | Google AI Studio | Gemini 2.5 Flash (classification, generation) |
| Embeddings | Google AI Studio | gemini-embedding-001 (768-dim) |
| Bot | Telegram Bot API | Webhook delivery |
| Payments | Telegram Stars | In-app purchases (XTR currency) |

---

## Key Architectural Decisions

### 1. Synthetic Supabase Auth
Each Telegram user gets a synthetic Supabase Auth account (`telegram_<id>@memo.app`). This allows RLS policies to use `auth.uid()` consistently for both bot (service role) and mini app (user JWT) access paths.

### 2. Async Embedding
Embeddings are generated after the bot reply is sent. This keeps response latency low (~1-2s) while the 768-dim vector computation happens in the background.

### 3. Edge Runtime for Bot
The webhook handler runs on Vercel Edge for minimal cold-start latency. grammY is compatible with the Web Crypto API used for HMAC verification.

### 4. Client-Side Encryption
Entry content is encrypted using AES-GCM with a key derived from the user's Telegram ID before being stored. The server never sees plaintext content.

### 5. pgvector HNSW Index
The HNSW index (`m=16, ef_construction=64`) provides approximate nearest-neighbor search in O(log n) time, enabling real-time semantic similarity queries even at scale.
