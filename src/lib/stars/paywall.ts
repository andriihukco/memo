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

  // If there's an expiry date and it has passed, treat as free
  if (data.subscription_ends_at && new Date(data.subscription_ends_at) < new Date()) {
    return "free";
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
  voice_logging:        "stars_basic",
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

export interface TierInfo {
  tier: SubscriptionTier;
  name: string;
  priceStars: number;
  description: string;
  icon: string;
  limits: {
    entries: number;       // Infinity for unlimited
    widgets: number;
    reports: number;
    historyDays: number;
  };
  features: { label: string; included: boolean }[];
}

export const TIER_INFO: Record<SubscriptionTier, TierInfo> = {
  free: {
    tier: "free",
    name: "Безкоштовний",
    priceStars: 0,
    description: "Основні функції для початку",
    icon: "⭐",
    limits: {
      entries: 100,
      widgets: 3,
      reports: 5,
      historyDays: 30,
    },
    features: [
      { label: "До 100 записів",          included: true  },
      { label: "3 активних віджети",       included: true  },
      { label: "5 ретроспектив",           included: true  },
      { label: "Стрічка за 30 днів",       included: true  },
      { label: "Шифрування записів",       included: true  },
      { label: "Пін-код захист",           included: true  },
      { label: "AI ретроспективи",         included: false },
      { label: "AI рекомендації",          included: false },
      { label: "Голосові повідомлення",    included: false },
      { label: "Трекінг цілей",            included: false },
      { label: "Кастомні віджети (AI)",    included: false },
      { label: "Повна історія",            included: false },
      { label: "Експорт даних",            included: false },
      { label: "Пріоритетна обробка",      included: false },
    ],
  },
  stars_basic: {
    tier: "stars_basic",
    name: "Stars Basic",
    priceStars: 250,
    description: "Розширені аналітичні можливості",
    icon: "🌟",
    limits: {
      entries: 2000,
      widgets: 15,
      reports: 50,
      historyDays: 365,
    },
    features: [
      { label: "До 2 000 записів",         included: true  },
      { label: "15 активних віджетів",     included: true  },
      { label: "50 ретроспектив",          included: true  },
      { label: "Стрічка за 1 рік",         included: true  },
      { label: "Шифрування записів",       included: true  },
      { label: "Пін-код захист",           included: true  },
      { label: "AI ретроспективи",         included: true  },
      { label: "AI рекомендації",          included: true  },
      { label: "Голосові повідомлення",    included: true  },
      { label: "Трекінг цілей",            included: true  },
      { label: "Кастомні віджети (AI)",    included: true  },
      { label: "Повна історія",            included: false },
      { label: "Експорт даних",            included: false },
      { label: "Пріоритетна обробка",      included: false },
    ],
  },
  stars_pro: {
    tier: "stars_pro",
    name: "Stars Pro",
    priceStars: 500,
    description: "Повний доступ до всіх функцій",
    icon: "💎",
    limits: {
      entries: Infinity,
      widgets: Infinity,
      reports: Infinity,
      historyDays: Infinity,
    },
    features: [
      { label: "До необмеженої кількості записів", included: true },
      { label: "Необмежені віджети",               included: true },
      { label: "Необмежені ретроспективи",         included: true },
      { label: "Повна стрічка",                    included: true },
      { label: "Шифрування записів",               included: true },
      { label: "Пін-код захист",                   included: true },
      { label: "AI ретроспективи",                 included: true },
      { label: "AI рекомендації",                  included: true },
      { label: "Голосові повідомлення",             included: true },
      { label: "Трекінг цілей",                    included: true },
      { label: "Кастомні віджети (AI)",             included: true },
      { label: "Повна історія",                    included: true },
      { label: "Експорт даних",                    included: true },
      { label: "Пріоритетна обробка",              included: true },
    ],
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
