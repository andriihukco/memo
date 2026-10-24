/**
 * Plan definitions shared by server and client code.
 *
 * Keep this file free of server-only imports (env, Supabase service client).
 * Client components import plan data from here, not from stars/paywall.ts,
 * because paywall.ts pulls in server-only environment validation.
 */

export type SubscriptionTier = "free" | "stars_basic" | "stars_pro";
export type BillingPeriod = "monthly" | "quarterly" | "annual";

export interface BillingPeriodInfo {
  period: BillingPeriod;
  label: string;
  months: number;
  days: number;
  discountPct: number; // 0 = no discount
  badge?: string;
}

export const BILLING_PERIODS: Record<BillingPeriod, BillingPeriodInfo> = {
  monthly: {
    period: "monthly",
    label: "Місяць",
    months: 1,
    days: 30,
    discountPct: 0,
  },
  quarterly: {
    period: "quarterly",
    label: "3 місяці",
    months: 3,
    days: 90,
    discountPct: 15,
    badge: "−15%",
  },
  annual: {
    period: "annual",
    label: "Рік",
    months: 12,
    days: 365,
    discountPct: 30,
    badge: "−30%",
  },
};

/** Calculate Stars price for a tier + billing period, applying discount */
export function calcPrice(baseMonthlyStars: number, period: BillingPeriod): number {
  const { months, discountPct } = BILLING_PERIODS[period];
  const total = baseMonthlyStars * months;
  return Math.round(total * (1 - discountPct / 100));
}

export interface TierInfo {
  tier: SubscriptionTier;
  name: string;
  priceStars: number;
  description: string;
  icon: string;
  limits: {
    entries: number;
    ai_widgets: number;    // AI-generated custom widgets (limited)
    widgets: number;       // total widgets shown (preset + ai) — kept for backward compat
    reports: number;
    historyDays: number;
    dailyEntries: number;   // fair-use cap on new entries per day (anti-abuse)
    maxEntryChars: number;  // max length of one entry
    voiceMaxSeconds: number; // max length of one voice message
  };
  features: { label: string; included: boolean }[];
}

/** Days of access kept after a failed renewal before the plan downgrades. */
export const GRACE_PERIOD_DAYS = 3;

export const TIER_INFO: Record<SubscriptionTier, TierInfo> = {
  free: {
    tier: "free",
    name: "Memo Spark",
    priceStars: 0,
    description: "Починай безкоштовно, назавжди",
    icon: "✨",
    limits: {
      entries: 300,
      ai_widgets: 3,
      widgets: 3,
      reports: 5,
      historyDays: 30,
      dailyEntries: 20,
      maxEntryChars: 2000,
      voiceMaxSeconds: 60,
    },
    features: [
      { label: "До 300 записів",                  included: true  },
      { label: "3 AI-віджети",                     included: true  },
      { label: "Необмежені preset-віджети",        included: true  },
      { label: "5 ретроспектив",                   included: true  },
      { label: "Стрічка за 30 днів",               included: true  },
      { label: "Шифрування записів",               included: true  },
      { label: "Пін-код захист",                   included: true  },
      { label: "Голосові повідомлення",             included: true  },
      { label: "AI ретроспективи",                 included: false },
      { label: "AI рекомендації",                  included: false },
      { label: "Трекінг цілей",                    included: false },
      { label: "Більше AI-віджетів (до 15)",       included: false },
      { label: "Граф зв'язків",                    included: false },
      { label: "Повна історія",                    included: false },
    ],
  },
  stars_basic: {
    tier: "stars_basic",
    name: "Memo Nova",
    priceStars: 250,
    description: "Розкрий повну силу AI-щоденника",
    icon: "🌟",
    limits: {
      entries: 2000,
      ai_widgets: 15,
      widgets: 15,
      reports: 50,
      historyDays: 365,
      dailyEntries: 100,
      maxEntryChars: 4000,
      voiceMaxSeconds: 180,
    },
    features: [
      { label: "До 2 000 записів",              included: true  },
      { label: "15 AI-віджетів",                included: true  },
      { label: "Необмежені preset-віджети",     included: true  },
      { label: "50 ретроспектив",               included: true  },
      { label: "Стрічка за 1 рік",              included: true  },
      { label: "Шифрування записів",            included: true  },
      { label: "Пін-код захист",                included: true  },
      { label: "AI ретроспективи",              included: true  },
      { label: "AI рекомендації",               included: true  },
      { label: "Голосові повідомлення",         included: true  },
      { label: "Трекінг цілей",                 included: true  },
      { label: "Граф зв'язків",                 included: true  },
      { label: "Повна історія",                 included: false },
      { label: "Експорт даних",                 included: false },
    ],
  },
  stars_pro: {
    tier: "stars_pro",
    name: "Memo Supernova",
    priceStars: 500,
    description: "Безмежний AI-щоденник без обмежень",
    icon: "💫",
    limits: {
      entries: Infinity,
      ai_widgets: Infinity,
      widgets: Infinity,
      reports: Infinity,
      historyDays: Infinity,
      dailyEntries: 300,
      maxEntryChars: 8000,
      voiceMaxSeconds: 300,
    },
    features: [
      { label: "Необмежені записи",             included: true },
      { label: "Необмежені AI-віджети",         included: true },
      { label: "Необмежені ретроспективи",      included: true },
      { label: "Повна стрічка",                 included: true },
      { label: "Шифрування записів",            included: true },
      { label: "Пін-код захист",                included: true },
      { label: "AI ретроспективи",              included: true },
      { label: "AI рекомендації",               included: true },
      { label: "Голосові повідомлення",         included: true },
      { label: "Трекінг цілей",                 included: true },
      { label: "Граф зв'язків",                 included: true },
      { label: "Повна історія",                 included: true },
      { label: "Експорт даних",                 included: true },
      { label: "Пріоритетна обробка",           included: true },
    ],
  },
};

// ── Generate Payment Invoice ──────────────────────────────────────────────────
