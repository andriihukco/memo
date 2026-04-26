# Team Report — Current System Assessment

Multi-role audit of Memo as of April 2026. Each section represents the perspective of a specialist role.

---

## 🏗️ Engineering Lead

### Strengths

**Architecture is solid for the scale.**
The Edge/Node.js runtime split is well-considered. Edge for latency-sensitive routes (webhook, auth, entries CRUD), Node.js for long-running operations (reports, cron). This is the right call.

**Type safety is excellent.**
TypeScript throughout, Zod validation on all AI outputs and API inputs. The `ClassificationResultSchema` with fallback defaults is particularly well-done — it prevents the entire pipeline from crashing on a malformed Gemini response.

**Async embedding is the right pattern.**
Decoupling embedding generation from the bot reply path keeps response latency at 1-2s instead of 5-8s. The fire-and-forget pattern with proper error handling is correct.

**pgvector HNSW is production-ready.**
`m=16, ef_construction=64` is a reasonable default. The cosine similarity threshold of 0.75 for clustering is well-calibrated.

**Encryption is implemented correctly.**
AES-GCM 256-bit with random IV per encryption. The Web Crypto API usage is correct. Timing-safe comparison for HMAC verification is a nice security detail.

### Concerns

**No rate limiting anywhere.**
The webhook endpoint, auth endpoint, and all API routes have zero rate limiting. A malicious actor could spam the webhook and rack up significant Gemini API costs. This is the highest-priority security gap.

**Embedding recomputation on edit is missing.**
When an entry is edited via `PATCH /api/entries`, the content changes but `embedding` is not requeued. The vector becomes stale, breaking semantic search and clustering for edited entries.

**No retry logic for failed embeddings.**
`embedding_status = 'failed'` entries are never retried. Over time, a growing percentage of entries will have no embedding, degrading search quality.

**Pagination is a hard limit, not cursor-based.**
`GET /api/entries?limit=100` returns the 100 most recent entries. There's no way to load older entries in the mini app. Users with >100 entries lose access to their history in the feed.

**D3 simulation cleanup.**
The graph page creates a D3 simulation but the cleanup in the `useEffect` return function doesn't call `simulation.stop()`. This can cause memory leaks when navigating away from the graph page.

**Concurrent edit race condition.**
No optimistic locking on entries. If two clients edit the same entry simultaneously, the last write wins silently.

**`settings` JSONB column is a catch-all.**
`profiles.settings` stores dashboard widgets, custom widgets, report schedule, pending deletes, and more. This will become a maintenance problem. These should be separate columns or tables.

**Missing webhook secret verification.**
The Telegram webhook should verify the `X-Telegram-Bot-Api-Secret-Token` header. Currently any POST to `/api/telegram/webhook` is processed.

---

## 🧪 QA Lead

### Test Coverage Assessment

**Current state: critically low.**
One test file exists: `src/__tests__/ui-ux-overhaul.test.ts`. No unit tests for the AI pipeline, no integration tests for API routes, no E2E tests.

**High-risk untested paths:**
1. `classify()` — the most critical function in the system. A regression here breaks everything.
2. `verifyInitData()` — security-critical. A bug here allows unauthorized access.
3. `createSubscription()` — payment processing. A bug here means lost revenue or double-charging.
4. `embedEntry()` — async, fire-and-forget. Failures are silent.
5. `clusterEntries()` — union-find algorithm. Correctness is hard to verify manually.

**Missing test types:**
- Unit tests for `classifier.ts`, `embedding.ts`, `qa.ts`, `paywall.ts`
- Integration tests for all API routes
- Property-based tests for the union-find clustering algorithm
- E2E tests for the payment flow
- Snapshot tests for key UI components

**Recommended immediate actions:**
1. Add unit tests for `verifyInitData()` — security-critical, pure function, easy to test
2. Add unit tests for `calcPrice()` and tier limit enforcement
3. Add integration tests for `POST /api/auth/telegram` with valid/invalid initData
4. Add property-based tests for `clusterEntries()` using fast-check (already in dependencies)

### Known Bugs / Edge Cases

1. **Thread resolution with both number and string `bot_msg_id`** — The code queries with both forms (`WHERE metadata->>'bot_msg_id' = $1 OR metadata->>'bot_msg_id' = $2`). This suggests a historical inconsistency in how `bot_msg_id` was stored. Should be normalized.

2. **Sleep hours regex fallback** — The regex `(\d+(?:[.,]\d+)?)\s*(?:год(?:ин)?|hours?|h\b)` will match "8h" in "8 hours" but also in "8 hours of work" — could misclassify work entries as sleep.

3. **Category filter on multi-category entries** — Entries can have comma-separated categories (e.g., `"calories,workout"`). The category filter in the feed splits on comma, but the API filter uses exact match. Inconsistency.

4. **Graph node limit of 200** — Silently truncates to the 200 most-connected nodes. Users with large graphs don't know they're seeing a partial view.

5. **Cron job idempotency** — If the cron job runs twice (Vercel can occasionally double-fire), `autoIncrementStreaks()` could create duplicate streak entries.

---

## 🎨 UX/UI Lead

### What Works Well

**The dark theme is excellent.**
Deep navy (`#0B0F19`) with blue primary (`#3B82F6`) is a strong, cohesive palette. The category color system (17 distinct colors) is well-differentiated and readable on dark backgrounds.

**Motion design is polished.**
Spring animations throughout feel native. The staggered list entry animations, bottom sheet springs, and page transitions are all well-calibrated. The app feels alive.

**The tab bar is distinctive.**
The floating pill-shaped tab bar is a strong design choice that differentiates Memo from generic Telegram mini apps.

**Onboarding is effective.**
6 slides with gradient backgrounds, emoji heroes, and clear value propositions. The privacy slide (slide 5) builds trust before the paywall slide (slide 6).

**Swipe-to-delete is well-implemented.**
The threshold/commit system (72px reveal, 200px commit) with visual feedback (delete icon opacity) is the right UX pattern for mobile.

### Issues & Gaps

**No loading states on navigation.**
When switching tabs, there's a flash of empty content before data loads. Skeleton screens exist but aren't always shown during navigation.

**The graph is hard to use on small screens.**
The D3 force simulation produces dense, overlapping nodes on phones. The 200-node limit helps but the graph still becomes unreadable with >50 nodes. Needs a "focus mode" that shows only the selected node's neighborhood.

**Dashboard date range picker is buried.**
The date range selector is a small chip at the top of the dashboard. Users may not discover it. Should be more prominent.

**No empty state for the graph.**
When a user has no entries with embeddings, the graph shows a loading spinner indefinitely. Needs a proper empty state.

**Settings page is long and unstructured.**
The settings page has 6 sections (Subscription, Privacy, Categories, Sound, Support, About) with no visual hierarchy between them. Needs section headers or grouping.

**Paywall modal is shown too aggressively.**
The paywall appears immediately when the feed loads if the user is at their limit. This is jarring. Should show a softer "you're approaching your limit" warning first.

**No haptic feedback on Android.**
The `haptics.ts` module uses `navigator.vibrate()` which is not supported on iOS. The `snd-lib` sound effects work on both platforms, but haptics are iOS-only via Telegram's `HapticFeedback` API.

**Category management is hidden.**
The categories page is accessible only from Settings → Categories. Users who want to rename or delete categories may not find it.

**No visual distinction between log entries and goal entries.**
Goal entries have a progress bar, but the visual treatment is subtle. Users may not understand the difference between a "log" and a "goal" entry.

---

## 📊 Product / Business Analyst

### Product-Market Fit Signals

**Strong:** The combination of Telegram bot + mini app is genuinely differentiated. No competitor offers this exact combination of zero-friction input + structured analytics + semantic search in a single Telegram experience.

**Strong:** The 17 built-in categories cover the most common self-tracking use cases. The open-ended category system means the AI can handle anything the user throws at it.

**Weak:** The free tier is too restrictive. 100 entries is approximately 3-4 months of daily use for an active user. Users who hit the limit before experiencing the full value proposition will churn rather than upgrade.

**Weak:** No social/sharing features. The knowledge graph and retrospectives are compelling but private. A "share report" feature could drive organic growth.

### Monetization Assessment

**Telegram Stars is the right choice** for this audience. No credit card friction, instant settlement, no payment processor fees. The 250⭐ (~$3.50) price point is competitive.

**The billing period discounts are well-structured.** −15% quarterly, −30% annual creates meaningful incentive to commit longer-term.

**Concerns:**
- No auto-renewal means high churn risk. Users who forget to renew lose access abruptly.
- No trial period for paid tiers. Users can't experience Nova features before paying.
- The free tier doesn't showcase the best features (graph, retrospectives, recommendations are all paywalled).

### Missing Features (Business Priority)

1. **Data export (GDPR compliance)** — Required for EU users. High legal risk.
2. **Referral system** — "Invite a friend, get 1 month free" would drive organic growth.
3. **Sharing** — Share a retrospective or insight to Telegram contacts.
4. **Reminders** — The `reminders` table exists but the feature isn't implemented. High user value.
5. **Web version** — Some users want to access their diary from desktop.
6. **Widgets for iOS/Android home screen** — Show today's metrics without opening the app.

---

## 📣 Marketing / Growth

### Positioning

**Current positioning:** "AI personal diary in Telegram"

**Recommended positioning:** "The diary that thinks with you"

The current positioning leads with the technology (AI, Telegram). The recommended positioning leads with the user benefit (thinking partner, not just storage).

### Target Channels

1. **Telegram itself** — The app is a Telegram mini app. Sharing via Telegram is zero-friction. A "share this retrospective" feature would be the highest-ROI growth feature.

2. **Health & fitness communities** — Reddit (r/fitness, r/loseit), Telegram fitness channels. The calorie/macro tracking use case is the most universally relatable.

3. **Productivity communities** — Notion users, journaling communities. The retrospective feature resonates here.

4. **Ukrainian tech community** — The app is Ukrainian-first. Strong positioning in UA tech Telegram channels.

### Growth Gaps

- No referral mechanism
- No public-facing landing page (only the mini app)
- No App Store / Google Play presence (Telegram mini apps don't appear in stores)
- No content marketing (blog, YouTube, TikTok showing the app in action)
- No analytics (no Mixpanel, Amplitude, or even basic event tracking)

### Retention Risks

- Users who hit the free tier limit and don't upgrade will churn
- No push notifications (Telegram bots can send messages, but only if the user has interacted recently)
- No streak notifications ("You haven't logged today!")
- No weekly summary delivered automatically to free users (would demonstrate value)
