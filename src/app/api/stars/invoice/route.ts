import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { TIER_INFO, type SubscriptionTier, type BillingPeriod, BILLING_PERIODS, calcPrice } from "@/lib/stars/paywall";

interface RequestBody {
  userId: string;
  tier: SubscriptionTier;
  billingPeriod?: BillingPeriod;
}

const VALID_BILLING_PERIODS: BillingPeriod[] = ["monthly", "quarterly", "annual"];

export async function POST(req: Request): Promise<Response> {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    const token = authHeader.slice(7);

    const body = await req.json() as RequestBody;
    const { userId, tier } = body;
    const billingPeriod: BillingPeriod = VALID_BILLING_PERIODS.includes(body.billingPeriod as BillingPeriod)
      ? (body.billingPeriod as BillingPeriod)
      : "monthly";

    if (!userId || !tier || !TIER_INFO[tier] || tier === "free") {
      return new Response(JSON.stringify({ error: "Missing or invalid required fields" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Verify user via token
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user || user.id !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const tierInfo = TIER_INFO[tier];
    const periodInfo = BILLING_PERIODS[billingPeriod];
    const starsAmount = calcPrice(tierInfo.priceStars, billingPeriod);

    if (starsAmount < 1) {
      return new Response(JSON.stringify({ error: "Invalid price" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const periodLabel: Record<BillingPeriod, string> = {
      monthly: "1 місяць",
      quarterly: "3 місяці",
      annual: "1 рік",
    };

    // Keep payload compact — Telegram limit is 128 bytes
    const invoicePayload = JSON.stringify({ userId, tier, billingPeriod, days: periodInfo.days });

    const invoiceTitle = `${tierInfo.icon} ${tierInfo.name} · ${periodLabel[billingPeriod]}`;
    const invoiceDescription = tierInfo.features
      .filter(f => f.included)
      .slice(0, 3)
      .map(f => f.label)
      .join(" · ") || tierInfo.description;

    const tgRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: invoiceTitle,
        description: invoiceDescription,
        payload: invoicePayload,
        provider_token: "",
        currency: "XTR",
        prices: [{ label: `${tierInfo.name} (${periodLabel[billingPeriod]})`, amount: starsAmount }],
      }),
    });

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      console.error("[stars/invoice] Telegram API error:", JSON.stringify(tgData));
      return new Response(JSON.stringify({ error: tgData.description ?? "Failed to create invoice", tgError: tgData }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, invoiceLink: tgData.result, starsAmount, days: periodInfo.days }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stars/invoice] Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
