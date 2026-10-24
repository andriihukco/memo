import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { SubscriptionTier, TIER_INFO, GRACE_PERIOD_DAYS } from "@/lib/billing/plans";
export type { SubscriptionTier, BillingPeriod, BillingPeriodInfo } from "@/lib/billing/plans";
export { BILLING_PERIODS, calcPrice, TIER_INFO, GRACE_PERIOD_DAYS } from "@/lib/billing/plans";
export type { TierInfo } from "@/lib/billing/plans";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Subscription {
  id: string;
  user_id: string;
  telegram_payment_charge_id: string;
  provider_payment_charge_id: string;
  tier: SubscriptionTier;
  status: "active" | "past_due" | "canceled" | "paused";
  start_date: string;
  end_date: string | null;
}

export interface SubscriptionTransaction {
  id: string;
  subscription_id: string;
  user_id: string;
  amount: number;
  currency: string;
  telegram_payment_charge_id: string;
  provider_payment_charge_id: string;
  description: string | null;
  status: "pending" | "succeeded" | "failed" | "refunded";
  created_at: string;
}

export interface PaymentLink {
  url: string;
  invoice_payload: string;
}

// ── Supabase ──────────────────────────────────────────────────────────────────

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ── Subscription Management ───────────────────────────────────────────────────

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const supabase = getServiceClient();
  
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error("[paywall] getSubscription error:", error.message);
    return null;
  }

  return data;
}

export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const supabase = getServiceClient();
  
  const { data, error } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("[paywall] getUserTier error:", error.message);
    return "free";
  }

  return (data.subscription_tier as SubscriptionTier) || "free";
}

export async function hasPremiumAccess(userId: string): Promise<boolean> {
  const tier = await getUserTier(userId);
  return tier === "stars_basic" || tier === "stars_pro";
}

export async function createSubscription(
  userId: string,
  tier: SubscriptionTier,
  telegramPaymentChargeId: string,
  providerPaymentChargeId: string,
  days = 30
): Promise<string | null> {
  const supabase = getServiceClient();

  // Calculate expiry — stack on top of existing active subscription if same tier
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("subscription_ends_at, subscription_tier")
    .eq("id", userId)
    .single();

  const currentEndsAt = currentProfile?.subscription_ends_at
    ? new Date(currentProfile.subscription_ends_at)
    : null;
  const isCurrentlyActive = currentEndsAt && currentEndsAt > new Date();
  const baseDate = (isCurrentlyActive && currentProfile?.subscription_tier === tier)
    ? currentEndsAt!
    : new Date();
  const endsAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  // Insert subscription row — use INSERT ... ON CONFLICT DO NOTHING to be idempotent
  // (both telegram_payment_charge_id and provider_payment_charge_id are unique)
  const { data: subData, error: subError } = await supabase
    .from("subscriptions")
    .insert({
      user_id: userId,
      tier,
      status: "active",
      start_date: new Date().toISOString(),
      end_date: endsAt,
      telegram_payment_charge_id: telegramPaymentChargeId,
      provider_payment_charge_id: providerPaymentChargeId,
    })
    .select("id")
    .single();

  if (subError) {
    // Duplicate charge ID means this payment was already processed — look up existing row
    if (subError.code === "23505") {
      const { data: existing } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("telegram_payment_charge_id", telegramPaymentChargeId)
        .single();
      if (existing) {
        console.log("[paywall] createSubscription: duplicate payment, reusing existing subscription row");
        // Still update profile below
      }
    } else {
      console.error("[paywall] createSubscription insert error:", subError.message);
      // Still update the profile even if subscription row failed
    }
  }

  // Always update the profile — this is the source of truth for the app
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      subscription_tier: tier,
      subscription_status: "active",
      subscription_ends_at: endsAt,
      subscription_start_date: new Date().toISOString(),
    })
    .eq("id", userId);

  if (profileError) {
    console.error("[paywall] createSubscription profile update error:", profileError.message);
    return null;
  }

  // Try to get the subscription id — either from the new insert or the existing row
  if (subData?.id) return subData.id;

  const { data: existingRow } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("telegram_payment_charge_id", telegramPaymentChargeId)
    .single();

  return existingRow?.id ?? null;
}

export async function cancelSubscription(userId: string): Promise<boolean> {
  const supabase = getServiceClient();

  const { error } = await supabase.rpc("downgrade_subscription", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[paywall] cancelSubscription error:", error.message);
    return false;
  }

  return true;
}

export async function recordTransaction(
  subscriptionId: string,
  userId: string,
  amount: number,
  telegramPaymentChargeId: string,
  providerPaymentChargeId: string,
  description: string
): Promise<string | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("subscription_transactions")
    .insert({
      subscription_id: subscriptionId,
      user_id: userId,
      amount,
      currency: "XDR",
      telegram_payment_charge_id: telegramPaymentChargeId,
      provider_payment_charge_id: providerPaymentChargeId,
      description,
      status: "succeeded",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[paywall] recordTransaction error:", error.message);
    return null;
  }

  return data.id;
}

// ── Effective Tier & Usage Helpers ────────────────────────────────────────────

/**
 * Returns the user's effective subscription tier, accounting for expiry.
 * If `subscription_ends_at` is set and in the past, returns "free".
 */
export async function getEffectiveTier(userId: string): Promise<SubscriptionTier> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("subscription_tier, subscription_ends_at")
    .eq("id", userId)
    .single();

  if (error || !data) {
    console.error("[paywall] getEffectiveTier error:", error?.message);
    return "free";
  }

  const tier = (data.subscription_tier as SubscriptionTier) || "free";

  // Keep paid access for GRACE_PERIOD_DAYS after expiry (failed renewal), then downgrade
  if (data.subscription_ends_at) {
    const graceEndsAt = new Date(data.subscription_ends_at).getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    if (graceEndsAt < Date.now()) return "free";
  }

  return tier;
}

/**
 * Returns the current usage counts for entries, widgets, and reports for a user.
 * Widgets are stored as a JSON array in profiles.settings.custom_widgets.
 */
export async function getUserUsageCounts(
  userId: string
): Promise<{ entries: number; widgets: number; reports: number }> {
  const supabase = getServiceClient();

  const [entriesResult, reportsResult, profileResult] = await Promise.all([
    supabase
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single(),
  ]);

  const entries = entriesResult.count ?? 0;
  const reports = reportsResult.count ?? 0;

  const settings = (profileResult.data?.settings as Record<string, unknown>) ?? {};
  const customWidgets = (settings.custom_widgets as unknown[]) ?? [];
  // Count all custom widgets (both AI and direct) against the limit
  const widgets = customWidgets.length;

  return { entries, widgets, reports };
}

// ── Feature Access Control ────────────────────────────────────────────────────

export interface FeatureAccess {
  hasAccess: boolean;
  requiredTier?: SubscriptionTier;
  featureName: string;
}

export const FEATURE_TIERS: Record<string, SubscriptionTier> = {
  ai_reports:           "stars_basic",
  ai_recommendations:   "stars_basic",
  voice_logging:        "free",        // available to all users
  goal_tracking:        "stars_basic",
  custom_widgets:       "stars_basic",
  full_history:         "stars_pro",
  graph_full:           "stars_basic",
  data_export:          "stars_pro",
  priority_processing:  "stars_pro",
};

export async function checkFeatureAccess(
  userId: string,
  feature: keyof typeof FEATURE_TIERS
): Promise<FeatureAccess> {
  const requiredTier = FEATURE_TIERS[feature] ?? "free";
  const userTier = await getUserTier(userId);

  const tierRank: Record<SubscriptionTier, number> = { free: 0, stars_basic: 1, stars_pro: 2 };
  const hasAccess = tierRank[userTier] >= tierRank[requiredTier as SubscriptionTier];

  return {
    hasAccess,
    requiredTier: requiredTier !== "free" ? (requiredTier as SubscriptionTier) : undefined,
    featureName: feature,
  };
}

// ── Tier Information ──────────────────────────────────────────────────────────

export function generatePaymentInvoice(
  userId: string,
  tier: SubscriptionTier
): {
  title: string;
  description: string;
  payload: string;
  provider_token: string;
  currency: string;
  prices: { label: string; amount: number }[];
  max_tip_amount?: number;
  suggested_tip_amounts?: number[];
  start_parameter: string;
  need_name?: boolean;
  need_phone_number?: boolean;
  need_email?: boolean;
  need_shipping_address?: boolean;
  send_phone_number_to_provider?: boolean;
  send_email_to_provider?: boolean;
  is_flexible?: boolean;
} {
  const tierInfo = TIER_INFO[tier];

  return {
    title: `${tierInfo.icon} ${tierInfo.name}`,
    description: `${tierInfo.description}\n\n${tierInfo.features.filter(f => f.included).slice(0, 3).map(f => f.label).join("\n")}`,
    payload: JSON.stringify({
      userId,
      tier,
      timestamp: Date.now(),
    }),
    provider_token: "", // Set in environment when needed
    currency: "XTR",  // Telegram Stars currency code
    prices: [
      { label: tierInfo.name, amount: tierInfo.priceStars },
    ],
    max_tip_amount: 1000,
    suggested_tip_amounts: [100, 250, 500, 1000],
    start_parameter: `subscribe-${tier}`,
    need_name: false,
    need_phone_number: false,
    need_email: false,
    need_shipping_address: false,
    send_phone_number_to_provider: false,
    send_email_to_provider: false,
    is_flexible: false,
  };
}

// ── Verify Payment ────────────────────────────────────────────────────────────

export async function verifyPayment(
  telegramPaymentChargeId: string
): Promise<{
  success: boolean;
  userId?: string;
  tier?: SubscriptionTier;
  error?: string;
}> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select("user_id, tier")
    .eq("telegram_payment_charge_id", telegramPaymentChargeId)
    .single();

  if (error || !data) {
    return {
      success: false,
      error: "Payment not found",
    };
  }

  return {
    success: true,
    userId: data.user_id,
    tier: data.tier as SubscriptionTier,
  };
}
