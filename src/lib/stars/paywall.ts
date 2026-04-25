import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SubscriptionTier = "free" | "stars_basic" | "stars_pro";

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
  providerPaymentChargeId: string
): Promise<string | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase.rpc("upgrade_subscription", {
    p_user_id: userId,
    p_tier: tier,
    p_telegram_payment_charge_id: telegramPaymentChargeId,
    p_provider_payment_charge_id: providerPaymentChargeId,
  });

  if (error) {
    console.error("[paywall] createSubscription error:", error.message);
    return null;
  }

  return data;
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

// ── Feature Access Control ────────────────────────────────────────────────────

export interface FeatureAccess {
  hasAccess: boolean;
  requiredTier?: SubscriptionTier;
  featureName: string;
}

const FEATURE_TIERS: Record<string, SubscriptionTier> = {
  recommendations:      "stars_basic",
  detailed_reports:     "stars_basic",
  advanced_analytics:   "stars_pro",
  custom_widgets:       "stars_pro",
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

export interface TierInfo {
  tier: SubscriptionTier;
  name: string;
  priceStars: number;
  description: string;
  features: string[];
  icon: string;
}

export const TIER_INFO: Record<SubscriptionTier, TierInfo> = {
  free: {
    tier: "free",
    name: "Безкоштовний",
    priceStars: 0,
    description: "Основні функції для початку",
    features: [
      "Записи щоденника",
      "Базові звіти",
      "Архів за 30 днів",
      "Безкоштовна підтримка",
    ],
    icon: "⭐",
  },
  stars_basic: {
    tier: "stars_basic",
    name: "Stars Basic",
    priceStars: 250,
    description: "Розширені аналітичні можливості",
    features: [
      "Розумні рекомендації",
      "Детальні звіти",
      "Архів за 1 рік",
      "Пріоритетна підтримка",
    ],
    icon: "🌟",
  },
  stars_pro: {
    tier: "stars_pro",
    name: "Stars Pro",
    priceStars: 500,
    description: "Повний доступ до всіх функцій",
    features: [
      "Усі функції Basic",
      "Розширена аналітика",
      "Кастомні віджети",
      "Хмарне синхронізація",
      "Пріоритетна обробка",
    ],
    icon: "💎",
  },
};

// ── Generate Payment Invoice ──────────────────────────────────────────────────

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
    description: `${tierInfo.description}\n\n${tierInfo.features.slice(0, 3).join("\n")}`,
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
