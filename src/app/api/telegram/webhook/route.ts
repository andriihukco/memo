export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { Bot, Context, webhookCallback, InlineKeyboard } from "grammy";
import { env } from "@/lib/env";
import { resolveOrCreateProfile, ProfileError, Profile } from "@/lib/profile";
import { handleTextMessage } from "@/lib/bot/handlers/text";
import { handleVoiceMessage } from "@/lib/bot/handlers/voice";
import { handleStart, handleHelp, handleReport, handleReportDaily, handleReportWeekly, handleReportMonthly, handleStats, handleRecommendations, handleCallbackQuery, handleRemind, handleInvite, handleCancel } from "@/lib/bot/commands";
import { createSubscription, recordTransaction } from "@/lib/stars/paywall";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

interface BotContext extends Context {
  profile?: Profile;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Referral helpers ──────────────────────────────────────────────────────────

/**
 * Handle /start with a ref_<code> deep-link parameter.
 * Records the referred_id in the referrals table (if not already set),
 * then shows a personalised referral welcome message.
 */
async function handleStartWithReferral(ctx: BotContext, code: string): Promise<void> {
  const profile = ctx.profile;
  let referrerUsername: string | null = null;

  if (profile) {
    try {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });

      // Find the referral row by code — only update if referred_id is not yet set
      // and the referred user is not the referrer themselves
      const { data: referral } = await supabase
        .from("referrals")
        .select("id, referrer_id, referred_id")
        .eq("code", code)
        .maybeSingle();

      if (referral && referral.referrer_id !== profile.id) {
        if (!referral.referred_id) {
          await supabase
            .from("referrals")
            .update({ referred_id: profile.id })
            .eq("id", referral.id)
            .is("referred_id", null); // guard against race condition
        }

        // Fetch referrer's username for the welcome message
        const { data: referrerProfile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", referral.referrer_id)
          .maybeSingle();

        referrerUsername = referrerProfile?.username ?? null;
      }
    } catch (err) {
      console.error("[webhook] handleStartWithReferral error:", err);
    }
  }

  if (referrerUsername) {
    // Personalised referral welcome
    const miniappUrl = env.MINIAPP_URL ?? "https://project-mb7a5.vercel.app/miniapp";
    await ctx.reply(
      `👋 Привіт\\! Тебе запросив *@${referrerUsername.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&")}* 🎁\n\n` +
      `Я *Memo* — твій особистий AI\\-щоденник у Telegram 📓\n\n` +
      `*Як працює реферальна програма:*\n` +
      `• Оформи підписку *Nova на 1 місяць* — 250 ⭐\n` +
      `• Ти отримаєш *\\+30 днів Nova безкоштовно* зверху\n` +
      `• @${referrerUsername.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&")} теж отримає *\\+30 днів Nova*\n\n` +
      `Відкрий Memo, щоб почати 👇`,
      {
        parse_mode: "MarkdownV2",
        reply_markup: new InlineKeyboard().webApp("📱 Відкрити Memo", miniappUrl),
      }
    );
  } else {
    // No valid referral code or self-referral — show normal welcome
    await handleStart(ctx);
  }
}

/**
 * After a referred user activates a paid subscription, check if they were referred
 * and grant the referrer 30 days of Nova access (once per referred user).
 */
async function processReferralReward(referredUserId: string): Promise<void> {
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Find an unrewarded referral where this user is the referred party
    const { data: referral } = await supabase
      .from("referrals")
      .select("id, referrer_id")
      .eq("referred_id", referredUserId)
      .eq("reward_granted", false)
      .maybeSingle();

    if (!referral) return; // no pending referral

    // Grant referrer 30 days of Nova (stars_basic)
    const REFERRAL_REWARD_DAYS = 30;
    const REFERRAL_CHARGE_ID = `referral_reward_${referral.id}`;

    await createSubscription(
      referral.referrer_id,
      "stars_basic",
      REFERRAL_CHARGE_ID,
      REFERRAL_CHARGE_ID,
      REFERRAL_REWARD_DAYS
    );

    // Mark reward as granted
    await supabase
      .from("referrals")
      .update({ reward_granted: true })
      .eq("id", referral.id)
      .eq("reward_granted", false); // guard against race condition

    // Notify referrer via bot
    const { data: referrerProfile } = await supabase
      .from("profiles")
      .select("telegram_id")
      .eq("id", referral.referrer_id)
      .single();

    if (referrerProfile?.telegram_id) {
      try {
        const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
        await bot.api.sendMessage(
          Number(referrerProfile.telegram_id),
          `🎉 *Твій друг оформив підписку\\!*\n\nТи отримав *30 днів Memo Nova* безкоштовно як нагороду за запрошення\\. Дякуємо, що ділишся Memo\\! 🙏`,
          { parse_mode: "MarkdownV2" }
        );
      } catch (notifyErr) {
        console.error("[webhook] processReferralReward notify error:", notifyErr);
      }
    }

    console.log(`[webhook] Referral reward granted: referrer=${referral.referrer_id}, referred=${referredUserId}`);
  } catch (err) {
    console.error("[webhook] processReferralReward error:", err);
  }
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
        await ctx.reply("Щось пішло не так при налаштуванні профілю. Спробуй ще раз через хвилину 🙏");
        return;
      }
      throw err;
    }
    return next();
  });

  // ── Commands ────────────────────────────────────────────────────────────────
  bot.command("start", async (ctx) => {
    // Check for referral param: /start ref_<code>
    const param = ctx.match?.trim() ?? "";
    if (param.startsWith("ref_")) {
      const code = param.slice(4); // strip "ref_" prefix
      await handleStartWithReferral(ctx, code);
    } else {
      await handleStart(ctx);
    }
  });
  bot.command("help", handleHelp);
  bot.command("stats", handleStats);
  bot.command("report", handleReport);
  bot.command("report_daily", handleReportDaily);
  bot.command("report_weekly", handleReportWeekly);
  bot.command("report_monthly", handleReportMonthly);
  bot.command("recommendations", handleRecommendations);
  bot.command("remind", handleRemind);
  bot.command("invite", handleInvite);
  bot.command("cancel", handleCancel);

  // ── Callback queries (inline keyboard buttons) ──────────────────────────────
  bot.on("callback_query:data", handleCallbackQuery);

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
      let payload: { userId: string; tier: string; billingPeriod?: string; days?: number };
      try {
        payload = JSON.parse(payment.invoice_payload);
      } catch {
        console.error("[webhook] invalid payment payload");
        return;
      }

      const tier = payload.tier as "stars_basic" | "stars_pro";
      const days = payload.days ?? 30; // default 30 days if not specified
      const chargeId = payment.telegram_payment_charge_id;
      const providerChargeId = payment.provider_payment_charge_id;

      // Create subscription in DB
      const subscriptionId = await createSubscription(
        profile.id,
        tier,
        chargeId,
        providerChargeId,
        days
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

      // Check if this user was referred — grant referrer reward if applicable
      await processReferralReward(profile.id);

      // Confirm to user
      const tierNames: Record<string, string> = {
        stars_basic: "Memo Nova 🌟",
        stars_pro: "Memo Supernova 💫",
      };
      const periodLabels: Record<string, string> = {
        monthly: "1 місяць",
        quarterly: "3 місяці",
        annual: "1 рік",
      };
      const periodStr = payload.billingPeriod ? ` · ${periodLabels[payload.billingPeriod] ?? ""}` : "";
      await ctx.reply(
        `✅ Оплата пройшла! Підписка *${tierNames[tier] ?? tier}*${periodStr} активована.\n\nДякуємо за підтримку — це дуже важливо для нас 🙏\n\nВідкрий міні-додаток щоб побачити всі нові функції.`,
        {
          parse_mode: "Markdown",
          reply_markup: new InlineKeyboard().webApp("📱 Відкрити Memo", env.MINIAPP_URL ?? "https://project-mb7a5.vercel.app/miniapp"),
        }
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
  // ── 1. Webhook secret verification ─────────────────────────────────────────
  // Set TELEGRAM_WEBHOOK_SECRET in env and register it with Telegram:
  //   https://api.telegram.org/bot<TOKEN>/setWebhook?url=...&secret_token=<SECRET>
  // Telegram sends it as X-Telegram-Bot-Api-Secret-Token on every update.
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret) {
    const incoming = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
    if (!timingSafeEqual(incoming, webhookSecret)) {
      console.warn("[webhook] rejected: invalid secret token");
      return new Response("Forbidden", { status: 403 });
    }
  }

  // ── 2. Rate limiting — 60 updates/min per source IP ────────────────────────
  // Telegram sends from a fixed set of IPs, but we key on CF-Connecting-IP /
  // x-forwarded-for so a single compromised/spoofed source can't flood us.
  const ip =
    req.headers.get("CF-Connecting-IP") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";
  const rl = rateLimit(`webhook:${ip}`, 60, 60_000);
  if (!rl.allowed) {
    console.warn(`[webhook] rate limited IP: ${ip}`);
    return rateLimitResponse(rl.resetAt);
  }

  try {
    return await getHandler()(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[webhook] rejected request:", message);
    return new Response("Forbidden", { status: 403 });
  }
}
