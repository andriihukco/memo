# Project Overview — Memo

## Vision

Memo is the personal diary that thinks alongside you. It lives inside Telegram — the app you already use every day — and turns your casual messages into a structured, searchable, AI-analyzed record of your life.

No forms. No manual tagging. No separate app to open. Just write or speak naturally, and Memo handles the rest.

---

## Mission

Make self-tracking effortless and insightful for people who want to understand their own patterns — health, finances, emotions, habits — without the friction of traditional journaling or fitness apps.

---

## Core Value Proposition

| Problem | Memo's Solution |
|---------|----------------|
| Journaling apps require too much effort | Send a Telegram message — done |
| Fitness trackers only cover one domain | One place for food, workouts, mood, money, thoughts |
| Data is siloed across apps | Unified AI-analyzed timeline |
| Insights require manual analysis | Automatic retrospectives and pattern detection |
| Privacy concerns with cloud apps | Client-side encryption before storage |

---

## Product Surfaces

### 1. Telegram Bot (`@memo_bot`)
The primary input interface. Users send free-form text or voice messages. The bot:
- Classifies intent (diary entry, question, action, smalltalk)
- Extracts structured metrics automatically
- Replies conversationally in the user's own tone
- Answers questions about past entries using semantic search
- Generates retrospective reports on demand

### 2. Telegram Mini App (`/miniapp`)
The analytics and management interface, opened from within Telegram. Five tabs:
- **Feed** — scrollable diary with swipe-to-delete, thread grouping, category filters
- **Dashboard** — metric widgets, date range analytics, goals progress
- **Graph** — D3 force-directed knowledge graph of semantically linked entries
- **Reports** — AI retrospectives with activity stats
- **Settings** — passcode lock, subscription management, categories

---

## User Personas

### Primary: "The Self-Optimizer" (25–35)
- Tracks calories, workouts, sleep, mood
- Uses multiple apps today (MyFitnessPal, Notion, Daylio)
- Wants one place, minimal friction
- Values data privacy
- Pays for tools that save time

### Secondary: "The Reflective Professional" (28–40)
- Journals thoughts, work wins, ideas
- Wants to look back and find patterns
- Appreciates AI-generated retrospectives
- Uses Telegram heavily for work

### Tertiary: "The Budget Tracker" (22–32)
- Logs expenses casually ("spent 200 on groceries")
- Wants automatic categorization and monthly summaries
- Free tier user, potential upgrade for analytics

---

## Key Differentiators

1. **Zero-friction input** — Telegram is already open; no app switch required
2. **Multimodal** — text and voice, any language
3. **Decomposition intelligence** — "ran 5km" → 4 metrics automatically (distance, kcal, time, steps)
4. **Semantic memory** — RAG-powered Q&A over your own diary ("how much did I sleep last week?")
5. **Agile retrospectives** — structured 5-section reports, not just summaries
6. **Knowledge graph** — visual map of how your entries connect
7. **Client-side encryption** — even the server can't read your diary
8. **Telegram Stars payments** — no credit card, no external payment processor

---

## Business Model

| Tier | Name | Price | Target |
|------|------|-------|--------|
| Free | Memo Spark ✨ | 0 | Acquisition, habit formation |
| Basic | Memo Nova 🌟 | 250 ⭐/mo (~$3.50) | Core paying users |
| Pro | Memo Supernova 💫 | 500 ⭐/mo (~$7) | Power users, privacy-focused |

Billing periods: monthly, quarterly (−15%), annual (−30%).

Revenue model: subscription SaaS via Telegram Stars (no payment processor fees, instant settlement).

---

## Current Status (April 2026)

- ✅ Bot fully functional (text + voice, all intents)
- ✅ Mini App with 5 tabs deployed
- ✅ Subscription system live (Stars payments)
- ✅ Encryption, passcode lock
- ✅ Knowledge graph
- ✅ Retrospective reports
- ⚠️ Limited test coverage
- ⚠️ No data export
- ⚠️ No rate limiting
- ⚠️ Feed pagination limited to 100 entries
