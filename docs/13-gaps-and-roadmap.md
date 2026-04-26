# Gaps & 2026 Roadmap — Memo

Prioritized improvement scope based on the multi-role team audit.

---

## Priority Matrix

| Priority | Impact | Effort | Category |
|----------|--------|--------|----------|
| P0 | Critical | Any | Security, data loss, legal |
| P1 | High | Low-Medium | Core UX, retention |
| P2 | High | Medium-High | Growth, monetization |
| P3 | Medium | Any | Quality, polish |

---

## P0 — Critical (Fix Now)

### 1. Rate Limiting
**Gap:** Zero rate limiting on all API routes and the Telegram webhook.
**Risk:** Gemini API cost explosion, DoS vulnerability.
**Solution:** Implement Upstash Redis rate limiting middleware.
```typescript
// Recommended: @upstash/ratelimit
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '1 m'),
});
```
**Effort:** 1 day

### 2. Webhook Secret Verification
**Gap:** `/api/telegram/webhook` doesn't verify `X-Telegram-Bot-Api-Secret-Token`.
**Risk:** Any actor can send fake updates to the webhook.
**Solution:** Set a webhook secret in BotFather and verify the header.
**Effort:** 2 hours

### 3. Data Export (GDPR)
**Gap:** No way for users to export their data.
**Risk:** Legal non-compliance for EU users (GDPR Article 20 — right to data portability).
**Solution:** `GET /api/profile/export` → returns JSON of all user data.
**Effort:** 1 day

### 4. Embedding Recomputation on Edit
**Gap:** Editing an entry doesn't requeue its embedding.
**Risk:** Stale vectors degrade semantic search and clustering quality over time.
**Solution:** After `PATCH /api/entries`, set `embedding_status = 'pending'` and trigger async re-embedding.
**Effort:** 2 hours

---

## P1 — High Priority (Next Sprint)

### 5. Cursor-Based Pagination
**Gap:** Feed loads only the 100 most recent entries. Older entries are inaccessible.
**Solution:** Implement cursor-based pagination with `before` parameter.
```typescript
GET /api/entries?limit=30&before=<entry_id>
```
Add infinite scroll to the feed page.
**Effort:** 1 day

### 6. Embedding Retry for Failed Entries
**Gap:** `embedding_status = 'failed'` entries are never retried.
**Solution:** Add a cron job step that retries failed embeddings (max 3 attempts with exponential backoff).
**Effort:** 4 hours

### 7. Free Tier Soft Limit Warning
**Gap:** Paywall appears abruptly when limit is hit.
**Solution:** Show `UsageCounterChip` in the feed header when >80% of limit used. Show a soft warning banner at 90%.
**Effort:** 4 hours

### 8. Graph Empty State
**Gap:** Graph shows infinite spinner when no embeddings exist.
**Solution:** Add proper empty state with explanation and CTA to send first message.
**Effort:** 2 hours

### 9. D3 Simulation Cleanup
**Gap:** `simulation.stop()` not called on component unmount.
**Solution:** Return `() => simulation.stop()` from the `useEffect`.
**Effort:** 30 minutes

### 10. Reminders Feature
**Gap:** `reminders` table exists but feature is not implemented.
**Solution:** Bot command `/remind [text] at [time]` → creates reminder → cron delivers at scheduled time.
**Effort:** 2 days

### 11. Streak Notifications
**Gap:** No proactive engagement when users miss a day.
**Solution:** Daily cron checks for users who haven't logged today → send gentle reminder via bot.
**Effort:** 4 hours

### 12. Free Weekly Summary
**Gap:** Free users don't experience the retrospective feature.
**Solution:** Auto-generate a simplified weekly summary for all users (free and paid) and deliver via bot every Monday.
**Effort:** 1 day

---

## P2 — Growth & Monetization

### 13. Free Trial for Nova
**Gap:** No way to experience paid features before paying.
**Solution:** 7-day free trial of Nova tier. Triggered by `/start` or first paywall encounter.
**Effort:** 1 day

### 14. Referral System
**Gap:** No organic growth mechanism.
**Solution:** `/invite` command generates a referral link. Referrer gets 1 month free when referral subscribes.
**Effort:** 3 days

### 15. Share Retrospective
**Gap:** Reports are private. No viral loop.
**Solution:** "Share" button on reports → generates a beautiful image card → share to Telegram.
**Effort:** 2 days

### 16. Increase Free Tier Limit
**Gap:** 100 entries is too restrictive for acquisition.
**Recommendation:** Increase to 200-300 entries. The marginal cost of storage is negligible; the benefit to conversion is significant.
**Effort:** 30 minutes (config change)

### 17. Analytics / Observability
**Gap:** No event tracking, no error monitoring.
**Solution:** 
- Sentry for error tracking (Next.js integration is trivial)
- Posthog or Mixpanel for product analytics
- Key events: `entry_saved`, `report_generated`, `paywall_shown`, `subscription_started`
**Effort:** 1 day

---

## P3 — Quality & Polish

### 18. Comprehensive Test Suite
**Gap:** One test file, no coverage of critical paths.
**Priority tests:**
1. `verifyInitData()` — security-critical
2. `classify()` — core pipeline
3. `calcPrice()` + tier limits — monetization
4. `clusterEntries()` — property-based with fast-check
5. API route integration tests
**Effort:** 3-5 days

### 19. Graph Focus Mode
**Gap:** Graph is unreadable with >50 nodes on mobile.
**Solution:** Tap a node → zoom to its neighborhood (1-2 hops). "Show all" button to return to full view.
**Effort:** 1 day

### 20. Per-User Encryption Salt
**Gap:** Encryption key is derived deterministically from `telegram_id`.
**Solution:** Generate a random salt on account creation, store in `profiles.encryption_salt`. Derive key from `telegram_id + salt`.
**Note:** Requires migration of existing encrypted data — complex.
**Effort:** 3 days

### 21. Settings Page Restructure
**Gap:** Settings page is long and unstructured.
**Solution:** Group into clear sections with visual hierarchy. Move subscription to a dedicated tab or prominent card.
**Effort:** 4 hours

### 22. Normalize `bot_msg_id` Storage
**Gap:** Historical inconsistency in `bot_msg_id` type (number vs string).
**Solution:** Migration to normalize all `bot_msg_id` values to strings. Update query to use single type.
**Effort:** 4 hours

### 23. Cron Job Idempotency
**Gap:** `autoIncrementStreaks()` could create duplicates if cron fires twice.
**Solution:** Add `ON CONFLICT DO NOTHING` to streak entry inserts.
**Effort:** 1 hour

### 24. Haptic Feedback on Android
**Gap:** `navigator.vibrate()` doesn't work on iOS.
**Solution:** Use `window.Telegram.WebApp.HapticFeedback` API for Telegram-native haptics on both platforms.
**Effort:** 2 hours

### 25. JSDoc for Complex Functions
**Gap:** No inline documentation for the AI pipeline, clustering algorithm, or auth flow.
**Solution:** Add JSDoc to `classify()`, `embedEntry()`, `clusterEntries()`, `verifyInitData()`, `resolveOrCreateProfile()`.
**Effort:** 4 hours

---

## 2026 Standards Compliance

### Telegram Mini App 2026 Best Practices

| Standard | Status | Action |
|----------|--------|--------|
| Safe area insets | ✅ | Implemented |
| `expand()` on load | ✅ | Implemented |
| `ready()` on load | ✅ | Implemented |
| HapticFeedback API | ⚠️ | Use TG native instead of `navigator.vibrate()` |
| MainButton API | ❌ | Not used — could replace some CTAs |
| BackButton API | ❌ | Not used — could improve navigation |
| CloudStorage API | ❌ | Could replace localStorage for passcode hash |
| BiometricManager API | ❌ | Could replace PIN with Face ID / fingerprint |
| ThemeParams | ⚠️ | App uses fixed dark theme, ignores TG theme |

### Next.js 2026 Best Practices

| Standard | Status | Action |
|----------|--------|--------|
| App Router | ✅ | Using App Router |
| Server Components | ⚠️ | All pages are `'use client'` — could use RSC for initial data |
| Streaming | ❌ | Not used — could improve perceived performance |
| Parallel Routes | ❌ | Not used |
| Edge Runtime | ✅ | Used for appropriate routes |
| Image Optimization | ⚠️ | `logo.png` not using `next/image` |
| Bundle Analysis | ❌ | No bundle size monitoring |

### Security 2026 Standards

| Standard | Status | Action |
|----------|--------|--------|
| Rate limiting | ❌ | P0 — implement immediately |
| CSRF protection | ✅ | JWT-based auth is CSRF-safe |
| Content Security Policy | ❌ | No CSP headers |
| Subresource Integrity | ❌ | Not configured |
| GDPR data export | ❌ | P0 — legal requirement |
| Audit logging | ❌ | P3 — implement for compliance |

---

## Recommended Sprint Plan

### Sprint 1 (Week 1-2): Security & Stability
- Rate limiting (P0)
- Webhook secret verification (P0)
- Embedding recomputation on edit (P0)
- D3 simulation cleanup (P1)
- Cron idempotency (P3)

### Sprint 2 (Week 3-4): Core UX
- Cursor-based pagination + infinite scroll (P1)
- Embedding retry cron (P1)
- Free tier soft limit warning (P1)
- Graph empty state (P1)
- Haptic feedback fix (P3)

### Sprint 3 (Week 5-6): Engagement & Retention
- Reminders feature (P1)
- Streak notifications (P1)
- Free weekly summary (P1)
- Data export / GDPR (P0)

### Sprint 4 (Week 7-8): Growth
- Free trial for Nova (P2)
- Referral system (P2)
- Analytics setup (P2)
- Increase free tier limit (P2)

### Sprint 5 (Week 9-10): Quality
- Test suite (P3)
- Graph focus mode (P3)
- Settings restructure (P3)
- JSDoc documentation (P3)
