import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { TIER_INFO, type SubscriptionTier } from "@/lib/stars/paywall";

interface RequestBody {
  userId: string;
  tier: SubscriptionTier;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    const token = authHeader.slice(7);

    const body = await req.json() as RequestBody;
    const { userId, tier } = body;

    if (!userId || !tier || !TIER_INFO[tier]) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Verify user via token
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user || user.id !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const tierInfo = TIER_INFO[tier];

    // Call Telegram Bot API to create invoice link
    const invoicePayload = JSON.stringify({ userId, tier, ts: Date.now() });

    const tgRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${tierInfo.icon} ${tierInfo.name}`,
        description: tierInfo.features.slice(0, 3).join(" · "),
        payload: invoicePayload,
        provider_token: "",          // empty = Telegram Stars
        currency: "XTR",
        prices: [{ label: tierInfo.name, amount: tierInfo.priceStars }],
      }),
    });

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      console.error("[stars/invoice] Telegram API error:", tgData);
      return new Response(JSON.stringify({ error: tgData.description ?? "Failed to create invoice" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, invoiceLink: tgData.result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stars/invoice] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
