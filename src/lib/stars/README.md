# Telegram Stars Paywall

This directory contains the implementation for Telegram Stars-based subscription payments.

## Overview

The paywall system allows users to subscribe to different tiers using Telegram Stars (Telegram's native cryptocurrency). Subscriptions provide access to premium features.

## Tiers

| Tier | Price | Features |
|------|-------|----------|
| Free | 0 ⭐ | Basic diary features, 30-day archive |
| Stars Basic | 250 ⭐ (~$3/mo) | Smart recommendations, detailed reports, 1-year archive |
| Stars Pro | 750 ⭐ (~$9/mo) | All Basic features + advanced analytics, custom widgets |

## Database Schema

### Tables

1. **subscriptions** - Tracks active subscriptions
   - `user_id` - User's profile ID
   - `tier` - Subscription tier (free, stars_basic, stars_pro)
   - `status` - Subscription status (active, past_due, canceled, paused)
   - `start_date` - When subscription started
   - `end_date` - When subscription expires (auto-calculated)

2. **subscription_transactions** - Payment history
   - `subscription_id` - Link to subscription
   - `amount` - Payment amount in Stars
   - `currency` - Always 'XDR' (Telegram's currency code)
   - `telegram_payment_charge_id` - Telegram's payment ID
   - `provider_payment_charge_id` - Provider's payment ID
   - `status` - Payment status (pending, succeeded, failed, refunded)

3. **subscription_invoices** - Invoice tracking
   - `user_id` - User's profile ID
   - `tier` - Subscription tier
   - `invoice_payload` - JSON payload for verification
   - `amount` - Invoice amount
   - `status` - Invoice status (pending, completed, failed, expired)

### Profile Updates

The `profiles` table has these additional columns:
- `subscription_tier` - Current tier
- `subscription_status` - Current status
- `subscription_ends_at` - Expiration date

## API Endpoints

### `/api/stars/invoice`

Generates a payment invoice for a subscription tier.

**POST** `/api/stars/invoice`

```json
{
  "userId": "uuid",
  "tier": "stars_basic",
  "telegramId": 123456789
}
```

**Response:**
```json
{
  "success": true,
  "invoice": {
    "title": "🌟 Stars Basic",
    "description": "...",
    "payload": "...",
    "provider_token": "...",
    "currency": "XDR",
    "prices": [{"label": "Stars Basic", "amount": 250}]
  },
  "telegramUrl": "https://t.me/bot?start=subscribe-stars_basic"
}
```

### Payment webhook

Payment updates arrive through the bot webhook, `POST /api/telegram/webhook`. That route verifies the `X-Telegram-Bot-Api-Secret-Token` header before handling:
- `pre_checkout_query` - Pre-checkout verification
- `message:successful_payment` - Payment completed; creates the subscription

A separate, unauthenticated `/api/stars/webhook` route used to exist. It was removed because anyone could POST a fake `successful_payment` and grant a subscription.

## Frontend Components

### `/miniapp/subscriptions`

Subscription management page showing:
- Current subscription status
- Available tiers with features
- Subscribe/Cancel buttons

## Usage

### Check User Tier

```typescript
import { getUserTier, hasPremiumAccess } from "@/lib/stars/paywall";

const tier = await getUserTier(userId);
const hasAccess = await hasPremiumAccess(userId);
```

### Check Feature Access

```typescript
import { checkFeatureAccess } from "@/lib/stars/paywall";

const access = checkFeatureAccess(userId, "recommendations");
if (!access.hasAccess) {
  // Show upgrade prompt
}
```

### Create Subscription

```typescript
import { createSubscription } from "@/lib/stars/paywall";

const subscriptionId = await createSubscription(
  userId,
  "stars_basic",
  telegramPaymentChargeId,
  providerPaymentChargeId
);
```

### Cancel Subscription

```typescript
import { cancelSubscription } from "@/lib/stars/paywall";

await cancelSubscription(userId);
```

## Setup

1. **Run the migration:**
   ```bash
   supabase db push
   ```

2. **Configure environment variables:**
   ```env
   STARS_PROVIDER_TOKEN=your_stars_provider_token
   TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
   TELEGRAM_BOT_USERNAME=your_bot_username
   ```

3. **Set up Telegram BotFather:**
   - Create a new bot or use existing
   - Configure payment provider with Telegram Stars
   - Set the bot webhook URL to your `/api/telegram/webhook` endpoint, with `secret_token` set to `TELEGRAM_WEBHOOK_SECRET`

4. **Deploy:**
   ```bash
   vercel deploy
   ```

## Security

- All payments are verified through Telegram's secure payment system
- Webhook endpoint validates Telegram signatures
- RLS policies ensure users can only access their own data
- Invoice payloads are stored for verification

## Testing

1. Use Telegram's test mode for Stars payments
2. Test with small amounts first
3. Verify webhook delivery in Vercel logs
4. Check database for subscription records
