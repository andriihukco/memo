import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { generatePaymentInvoice } from "@/lib/stars/paywall";

interface RequestBody {
  userId: string;
  tier: "stars_basic" | "stars_pro";
  telegramId: number;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json() as RequestBody;
    const { userId, tier, telegramId } = body;

    if (!userId || !tier || !telegramId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Verify user exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, telegram_id, username")
      .eq("id", userId)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate payment invoice
    const invoice = generatePaymentInvoice(
      profile.id,
      tier
    );

    // Store invoice data for verification
    const { error: insertError } = await supabase
      .from("subscription_invoices")
      .insert({
        user_id: profile.id,
        tier,
        invoice_payload: invoice.payload,
        amount: invoice.prices[0].amount,
        currency: invoice.currency,
        status: "pending",
      })
      .select();

    if (insertError) {
      console.error("[stars/invoice] Failed to store invoice:", insertError.message);
      // Continue anyway - the invoice is still valid
    }

    // Return invoice URL for Telegram
    // In production, this would be handled by Telegram's invoice API
    // For now, return the invoice data for the frontend to use
    return new Response(JSON.stringify({
      success: true,
      invoice,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stars/invoice] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
