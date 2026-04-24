# Bugfix Requirements Document

## Introduction

Memo is an AI personal diary Telegram bot + mini-app that classifies voice/text input, extracts structured metrics, stores everything in Supabase, and answers natural-language questions about past entries. After growing in usage, the system has accumulated a cluster of reliability, correctness, and performance bugs across the full pipeline: bot message handling, AI classification, embedding/RAG, data integrity, and the mini-app frontend. This document captures all defective behaviors and the correct behaviors that must replace them, along with the existing behaviors that must be preserved.

---

## Bug Analysis

### Current Behavior (Defect)

**Bot Reliability**

1.1 WHEN a user sends a short contextual reply (e.g. "2 ложки") inside a thread THEN the system classifies it without thread context, causing wrong intent detection and missing metrics

1.2 WHEN the Gemini classification API returns a response that is not valid JSON (e.g. wrapped in markdown fences or with trailing text) THEN the system throws an unhandled JSON.parse exception and the message is lost with no user feedback

1.3 WHEN the Gemini classification API returns an intent value not in the allowed enum THEN the system silently coerces it to `save_entry` without logging, potentially saving garbage entries

1.4 WHEN `classifyAudio` is called and the audio download from Telegram CDN fails with a non-200 HTTP status THEN the system throws an unhandled error that propagates past the voice handler and crashes the webhook response

1.5 WHEN the bot sends a reply and `sent.message_id` is undefined (e.g. due to a Telegram API rate limit or transient error) THEN the system stores `bot_msg_id: null` in metadata, permanently breaking thread linking for that entry

1.6 WHEN `resolveThread` queries entries by `metadata @> {bot_msg_id: N}` and the entry's metadata has `bot_msg_id` stored as a string instead of a number THEN the containment check fails silently and the thread is not resolved, creating orphaned entries

1.7 WHEN `withTypingIndicator` is running and the inner async function throws THEN the typing loop continues running indefinitely because `active = false` is only set in the `finally` block but the loop's `while(active)` check is not awaited — the loop is fire-and-forget and leaks

1.8 WHEN `handleTextMessage` saves multiple entries (multi-intent) and the DB insert for entry N > 1 fails THEN the system returns an error reply to the user but entries 1..N-1 are already committed, leaving partial data with no rollback

**Performance**

1.9 WHEN a user sends any message THEN the system makes 3 sequential Gemini API calls (classify pass 1 → classify pass 2 metrics → converse reply) plus 2 Supabase queries before responding, causing P95 latency > 8 seconds

1.10 WHEN `clusterEntries` runs in the daily cron for a user with 500+ entries THEN the system calls `find_similar_entries` RPC once per entry (N+1 query pattern), causing the cron to time out on Vercel's 60-second function limit

1.11 WHEN `buildAndSaveWidgets` runs THEN it fires 6 parallel Gemini calls (mood trend + 3 summaries + life themes + insight clusters) with no concurrency limit, causing rate-limit errors that silently produce empty/stale widgets

**Data Integrity**

1.12 WHEN `embedEntry` exhausts all 3 retry attempts and sets `embedding_status = 'failed'` THEN the entry remains in the database with no embedding and is never retried by the daily cron, making it permanently invisible to semantic search and RAG

1.13 WHEN `saveMemory` reads `profiles.settings`, merges the memory map, and writes back THEN a concurrent bot message from the same user can overwrite the settings with a stale read, causing memory facts to be silently lost (read-modify-write race condition)

1.14 WHEN `buildAndSaveWidgets` reads `profiles.settings` and writes back `{...currentSettings, dashboard_widgets: widgets}` THEN a concurrent `saveMemory` call can overwrite the widget update with stale settings, or vice versa (same race condition on `profiles.settings`)

1.15 WHEN the daily cron `autoIncrementStreaks` checks for a today entry using `.maybeSingle()` on category alone THEN it may match an unrelated entry in the same category (e.g. a food entry in `health`) and skip the streak increment, silently breaking streak tracking

1.16 WHEN `generateInsight` fails to persist to the `insights` table THEN the error is logged but the function returns the insight text anyway, causing the insight to be shown to the user (if `sendMessage` is wired) but not stored — creating a phantom insight

**RAG Quality**

1.17 WHEN a user asks a question with a temporal filter (e.g. "що я їв вчора") and the semantic search returns 0 results above the 0.45 threshold THEN the system falls back to `fetchStructuredEntries` which queries without `metadata` field, causing the answer synthesis to have no calorie/macro data and produce an incomplete answer

1.18 WHEN `retrieveEntries` is called with both a temporal filter and a category filter THEN the pgvector RPC `find_similar_entries` is called without those filters applied at the DB level, fetching up to 15 entries from all time and all categories, then filtering in-memory — causing the wrong entries to be returned when the user has many entries

1.19 WHEN `rerankEntries` calls Gemini to score candidates and the response JSON is malformed THEN the function falls back to `entries.slice(0, topK)` which returns the first 5 by cosine similarity order, not the most relevant — silently degrading answer quality

1.20 WHEN `resolveTemporalFilter` parses "цього місяця" or "this month" THEN it uses `startOfLocalMonth` which sets `setUTCDate(1)` on the already-shifted local date, but the shift is applied before the date manipulation, causing the month boundary to be off by the UTC offset hours (3 hours) for users near midnight

**Error Handling**

1.21 WHEN any Supabase query in `handleTextMessage` or `handleVoiceMessage` returns an error other than the insert error THEN the error is not caught and propagates as an unhandled promise rejection, crashing the webhook handler and returning a 500 to Telegram (causing Telegram to retry the update)

1.22 WHEN `generateConverseReply` is called and the Gemini API throws (rate limit, network error, etc.) THEN the error propagates to the webhook handler with no fallback reply, leaving the user with no response and Telegram retrying the update

1.23 WHEN `answerQuestion` calls `generateEmbedding` and it throws `EmbeddingError` THEN the catch block logs a warning and falls back to `fetchStructuredEntries`, but if `fetchStructuredEntries` also throws (e.g. Supabase is down) THEN the outer try/catch calls Gemini with no entries — which may hallucinate an answer

1.24 WHEN the webhook handler receives a Telegram update that is not a text or voice message (e.g. a photo, sticker, document, or edited message) THEN grammY silently drops it with no handler registered, but the bot also sends no acknowledgment — acceptable for most types but edited messages that were originally diary entries are silently ignored

**Edge Runtime / SDK**

1.25 WHEN the webhook route uses `export const runtime = "nodejs"` THEN it correctly avoids Edge runtime issues with the Gemini SDK, but `src/app/api/entries/route.ts`, `src/app/api/graph/route.ts`, `src/app/api/categories/route.ts`, and `src/app/api/auth/telegram/route.ts` all use `export const runtime = "edge"` (default) — the Gemini SDK's `@google/generative-ai` uses Node.js `crypto` and `Buffer` APIs that are not available in the Edge runtime, causing silent failures when those routes call Gemini

1.26 WHEN `src/app/api/entries/route.ts` handles a PATCH request to update an entry THEN it re-classifies the content via Gemini to recompute metrics — this call happens in the Edge runtime (see 1.25) and will fail silently, leaving the entry with stale metrics after an edit

**Metric Decomposition**

1.27 WHEN the classifier extracts `kcal_burned` for a running entry using the formula `80 kcal/km` THEN it also extracts `kcal_intake` from the same entry if the user mentioned food in the same message, causing the energy balance card to double-count calories burned as intake

1.28 WHEN the metrics extractor receives a food entry with multiple items (e.g. "4 яйця, 200г курки, 50г рису") THEN it sometimes returns separate `kcal_intake` entries per food item instead of a single summed entry, causing the dashboard to show multiple `kcal_intake` metric cards instead of one aggregated total

1.29 WHEN `aggregateMetrics` in the dashboard processes entries with `aggregate: "last"` metrics (e.g. `weight_kg`, `sleep_quality`) THEN it takes `values[values.length - 1]` which is the last value in iteration order — but entries are fetched `order by created_at desc`, so `values[values.length - 1]` is actually the oldest value, not the most recent

**Thread / Conversation Continuity**

1.30 WHEN a user replies to a bot message and `resolveThread` finds the parent entry THEN the system sets `thread_id = parentEntry.id` if `parentEntry.thread_id` is null — but if the parent entry was itself a reply (i.e. it has a `reply_to_entry_id`), the thread root is not correctly propagated, creating a broken chain where entries in the same conversation have different `thread_id` values

1.31 WHEN `loadThreadContext` loads thread messages for the conversational reply THEN it includes the current message being processed (since it was just inserted with the same `thread_id`), causing the model to see the user's current message twice in the prompt

**Mini-App**

1.32 WHEN the mini-app layout authenticates via `/api/auth/telegram` and the Telegram `initData` is empty (e.g. during local development or when the WebApp is opened outside Telegram) THEN the auth endpoint returns a 401 and the mini-app shows a permanent "Не вдалося увійти" error with no retry mechanism

1.33 WHEN `groupByThread` processes entries THEN it iterates `entries` twice — once to build `threadMap` and once to build `result` — but the second loop pushes a `ThreadGroup` for the first entry in a thread and then marks all thread members as `seen`, causing threads where the first entry in the fetched list is not the thread root to be displayed in wrong order

1.34 WHEN the dashboard `aggregateMetrics` function processes entries with `aggregate: "avg"` metrics THEN it divides by `values.length` which counts all entries in the date range — but if the user logged sleep twice in one day (e.g. a nap + night sleep), the average is computed across both, which is correct, but the `count` label shows "середнє · 2" which is confusing and may be misread as 2 hours

---

### Expected Behavior (Correct)

**Bot Reliability**

2.1 WHEN a user sends a short contextual reply inside a thread THEN the system SHALL load the thread context before classification and pass it to `classifyAudio`/`classify` so short replies are understood in context

2.2 WHEN the Gemini API returns a non-JSON response THEN the system SHALL strip markdown fences, attempt JSON.parse, and on failure SHALL retry the classification call up to 2 times before returning a `ClassificationError` with the raw response logged

2.3 WHEN the Gemini API returns an unrecognized intent value THEN the system SHALL log a warning with the raw value and SHALL default to `save_entry` only if the content field is non-empty, otherwise SHALL default to `converse`

2.4 WHEN the audio download from Telegram CDN fails THEN the system SHALL catch the error, log it with the entry ID and HTTP status, and SHALL reply to the user with a localized error message without crashing the webhook

2.5 WHEN `ctx.reply()` returns a message with a missing or undefined `message_id` THEN the system SHALL log a warning and SHALL NOT store `bot_msg_id` in metadata (omit the key entirely), so thread resolution gracefully handles the missing link

2.6 WHEN `resolveThread` queries entries by `bot_msg_id` THEN the system SHALL cast the stored value to a number before comparison, and SHALL also query with the value as a string to handle both storage formats

2.7 WHEN `withTypingIndicator` is used THEN the typing loop SHALL be implemented as a self-cancelling interval that is cleared in the `finally` block, preventing any resource leak

2.8 WHEN `handleTextMessage` saves multiple entries and a DB insert fails for entry N THEN the system SHALL attempt to delete already-inserted entries (best-effort cleanup), log the partial failure with all entry IDs, and SHALL reply to the user with an error message

**Performance**

2.9 WHEN a user sends a message THEN the system SHALL run classification pass 1 (intent), user context load, and thread resolution in parallel, and SHALL only run metrics extraction (pass 2) after intent is confirmed as `save_entry` or `converse`, reducing sequential Gemini calls

2.10 WHEN `clusterEntries` runs for a user THEN the system SHALL batch the similarity queries using the pgvector `find_similar_entries` RPC with a single query per cluster candidate rather than per entry, or SHALL use a time-windowed approach that only re-clusters entries modified since the last run

2.11 WHEN `buildAndSaveWidgets` runs THEN the system SHALL limit concurrent Gemini calls to a maximum of 3 at a time using a concurrency-limited Promise pool, preventing rate-limit errors

**Data Integrity**

2.12 WHEN `embedEntry` exhausts all retry attempts and marks an entry as `embedding_status = 'failed'` THEN the daily cron SHALL include a step that retries all `failed` embeddings, ensuring no entry is permanently excluded from semantic search

2.13 WHEN `saveMemory` updates the memory map THEN the system SHALL use a Supabase RPC or a conditional update (`UPDATE profiles SET settings = jsonb_set(settings, '{memory}', ...) WHERE id = $1`) to perform an atomic merge, preventing the read-modify-write race condition

2.14 WHEN `buildAndSaveWidgets` updates dashboard widgets THEN the system SHALL use `jsonb_set` to update only the `dashboard_widgets` key within `settings`, not overwrite the entire `settings` object

2.15 WHEN `autoIncrementStreaks` checks for an existing today entry THEN the system SHALL filter by both `category` AND the presence of a streak metric key in `metadata->dashboard_metrics`, not just category alone

2.16 WHEN `generateInsight` fails to persist to the `insights` table THEN the system SHALL return `null` (not the insight text) so no phantom insight is surfaced to the user

**RAG Quality**

2.17 WHEN the semantic search fallback path is taken THEN `fetchStructuredEntries` SHALL always select the `metadata` field so calorie/macro data is available for answer synthesis

2.18 WHEN `retrieveEntries` is called with temporal and/or category filters THEN the system SHALL apply those filters inside the pgvector RPC call (or via a filtered SQL query) rather than fetching all-time entries and filtering in memory

2.19 WHEN `rerankEntries` receives a malformed Gemini response THEN the system SHALL log the raw response for debugging and SHALL fall back to the original cosine-similarity order with a warning, not silently degrade

2.20 WHEN `resolveTemporalFilter` computes month boundaries THEN the system SHALL compute the UTC equivalent of local midnight on the 1st of the current month correctly, using a single timezone-aware calculation that does not apply the UTC offset twice

**Error Handling**

2.21 WHEN any Supabase query in the message handlers returns an error THEN the system SHALL catch it, log it with context (user ID, entry content truncated), and SHALL reply to the user with a localized error message, preventing unhandled rejections

2.22 WHEN `generateConverseReply` throws THEN the system SHALL catch the error, log it, and SHALL reply with a short fallback message (e.g. "Записав! ✓") so the user knows their entry was saved even if the AI reply failed

2.23 WHEN the embedding fallback path in `answerQuestion` is taken and `fetchStructuredEntries` also throws THEN the system SHALL return a safe error message to the user rather than calling Gemini with no context and risking a hallucinated answer

2.24 WHEN the bot receives an edited message that was originally a diary entry THEN the system SHALL handle the `edited_message` update by re-classifying the new text and updating the existing entry in the database

**Edge Runtime / SDK**

2.25 WHEN any API route calls the Gemini SDK THEN the route SHALL declare `export const runtime = "nodejs"` to ensure Node.js APIs are available, preventing silent failures in Edge runtime

2.26 WHEN the entries PATCH route re-classifies content to recompute metrics THEN it SHALL run in the Node.js runtime (see 2.25) and SHALL correctly update `metadata.dashboard_metrics` and `metadata.goal_metrics` in the database

**Metric Decomposition**

2.27 WHEN the classifier processes a message containing both food and exercise THEN the system SHALL ensure `kcal_burned` (from exercise) and `kcal_intake` (from food) are stored in separate entries with their respective categories, not merged into a single entry's metrics

2.28 WHEN the metrics extractor processes a multi-item food entry THEN the system SHALL return a single `kcal_intake` metric with the summed total, and individual per-item metrics SHALL be stored as separate keys (e.g. `protein_g`, `carbs_g`) that are also summed

2.29 WHEN `aggregateMetrics` processes `aggregate: "last"` metrics THEN the system SHALL take the value from the entry with the most recent `created_at` timestamp, not the last element in the array (which may be the oldest due to descending fetch order)

**Thread / Conversation Continuity**

2.30 WHEN `resolveThread` finds a parent entry that itself has a `reply_to_entry_id` THEN the system SHALL walk up the chain to find the true thread root and SHALL use that root's ID as the `thread_id` for all entries in the conversation

2.31 WHEN `loadThreadContext` loads thread messages THEN the system SHALL exclude the entry that was just inserted (by ID) so the current message does not appear twice in the prompt

**Mini-App**

2.32 WHEN the mini-app auth fails due to empty `initData` THEN the system SHALL display a retry button and SHALL provide a development mode bypass (configurable via env var) that allows local testing without Telegram context

2.33 WHEN `groupByThread` builds the result list THEN the system SHALL sort thread entries by `created_at` ascending before grouping, ensuring the thread root is always the first entry processed and threads are displayed in chronological order

2.34 WHEN the dashboard displays `aggregate: "avg"` metrics THEN the system SHALL show the count as "за N записів" (e.g. "за 2 записи") rather than "середнє · N" to avoid confusion with the metric value

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user sends a complete diary entry with sufficient detail (e.g. "з'їв 200г курки і 50г рису") THEN the system SHALL CONTINUE TO classify it as `save_entry`, extract correct macros, save the entry, and reply conversationally

3.2 WHEN a user asks a question about past entries (e.g. "скільки я витратив цього тижня?") THEN the system SHALL CONTINUE TO route it as `question`, perform RAG retrieval, and return a synthesized answer

3.3 WHEN a user sends a voice message THEN the system SHALL CONTINUE TO download the audio, transcribe and classify it via Gemini multimodal, and process it identically to a text message

3.4 WHEN a user sends a smalltalk message (greeting, thanks) THEN the system SHALL CONTINUE TO reply conversationally without saving an entry

3.5 WHEN a user sends an action command (e.g. "видали записи про сон за сьогодні") THEN the system SHALL CONTINUE TO route it as `action` and execute the appropriate handler

3.6 WHEN a new entry is saved THEN the system SHALL CONTINUE TO asynchronously generate an embedding and trigger the RAG insight pipeline without blocking the bot reply

3.7 WHEN the daily cron runs THEN the system SHALL CONTINUE TO cluster entries by semantic similarity, build dashboard widgets, and auto-increment active streaks

3.8 WHEN the mini-app Feed page loads THEN the system SHALL CONTINUE TO display entries grouped by thread, support swipe-to-delete, long-press multi-select, and category filtering

3.9 WHEN the mini-app Dashboard page loads THEN the system SHALL CONTINUE TO aggregate metrics from entries in the selected date range and display energy balance, finance, mood, and goals sections

3.10 WHEN the mini-app Graph page loads THEN the system SHALL CONTINUE TO render the D3 force-directed knowledge graph with branch and similarity edges

3.11 WHEN the mini-app Reports page generates a retrospective THEN the system SHALL CONTINUE TO call the Gemini retrospective pipeline and display all 5 agile retro sections

3.12 WHEN the passcode lock is enabled THEN the system SHALL CONTINUE TO lock the mini-app on open and after the configured auto-lock timeout

3.13 WHEN `resolveOrCreateProfile` is called for a new Telegram user THEN the system SHALL CONTINUE TO create a Supabase Auth user and a matching profile row with the correct UUID alignment for RLS

3.14 WHEN the `/report` command is used THEN the system SHALL CONTINUE TO generate and send a formatted retrospective report with rotating status messages

3.15 WHEN `extractFacts` finds persistent personal facts in a message THEN the system SHALL CONTINUE TO save them to `profiles.settings.memory` and inject them into future conversational replies

---

## Bug Condition Pseudocode

```pascal
// ── Fix Checking Properties ──────────────────────────────────────────────────

FUNCTION isBugCondition_ThreadContext(X)
  INPUT: X = (message, thread_id)
  RETURN X.thread_id IS NOT NULL AND length(X.message) < 20
END FUNCTION

// Property: Short replies in threads are classified with context
FOR ALL X WHERE isBugCondition_ThreadContext(X) DO
  result ← classify'(X.message, threadContext: loadThreadContext(X.thread_id))
  ASSERT result.intent ≠ "save_entry" OR result.content contains meaningful data
END FOR

FUNCTION isBugCondition_EmbeddingFailed(X)
  INPUT: X = entry row
  RETURN X.embedding_status = 'failed'
END FUNCTION

// Property: Failed embeddings are retried by cron
FOR ALL X WHERE isBugCondition_EmbeddingFailed(X) DO
  runDailyCron()
  ASSERT X.embedding_status' ∈ {'done', 'failed_permanent'}
  ASSERT X.embedding_status' ≠ 'failed'  // must have been attempted
END FOR

FUNCTION isBugCondition_RaceCondition(X)
  INPUT: X = (userId, concurrent_writes: integer)
  RETURN X.concurrent_writes > 1
END FUNCTION

// Property: Concurrent memory writes do not lose data
FOR ALL X WHERE isBugCondition_RaceCondition(X) DO
  results ← parallel(saveMemory'(X.userId, facts1), saveMemory'(X.userId, facts2))
  final ← loadMemory(X.userId)
  ASSERT final contains facts1 AND final contains facts2
END FOR

FUNCTION isBugCondition_LastAggregate(X)
  INPUT: X = entries array fetched desc by created_at
  RETURN EXISTS m IN X.metrics WHERE m.aggregate = 'last'
END FUNCTION

// Property: "last" aggregate returns the most recent value
FOR ALL X WHERE isBugCondition_LastAggregate(X) DO
  result ← aggregateMetrics'(X)
  mostRecent ← X[0].metrics.find(m => m.aggregate = 'last').value  // first = newest
  ASSERT result[m.key].value = mostRecent
END FOR

// ── Preservation Checking ────────────────────────────────────────────────────

// Property: Non-buggy inputs preserve existing behavior
FOR ALL X WHERE NOT isBugCondition_ThreadContext(X)
              AND NOT isBugCondition_EmbeddingFailed(X)
              AND NOT isBugCondition_RaceCondition(X)
              AND NOT isBugCondition_LastAggregate(X) DO
  ASSERT F(X) = F'(X)  // all outputs identical before and after fix
END FOR
```


---

## Extended Bug Analysis — Part II

### Current Behavior (Defect) — continued

**Bot ↔ Mini-App Sync**

1.35 WHEN a user tells the bot "add a meditation widget" and the bot routes to `create_widget` in `src/lib/bot/handlers/action.ts` THEN the handler sends a friendly acknowledgment message but writes nothing to `profiles.settings.dashboard_widgets` — the mini-app dashboard (`src/app/miniapp/dashboard/page.tsx`) reads `dashboard_metrics` from `entries.metadata` directly and never reads `profiles.settings.dashboard_widgets` for its metric cards, so the two systems are completely disconnected and no widget ever appears

1.36 WHEN the nightly cron calls `buildAndSaveWidgets` in `src/lib/processing/widgets.ts` THEN it generates up to 8 hardcoded widget types (`calories_today`, `expenses_today`, `mood_trend`, `life_theme`, `daily_summary`, `weekly_summary`, `monthly_summary`, `insight_cluster`) and persists them to `profiles.settings.dashboard_widgets` — but `src/app/miniapp/dashboard/page.tsx` never reads `profiles.settings.dashboard_widgets`; it calls `aggregateMetrics(entries)` entirely client-side from raw entry data, making the entire nightly widget generation pipeline unused and invisible

1.37 WHEN the bot processes a message THEN it has no access to the user's current mini-app state (which tab is active, which date range is selected, which widgets are pinned) — there is no shared state channel between the bot and the mini-app, so the bot cannot tailor its replies to what the user is currently viewing

1.38 WHEN a user tells the bot "disable my weekly report" and the bot's `update_schedule` action correctly writes `{weekly: false}` to `profiles.settings.report_schedule` THEN the cron at `/api/cron/reports/` (which does not exist — see 1.48) would process all users unconditionally even if it did exist, because no cron handler reads `report_schedule` before sending — so the user's schedule preference is stored but never honored

1.39 WHEN the bot saves a new entry to the `entries` table THEN the mini-app feed (`src/app/miniapp/page.tsx`) does not refresh — it fetches entries once on mount and has no real-time subscription, WebSocket, or polling mechanism; the user must manually pull-to-refresh or navigate away and back to see the new entry

**Agent Capabilities**

1.40 WHEN the bot is running THEN it has no proactive analysis loop — it never initiates contact with the user, never calls Telegram's `sendMessage` API from a cron job, and never surfaces observations such as "you haven't logged sleep in 3 days", "your mood has been declining this week", or "you're on track for your running goal" — all insights require the user to ask first

1.41 WHEN `embedEntry` triggers `runInsightPipeline` → `generateInsight` in `src/lib/insight.ts` THEN insights are generated and persisted to the `insights` table — but they are never surfaced to the user anywhere: not in the bot (the comment in `src/lib/embedding.ts` reads "insights removed — too noisy"), not in the mini-app feed, and not in reports; the `insights` table is populated but completely invisible to the user

1.42 WHEN `extractFacts` / `saveMemory` in `src/lib/bot/memory.ts` runs after each message THEN it extracts personal facts only from the current message text — there is no periodic "deep memory consolidation" pass that scans all entries to extract long-term behavioral patterns (e.g. "user typically sleeps 6–7 hours", "user exercises 3× per week on average", "user's mood correlates with workout days"), so the memory stays shallow and reactive

1.43 WHEN any cron job runs (`/api/cron/process`, `/api/cron/reports`) THEN it only processes data internally — no cron job ever calls Telegram's `sendMessage` API to push a morning summary, streak reminder, or weekly insight to the user; the bot is entirely reactive and cannot initiate contact

1.44 WHEN the bot receives a message THEN it uses a single classify-then-route pattern (`save_entry` → save, `question` → RAG, `action` → handler, `smalltalk` → converse) — there is no tool-use or function-calling architecture where the model can decide to call named tools (`query_entries`, `update_widget`, `send_insight`, `set_reminder`) and chain them; every new capability requires a new hardcoded intent branch in the classifier prompt

1.45 WHEN `synthesiseAnswer` in `src/lib/bot/qa.ts` answers a question THEN it uses only the entries retrieved for that specific question via `retrieveEntries` — it never connects cross-domain signals (e.g. "you spent 3× more this week" with "you mentioned stress at work on Monday"), because the RAG is per-question and the `synthesiseAnswer` function has no access to the full life context beyond the retrieved entries

1.46 WHEN the `/stats` command runs in `src/lib/bot/commands.ts` THEN it computes energy balance using a fragile heuristic: it searches for a metric whose `label.toLowerCase().includes("калорії")` OR (`unit === "ккал"` AND `label.toLowerCase().includes("їж")`) for intake, and `label.toLowerCase().includes("спален")` for burned — this will miss most entries because metric labels are generated by Gemini in the user's language and the substring match is brittle; additionally the `aggregate: "last"` branch uses `values[values.length - 1]` which is the oldest value due to ascending fetch order (same inversion as bug 1.29)

**Missing API / Infrastructure**

1.47 WHEN Vercel's scheduler triggers the cron at `09:00 UTC` daily as configured in `vercel.json` THEN the route `/api/cron/reports` returns a 404 because `src/app/api/cron/reports/` is an empty directory with no `route.ts` file — scheduled report delivery is completely broken for all users

1.48 WHEN the mini-app or bot attempts to read or update a user's report schedule via `/api/rules` THEN the route returns a 404 because `src/app/api/rules/` is an empty directory with no `route.ts` file — there is no API for the mini-app to read or update `profiles.settings.report_schedule`

1.49 WHEN any client attempts to use `/api/schedule` THEN the route returns a 404 because `src/app/api/schedule/` is an empty directory with no `route.ts` file — no scheduling API exists

1.50 WHEN `src/app/api/auth/telegram/route.ts` receives a POST request THEN it performs HMAC-SHA256 verification of Telegram `initData` but has no rate limiting — an attacker can replay a valid `initData` string (which is valid for 24 hours per Telegram's spec) up to thousands of times per second to enumerate user accounts or exhaust Supabase Auth quotas, because there is no per-IP or per-user request throttle

1.51 WHEN `src/app/api/graph/route.ts` handles a GET request for a user with 500+ entries THEN it fetches all entries with their embedding vectors and computes cosine similarity in JavaScript for every pair (O(n²) loop: `withEmbeddings.length² / 2` iterations) inside a single Edge function invocation — for 500 entries this is 125,000 dot products computed synchronously in the Edge runtime, which will exceed Vercel's 25-second Edge function timeout and return a 504, leaving the graph page blank for power users

1.52 WHEN `src/app/miniapp/graph/page.tsx` fetches from `/api/graph` and the request times out or returns a non-200 status THEN the page sets `status = 'error'` and renders an error message with a retry button — however the SVG canvas is blank with no skeleton or partial state, and the error message does not distinguish between a timeout (recoverable) and a permanent error (e.g. no entries), giving the user no actionable guidance

1.53 WHEN any bot action or cron job writes to `profiles.settings` THEN it performs a full object merge (`{...currentSettings, [key]: value}`) on an unvalidated JSONB column that is used as a catch-all for `memory`, `dashboard_widgets`, `report_schedule`, `pending_delete` keys, and potentially more — there is no JSON schema validation on writes, so a malformed write to any key (e.g. a Gemini response that produces invalid JSON for a memory fact) can corrupt the entire `settings` object for the user, silently breaking memory, widgets, and schedule preferences simultaneously

1.54 WHEN Telegram retries a webhook update (which it does automatically on any 5xx response or timeout) THEN the webhook handler in `src/app/api/telegram/webhook/route.ts` has no deduplication on `update_id` — the same message is processed twice, saving duplicate entries, sending duplicate replies, and double-charging Gemini API quota; this is especially likely given the 24-second timeout and `onTimeout: "return"` configuration which returns 200 but may have already started processing

**Mini-App UX Gaps**

1.55 WHEN the mini-app layout in `src/app/miniapp/layout.tsx` fails authentication (status `'error'`) THEN it renders a static error screen with the message "Не вдалося увійти" and the error detail, but provides no retry button — the user must close and reopen the mini-app entirely; additionally there is no development mode bypass, making local development without a real Telegram context impossible

1.56 WHEN the mini-app feed (`src/app/miniapp/page.tsx`), dashboard (`src/app/miniapp/dashboard/page.tsx`), or graph (`src/app/miniapp/graph/page.tsx`) is loading THEN the entire page shows a centered spinner for the full load duration — for users with 500+ entries this is a multi-second blank screen with no content preview; there are no skeleton cards or progressive loading states

1.57 WHEN `aggregateMetrics` in `src/app/miniapp/dashboard/page.tsx` processes entries where `dashboard_metrics` is missing THEN it has a fallback sleep parser that reads `entry.content` directly — but this fallback only handles the `sleep` category; for any other category where the classifier failed to extract metrics (e.g. a workout entry where Gemini returned an empty array), the entry is silently skipped and contributes no data to the dashboard, with no indication to the user that data is missing

1.58 WHEN `src/app/miniapp/graph/page.tsx` loads THEN it calls `/api/graph` which fetches all entries including their full embedding vectors (768 floats each) and computes all pairwise similarities server-side — for a user with 500 entries the JSON response payload is approximately 500 × 768 × 8 bytes ≈ 3 MB, causing slow initial load, potential OOM in the Edge function, and a large parse cost on the client

1.59 WHEN a user opens `src/app/miniapp/settings/page.tsx` THEN the page only offers passcode management and auto-lock timer settings — there is no option to export diary data as JSON or CSV; for a personal diary app targeting privacy-conscious users, data portability is absent

1.60 WHEN a user wants to receive proactive insights, streak reminders, or report delivery notifications through the mini-app THEN there is no push notification support — the mini-app has no Web Push integration, no Telegram Web App notification API usage, and no mechanism to receive proactive messages except through the Telegram bot (which itself cannot initiate contact — see 1.43)

---

### Expected Behavior (Correct) — continued

**Bot ↔ Mini-App Sync**

2.35 WHEN the bot's `create_widget` action is triggered THEN the system SHALL write the new widget configuration to `profiles.settings.dashboard_widgets` AND the mini-app dashboard SHALL read `profiles.settings.dashboard_widgets` to render pinned/custom metric cards alongside the auto-aggregated metrics from entries, so bot commands and mini-app display are synchronized

2.36 WHEN `buildAndSaveWidgets` generates widget configs and saves them to `profiles.settings.dashboard_widgets` THEN the mini-app dashboard SHALL read and render those widgets (summaries, mood trends, insight clusters) in a dedicated "Insights" or "Widgets" section, making the nightly cron output visible to the user

2.37 WHEN the bot generates a reply THEN the system SHALL include the user's current mini-app context (last-viewed tab, active date range) if available via a shared state key in `profiles.settings.miniapp_state`, allowing the bot to tailor responses (e.g. "I see you're looking at this week's dashboard — here's what stands out")

2.38 WHEN the bot's `update_schedule` action writes to `profiles.settings.report_schedule` THEN the `/api/cron/reports` route SHALL read each user's `report_schedule` before processing and SHALL skip users who have disabled a given report type, honoring the stored preference

2.39 WHEN the bot saves a new entry THEN the mini-app SHALL detect the new data via a Supabase Realtime subscription on the `entries` table (filtered by `user_id`) and SHALL automatically prepend the new entry to the feed without requiring a manual refresh

**Agent Capabilities**

2.40 WHEN the daily cron runs THEN the system SHALL include a proactive analysis step that checks each user's recent entries for notable patterns (missed logging streaks, mood trends, goal progress) and SHALL call Telegram's `sendMessage` API to deliver a brief proactive insight to users who have opted in, using the bot token and stored `telegram_id` from the `profiles` table

2.41 WHEN `generateInsight` persists an insight to the `insights` table THEN the mini-app feed SHALL surface recent insights as a distinct card type (e.g. with a lightbulb icon) interleaved with diary entries, and the mini-app reports page SHALL include an "Insights" section listing the most recent insights, making the `insights` table visible to the user

2.42 WHEN the daily cron runs THEN the system SHALL include a "deep memory consolidation" step that queries all entries for a user, calls Gemini to extract long-term behavioral patterns, and merges the results into `profiles.settings.memory` using the atomic `jsonb_set` approach (see 2.13), enriching the memory beyond single-message facts

2.43 WHEN a cron job needs to send a proactive message to a user THEN the system SHALL call `https://api.telegram.org/bot{TOKEN}/sendMessage` with the user's `telegram_id` (stored in `profiles`) and the message text, implementing a `sendProactiveMessage(telegramId, text)` utility in a new `src/lib/bot/push.ts` module

2.44 WHEN a new bot capability is needed THEN the system SHALL implement it as a named tool in a tool registry (`src/lib/bot/tools/`) with a defined input schema, and the classifier SHALL route to the tool registry rather than a hardcoded switch statement, allowing the model to chain tools and compose multi-step actions

2.45 WHEN `synthesiseAnswer` generates a response THEN the system SHALL augment the retrieved entries with a "life context" block containing the user's memory facts and the most recent cross-domain entries (last 5 entries across all categories), enabling the model to connect patterns across domains

2.46 WHEN the `/stats` command computes energy balance THEN the system SHALL use the metric `key` field (e.g. `kcal_intake`, `kcal_burned`, `activity_kcal`) rather than fragile label substring matching, and SHALL use the correct `aggregate: "last"` logic (most recent value by `created_at`, not array tail — see 2.29)

**Missing API / Infrastructure**

2.47 WHEN Vercel's scheduler triggers `/api/cron/reports` at `09:00 UTC` THEN the route SHALL exist as `src/app/api/cron/reports/route.ts`, SHALL read each user's `profiles.settings.report_schedule`, and SHALL generate and deliver the appropriate report type (daily/weekly/monthly) only for users who have that report type enabled and whose delivery time matches the current hour

2.48 WHEN the mini-app or bot needs to read or update a user's report schedule THEN `/api/rules` SHALL exist as `src/app/api/rules/route.ts` with GET (read current schedule) and PATCH (update schedule fields) handlers that operate on `profiles.settings.report_schedule` using the authenticated user's JWT

2.49 WHEN a client needs scheduling functionality THEN `/api/schedule` SHALL exist as `src/app/api/schedule/route.ts` providing a unified scheduling API that reads and writes `profiles.settings.report_schedule` and validates the schedule object against a defined schema before writing

2.50 WHEN `src/app/api/auth/telegram/route.ts` receives a POST request THEN the system SHALL enforce rate limiting of at most 10 requests per IP per minute using an in-memory or Redis-backed counter, returning HTTP 429 with a `Retry-After` header on excess requests, preventing brute-force replay attacks

2.51 WHEN `/api/graph` computes the knowledge graph THEN the system SHALL delegate pairwise similarity computation to a pgvector SQL query using `<=>` cosine distance operator (e.g. `SELECT a.id, b.id, 1 - (a.embedding <=> b.embedding) AS similarity FROM entries a JOIN entries b ON a.user_id = b.user_id WHERE ...`) running server-side in Postgres, eliminating the O(n²) JavaScript loop and the need to transfer embedding vectors to the Edge function; the route SHALL also be moved to `runtime = "nodejs"` with a `maxDuration = 30` to handle larger datasets

2.52 WHEN the graph API times out or returns an error THEN the mini-app graph page SHALL display a user-friendly error state that distinguishes between a timeout ("Граф завантажується довго — спробуй пізніше") and a data error ("Не вдалося завантажити граф"), and SHALL show a skeleton placeholder while loading rather than a blank canvas

2.53 WHEN any code writes to `profiles.settings` THEN the system SHALL validate the written value against a TypeScript interface `ProfileSettings` (with known keys: `memory`, `dashboard_widgets`, `report_schedule`, `miniapp_state`) and SHALL use `jsonb_set` for atomic per-key updates rather than full-object overwrites, preventing cross-key corruption

2.54 WHEN the webhook handler receives a Telegram update THEN the system SHALL check the `update_id` against a short-lived deduplication store (e.g. a Supabase table `processed_updates` with a TTL index, or an in-memory LRU cache keyed by `update_id`) and SHALL skip processing if the `update_id` has already been handled within the last 5 minutes

**Mini-App UX Gaps**

2.55 WHEN the mini-app layout authentication fails THEN the system SHALL display a retry button that re-runs the `init()` function, and SHALL support a `NEXT_PUBLIC_DEV_MODE=true` environment variable that bypasses Telegram `initData` validation and uses a hardcoded dev user token for local development

2.56 WHEN the mini-app feed, dashboard, or graph page is loading THEN the system SHALL render skeleton card placeholders (grey animated rectangles matching the expected card dimensions) immediately, replacing them with real content as data loads, eliminating the multi-second blank screen

2.57 WHEN `aggregateMetrics` encounters an entry where `dashboard_metrics` is missing or empty and the category is not `sleep` THEN the system SHALL attempt a content-based metric extraction fallback for known categories (workout: parse distance/duration patterns; expenses: parse amount/currency patterns; health: parse weight/water patterns) and SHALL display a "⚠ метрики не розпізнано" badge on the entry card in the drill-down drawer so the user knows data is incomplete

2.58 WHEN `/api/graph` builds the graph payload THEN the system SHALL NOT include raw embedding vectors in the response — similarity edges SHALL be computed server-side via pgvector (see 2.51) and only the edge list (source, target, weight, type) SHALL be returned, reducing the payload from ~3 MB to ~50 KB for 500 entries

2.59 WHEN a user opens the settings page THEN the system SHALL provide a "Експортувати дані" button that calls a new `/api/export` route, which queries all of the user's entries and returns them as a downloadable JSON file (with `Content-Disposition: attachment; filename="memo-export.json"`), satisfying data portability requirements

2.60 WHEN a user wants to receive proactive notifications through the mini-app THEN the system SHALL integrate Telegram Web App's `requestWriteAccess` API to obtain permission to send messages, and SHALL use the bot's `sendMessage` capability (see 2.43) as the notification delivery channel, with opt-in controls in the settings page

---

### Unchanged Behavior (Regression Prevention) — continued

3.16 WHEN the bot's `update_schedule` action writes to `profiles.settings.report_schedule` THEN the system SHALL CONTINUE TO merge only the fields the user mentioned (daily/weekly/monthly/time) without overwriting unrelated settings keys

3.17 WHEN `buildAndSaveWidgets` runs THEN the system SHALL CONTINUE TO generate all 8 widget types (calories_today, expenses_today, mood_trend, life_theme, daily_summary, weekly_summary, monthly_summary, insight_cluster) and persist them to `profiles.settings.dashboard_widgets`

3.18 WHEN the `/report` command is used THEN the system SHALL CONTINUE TO generate a retrospective using `generateRetrospective` and send it formatted via `formatReportForTelegram` with rotating status messages

3.19 WHEN the mini-app settings page is open THEN the system SHALL CONTINUE TO allow users to set, change, and disable a 4-digit passcode and configure the auto-lock timer

3.20 WHEN the graph page renders THEN the system SHALL CONTINUE TO use D3 force simulation with branch edges (purple), similarity edges (grey dashed), and cross-category edges (amber), with node size proportional to edge count and cluster labels

3.21 WHEN `clusterEntries` runs THEN the system SHALL CONTINUE TO use Union-Find to group connected components and assign stable `branch_id` UUIDs to clusters of ≥ 3 entries with cosine similarity > 0.75

---

## Bug Condition Pseudocode — continued

```pascal
// ── Fix Checking Properties (Part II) ────────────────────────────────────────

FUNCTION isBugCondition_CreateWidgetNoWrite(X)
  INPUT: X = (action_type, action_params)
  RETURN X.action_type = 'create_widget'
END FUNCTION

// Property: create_widget actually persists to profiles.settings.dashboard_widgets
FOR ALL X WHERE isBugCondition_CreateWidgetNoWrite(X) DO
  handleAction'(ctx, X)
  settings ← loadProfileSettings(ctx.profile.id)
  ASSERT settings.dashboard_widgets IS NOT NULL
  ASSERT EXISTS w IN settings.dashboard_widgets WHERE w.metric_key = X.action_params.metric_key
END FOR

FUNCTION isBugCondition_CronReportsMissing(X)
  INPUT: X = HTTP request to /api/cron/reports
  RETURN true  // route does not exist
END FUNCTION

// Property: /api/cron/reports route exists and respects user schedule
FOR ALL X WHERE isBugCondition_CronReportsMissing(X) DO
  response ← fetch'('/api/cron/reports', {headers: {Authorization: CRON_SECRET}})
  ASSERT response.status ≠ 404
  // For users with report_schedule.weekly = false:
  FOR ALL user WHERE user.settings.report_schedule.weekly = false DO
    ASSERT no Telegram message sent to user.telegram_id for weekly report
  END FOR
END FOR

FUNCTION isBugCondition_DuplicateUpdate(X)
  INPUT: X = Telegram update object
  RETURN X.update_id was already processed within last 5 minutes
END FUNCTION

// Property: Duplicate Telegram updates are not processed twice
FOR ALL X WHERE isBugCondition_DuplicateUpdate(X) DO
  result1 ← processWebhook(X)
  result2 ← processWebhook(X)  // Telegram retry
  entriesAfter ← countEntries(X.from.id)
  ASSERT entriesAfter = entriesBefore + 1  // exactly one entry created, not two
  ASSERT telegramMessagesSent = 1          // exactly one reply, not two
END FOR

FUNCTION isBugCondition_GraphO2(X)
  INPUT: X = user with N entries where N > 100
  RETURN X.entry_count > 100
END FUNCTION

// Property: Graph API completes within timeout for large entry counts
FOR ALL X WHERE isBugCondition_GraphO2(X) DO
  startTime ← now()
  response ← fetch('/api/graph', {headers: {Authorization: X.jwt}})
  elapsed ← now() - startTime
  ASSERT response.status = 200
  ASSERT elapsed < 10_000  // completes in under 10 seconds
  // Embedding vectors must NOT be in the response payload
  payload ← response.json()
  FOR ALL node IN payload.nodes DO
    ASSERT node.embedding IS UNDEFINED
  END FOR
END FOR

FUNCTION isBugCondition_SettingsCorruption(X)
  INPUT: X = (userId, concurrent_writes_to_different_keys: integer)
  RETURN X.concurrent_writes_to_different_keys > 1
END FUNCTION

// Property: Concurrent writes to different settings keys do not corrupt each other
FOR ALL X WHERE isBugCondition_SettingsCorruption(X) DO
  parallel(
    saveMemory'(X.userId, {name: "Андрій"}),
    buildAndSaveWidgets'(X.userId),
    updateSchedule'(X.userId, {weekly: true})
  )
  settings ← loadProfileSettings(X.userId)
  ASSERT settings.memory.name = "Андрій"
  ASSERT settings.dashboard_widgets IS NOT NULL
  ASSERT settings.report_schedule.weekly = true
END FOR

// ── Preservation Checking (extended) ─────────────────────────────────────────

// Property: All non-buggy inputs preserve existing behavior
FOR ALL X WHERE NOT isBugCondition_CreateWidgetNoWrite(X)
              AND NOT isBugCondition_CronReportsMissing(X)
              AND NOT isBugCondition_DuplicateUpdate(X)
              AND NOT isBugCondition_GraphO2(X)
              AND NOT isBugCondition_SettingsCorruption(X)
              AND NOT isBugCondition_ThreadContext(X)
              AND NOT isBugCondition_EmbeddingFailed(X)
              AND NOT isBugCondition_RaceCondition(X)
              AND NOT isBugCondition_LastAggregate(X) DO
  ASSERT F(X) = F'(X)  // all outputs identical before and after fix
END FOR
```
