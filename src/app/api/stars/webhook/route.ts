import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { createSubscription, recordTransaction } from "@/lib/stars/paywall";

// ── Referral reward helper ────────────────────────────────────────────────────

/**
 * When a referred user makes their first monthly subscription purchase,
 * grant 30 days of Nova (stars_basic) to both the referrer and the referred user.
 * Only triggers once per referral row (reward_granted / referred_reward_granted flags).
 */
async function grantReferralRewards(
  supabase: ReturnType<typeof createClient>,
  referredUserId: string,
  tier: string,
  billingPeriod?: string
): Promise<void> {
  // Only reward on monthly purchases (not quarterly/annual — those are already discounted)
  if (billingPeriod && billingPeriod !== "monthly") return;

  // Find an unclaimed referral where this user is the referred party
  const { data: referral } = await supabase
    .from("referrals")
    .select("id, referrer_id, reward_granted, referred_reward_granted")
    .eq("referred_id", referredUserId)
    .maybeSingle();

  if (!referral) return; // User wasn't referred

  const REWARD_DAYS = 30;
  const REWARD_TIER = "stars_basic";
  const now = new Date();

  // Grant reward to referrer (if not already granted)
  if (!referral.reward_granted) {
    const { data: referrerProfile } = await supabase
      .from("profiles")
      .select("subscription_tier, subscription_ends_at")
      .eq("id", referral.referrer_id)
      .maybeSingle();

    if (referrerProfile) {
      // Stack on top of existing subscription if active
      const currentEndsAt = referrerProfile.subscription_ends_at
        ? new Date(referrerProfile.subscription_ends_at)
        : null;
      const isActive = currentEndsAt && currentEndsAt > now;
      const baseDate = isActive ? currentEndsAt! : now;
      const newEndsAt = new Date(baseDate.getTime() + REWARD_DAYS * 24 * 60 * 60 * 1000).toISOString();

      await supabase
        .from("profiles")
        .update({
          subscription_tier: REWARD_TIER,
          subscription_status: "active",
          subscription_ends_at: newEndsAt,
          subscription_start_date: isActive ? referrerProfile.subscription_ends_at : now.toISOString(),
        })
        .eq("id", referral.referrer_id);

      await supabase
        .from("referrals")
        .update({ reward_granted: true })
        .eq("id", referral.id);

      console.log(`[referral] Granted ${REWARD_DAYS} days Nova to referrer ${referral.referrer_id}`);
    }
  }

  // Grant reward to referred user (if not already granted)
  if (!referral.referred_reward_granted) {
    const { data: referredProfile } = await supabase
      .from("profiles")
      .select("subscription_tier, subscription_ends_at")
      .eq("id", referredUserId)
      .maybeSingle();

    if (referredProfile) {
      // Stack on top of the subscription they just purchased
      const currentEndsAt = referredProfile.subscription_ends_at
        ? new Date(referredProfile.subscription_ends_at)
        : null;
      const isActive = currentEndsAt && currentEndsAt > now;
      const baseDate = isActive ? currentEndsAt! : now;
      const newEndsAt = new Date(baseDate.getTime() + REWARD_DAYS * 24 * 60 * 60 * 1000).toISOString();

      await supabase
        .from("profiles")
        .update({
          subscription_tier: REWARD_TIER,
          subscription_status: "active",
          subscription_ends_at: newEndsAt,
        })
        .eq("id", referredUserId);

      await supabase
        .from("referrals")
        .update({ referred_reward_granted: true })
        .eq("id", referral.id);

      console.log(`[referral] Granted ${REWARD_DAYS} days Nova to referred user ${referredUserId}`);
    }
  }
}

// ── Webhook Handler ───────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  try {
    const payload = await req.json();

    // Handle successful payment
    if (payload.successful_payment) {
      await handleSuccessfulPayment(payload.successful_payment);
      return new Response("OK", { status: 200 });
    }

    // Handle pre-checkout query
    if (payload.pre_checkout_query) {
      await handlePreCheckoutQuery(payload.pre_checkout_query);
      return new Response("OK", { status: 200 });
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[stars/webhook] Error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────

async function handleSuccessfulPayment(payment: {
  message_id: number;
  chat: { id: number };
  invoice_payload: string;
  currency: string;
  total_amount: number;
  telegram_payment_charge_id: string;
  provider_payment_charge_id: string;
}) {
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Parse invoice payload
    let payload: { userId: string; tier: string; billingPeriod?: string };
    try {
      payload = JSON.parse(payment.invoice_payload);
    } catch {
      console.error("[stars/webhook] Invalid invoice payload");
      return;
    }

    const userId = payload.userId;
    const tier = payload.tier as "stars_basic" | "stars_pro";

    if (!userId || !tier) {
      console.error("[stars/webhook] Missing userId or tier in payload");
      return;
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("telegram_id", payment.chat.id)
      .single();

    if (profileError || !profile) {
      console.error("[stars/webhook] User not found:", profileError?.message);
      return;
    }

    // Create subscription
    const subscriptionId = await createSubscription(
      profile.id,
      tier,
      payment.telegram_payment_charge_id,
      payment.provider_payment_charge_id
    );

    if (!subscriptionId) {
      console.error("[stars/webhook] Failed to create subscription");
      return;
    }

    // Record transaction
    await recordTransaction(
      subscriptionId,
      profile.id,
      payment.total_amount,
      payment.telegram_payment_charge_id,
      payment.provider_payment_charge_id,
      `Telegram Stars payment for ${tier} tier`
    );

    // ── Referral reward ───────────────────────────────────────────────────────
    // If this user was referred, grant 30 days Nova to both the referrer and the
    // referred user (only on their first monthly purchase).
    try {
      await grantReferralRewards(supabase, profile.id, tier, payload.billingPeriod);
    } catch (err) {
      console.error("[stars/webhook] referral reward error:", err);
      // Non-fatal
    }

    console.log(`[stars/webhook] Payment successful: ${payment.telegram_payment_charge_id}`);
  } catch (err) {
    console.error("[stars/webhook] handleSuccessfulPayment error:", err);
  }
}

async function handlePreCheckoutQuery(query: {
  id: string;
  from: { id: number };
  invoice_payload: string;
  currency: string;
  total_amount: number;
}) {
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Verify user exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("telegram_id", query.from.id)
      .single();

    if (!profile) {
      console.error("[stars/webhook] User not found for pre-checkout");
      return;
    }

    // Accept the pre-checkout query
    // This would be done via Telegram API:
    // await bot.api.answerPreCheckoutQuery(query.id, true);
  } catch (err) {
    console.error("[stars/webhook] handlePreCheckoutQuery error:", err);
  }
}
