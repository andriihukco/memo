export const runtime = "nodejs";

import { Bot, Context, webhookCallback } from "grammy";
import { env } from "@/lib/env";
import { resolveOrCreateProfile, ProfileError, Profile } from "@/lib/profile";
import { handleTextMessage } from "@/lib/bot/handlers/text";
import { handleVoiceMessage } from "@/lib/bot/handlers/voice";
import { handleStart, handleHelp, handleReport, handleStats, handleRecommendations } from "@/lib/bot/commands";
import { createSubscription, recordTransaction } from "@/lib/stars/paywall";

interface BotContext extends Context {
  profile?: Profile;
}

let _handleUpdate: ((req: Request) => Promise<Response>) | null = null;

function getHandler(): (req: Request) => Promise<Response> {
  if (_handleUpdate) return _handleUpdate;

  const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN);

  // ── Profile middleware ──────────────────────────────────────────────────────
  bot.use(async (ctx, next) => {
    const from = ctx.from;
    if (!from) return next();
    try {
      ctx.profile = await resolveOrCreateProfile(BigInt(from.id), from.username ?? "");
    } catch (err) {
      if (err instanceof ProfileError) {
        console.error("[webhook] ProfileError:", err.message, err.cause);
        await ctx.reply("⚠️ We couldn't set up your profile right now. Please try again in a moment.");
        return;
      }
      throw err;
    }
    return next();
  });

  // ── Commands ────────────────────────────────────────────────────────────────
  bot.command("start", handleStart);
  bot.command("help", handleHelp);
  bot.command("stats", handleStats);
  bot.command("report", handleReport);
  bot.command("recommendations", handleRecommendations);

  // ── Stars: pre-checkout — must answer within 10s ────────────────────────────
  bot.on("pre_checkout_query", async (ctx) => {
    try {
      // Always approve — we validate on successful_payment
      await ctx.answerPreCheckoutQuery(true);
    } catch (err) {
      console.error("[webhook] pre_checkout_query error:", err);
      await ctx.answerPreCheckoutQuery(false, "Щось пішло не так. Спробуй ще раз.");
    }
  });

  // ── Stars: successful payment — grant subscription ──────────────────────────
  bot.on("message:successful_payment", async (ctx) => {
    try {
      const payment = ctx.message.successful_payment;
      const profile = ctx.profile;
      if (!profile) return;

      // Parse payload
      let payload: { userId: string; tier: string };
      try {
        payload = JSON.parse(payment.invoice_payload);
      } catch {
        console.error("[webhook] invalid payment payload");
        return;
      }

      const tier = payload.tier as "stars_basic" | "stars_pro";
      const chargeId = payment.telegram_payment_charge_id;
      const providerChargeId = payment.provider_payment_charge_id;

      // Create subscription in DB
      const subscriptionId = await createSubscription(
        profile.id,
        tier,
        chargeId,
        providerChargeId
      );

      if (subscriptionId) {
        await recordTransaction(
          subscriptionId,
          profile.id,
          payment.total_amount,
          chargeId,
          providerChargeId,
          `Stars payment for ${tier}`
        );
      }

      // Confirm to user
      const tierNames: Record<string, string> = { stars_basic: "Stars Basic 🌟", stars_pro: "Stars Pro 💎" };
      await ctx.reply(
        `✅ Оплата успішна! Підписка *${tierNames[tier] ?? tier}* активована.\n\nДякуємо за підтримку! Відкрий міні-додаток щоб побачити всі функції.`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error("[webhook] successful_payment error:", err);
    }
  });

  bot.on("message:text", handleTextMessage);
  bot.on("message:voice", handleVoiceMessage);

  _handleUpdate = webhookCallback(bot, "std/http", {
    timeoutMilliseconds: 24_000,
    onTimeout: "return",
  });

  return _handleUpdate;
}

export async function POST(req: Request): Promise<Response> {
  try {
    return await getHandler()(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[webhook] rejected request:", message);
    return new Response("Forbidden", { status: 403 });
  }
}
