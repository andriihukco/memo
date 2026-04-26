# Subscription System — Memo

Memo monetizes via **Telegram Stars** (XTR), Telegram's native in-app currency. No credit card, no external payment processor.

---

## Tiers

### ✨ Memo Spark (Free)
- 100 entries
- 3 AI-generated custom widgets
- Unlimited preset widgets
- 5 retrospective reports
- 30-day feed history
- Entry encryption
- PIN lock

### 🌟 Memo Nova (250 ⭐/month)
- 2,000 entries
- 15 AI-generated custom widgets
- 50 retrospective reports
- 1-year feed history
- All Spark features
- AI retrospectives
- AI recommendations
- Voice message logging
- Goal tracking
- Knowledge graph

### 💫 Memo Supernova (500 ⭐/month)
- Unlimited everything
- All Nova features
- Full history (all time)
- Data export
- Priority processing

---

## Billing Periods

| Period | Discount | Badge |
|--------|----------|-------|
| Monthly | 0% | — |
| Quarterly (3 months) | −15% | "−15%" |
| Annual (12 months) | −30% | "−30%" |

**Price calculation:**
```typescript
function calcPrice(baseMonthlyStars: number, period: BillingPeriod): number {
  const { months, discountPct } = BILLING_PERIODS[period];
  return Math.round(baseMonthlyStars * months * (1 - discountPct / 100));
}
// Nova monthly: 250 ⭐
// Nova quarterly: 250 × 3 × 0.85 = 638 ⭐
// Nova annual: 250 × 12 × 0.70 = 2100 ⭐
```

---

## Payment Flow

```
1. User taps "Subscribe" in onboarding or /miniapp/subscriptions
        │
        ▼
2. POST /api/stars/invoice
   { tier: "stars_basic", billingPeriod: "monthly" }
        │
        ▼
3. Backend calls Telegram Bot API:
   createInvoiceLink({
     title: "🌟 Memo Nova",
     description: "...",
     payload: JSON.stringify({ userId, tier, timestamp }),
     currency: "XTR",
     prices: [{ label: "Memo Nova", amount: 250 }]
   })
        │
        ▼
4. Frontend: window.Telegram.WebApp.openInvoice(invoiceLink, callback)
        │
        ▼
5. User pays with Telegram Stars in native Telegram UI
        │
        ▼
6. Telegram sends webhook to /api/stars/webhook:
   - pre_checkout_query → answer OK immediately
   - successful_payment → process payment
        │
        ▼
7. createSubscription(userId, tier, chargeIds, days)
   - INSERT INTO subscriptions
   - UPDATE profiles SET subscription_tier, subscription_ends_at
        │
        ▼
8. Frontend callback: status === "paid"
   → play celebration sound
   → show confetti + thank-you overlay
   → reload profile
```

---

## Subscription Stacking

When a user pays while already having an active subscription of the same tier, the new period is **stacked on top** of the existing end date:

```typescript
const baseDate = (isCurrentlyActive && currentProfile.subscription_tier === tier)
  ? currentEndsAt  // stack on existing
  : new Date();    // start fresh

const endsAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
```

This means users can "top up" their subscription without losing remaining days.

---

## Idempotency

Payments are idempotent via unique constraints on `telegram_payment_charge_id` and `provider_payment_charge_id`. If the same payment webhook is received twice, the second insert fails with `23505` (unique violation) and the existing row is reused.

---

## Effective Tier Calculation

The source of truth is `profiles.subscription_tier` + `profiles.subscription_ends_at`.

```typescript
async function getEffectiveTier(userId: string): Promise<SubscriptionTier> {
  const { subscription_tier, subscription_ends_at } = await getProfile(userId);
  
  // If expiry date is set and has passed, treat as free
  if (subscription_ends_at && new Date(subscription_ends_at) < new Date()) {
    return 'free';
  }
  
  return subscription_tier ?? 'free';
}
```

**Important:** Subscriptions do NOT auto-renew. Users must manually renew. This is by design (Telegram Stars doesn't support recurring billing natively).

---

## Paywall Enforcement

### API-level (server-side)
```typescript
// In /api/entries GET:
const tier = await getEffectiveTier(userId);
const limit = TIER_INFO[tier].limits.entries;
const count = await getEntryCount(userId);

if (count >= limit) {
  return Response.json(
    { error: 'Entry limit reached', feature: 'entries', current: count, limit, required_tier: 'stars_basic' },
    { status: 402 }
  );
}
```

### UI-level (client-side)
```typescript
// In FeedPage:
if (res.status === 402) {
  const data = await res.json();
  setPaywallProps({ feature: data.feature, current: data.current, limit: data.limit, requiredTier: data.required_tier });
  setPaywallOpen(true);
}
```

The `PaywallModal` component handles the full upgrade flow inline without leaving the current page.

---

## Feature Access Map

| Feature | Required Tier |
|---------|--------------|
| AI retrospectives | stars_basic |
| AI recommendations | stars_basic |
| Voice logging | stars_basic |
| Goal tracking | stars_basic |
| Custom widgets (>3) | stars_basic |
| Knowledge graph | stars_basic |
| Extended date ranges (>7d) | stars_basic |
| Full history | stars_pro |
| Data export | stars_pro |
| Priority processing | stars_pro |
| Unlimited entries | stars_pro |

---

## Free Access Grants

Admin scripts in `/scripts/` allow granting free premium access:
- `grant_free_access.sql` — grant free tier permanently
- `grant_nova_7633172724.sql` — grant Nova to specific user
- `grant_pro_434214225.sql` — grant Pro to specific user
- `grant_pro_all_users.sql` — grant Pro to all users (testing)
- `grant_supernova_all.sql` — grant Supernova to all users

These use `free_access_` prefix on `telegram_payment_charge_id` to distinguish from real payments. The trigger skips auto-setting `end_date` for these rows (permanent access).

---

## Renewal Reminders

The mini app shows renewal warnings:
- Subscription card shows days remaining
- Amber badge when ≤ 7 days remaining
- "Expired" badge when past end date
- Renewal CTA shown for expired subscriptions

A `memo_renewal_banner_shown_date` localStorage key prevents showing the banner more than once per day.
