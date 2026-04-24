import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { createSubscription, recordTransaction } from "@/lib/stars/paywall";

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
    let payload: { userId: string; tier: string };
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
