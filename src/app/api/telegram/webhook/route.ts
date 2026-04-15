export const runtime = "edge";

import { Bot, Context, webhookCallback } from "grammy";
import { env } from "@/lib/env";
import { resolveOrCreateProfile, ProfileError, Profile } from "@/lib/profile";
import { handleTextMessage } from "@/lib/bot/handlers/text";
import { handleVoiceMessage } from "@/lib/bot/handlers/voice";
import { handleStart, handleHelp, handleReport, MAIN_KEYBOARD } from "@/lib/bot/commands";

interface BotContext extends Context {
  profile?: Profile;
}

let _handleUpdate: ((req: Request) => Promise<Response>) | null = null;

function getHandler(): (req: Request) => Promise<Response> {
  if (_handleUpdate) return _handleUpdate;

  const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN);

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

  bot.command("start", handleStart);
  bot.command("help", handleHelp);
  bot.command("report", handleReport);

  // Reply keyboard button taps
  bot.hears("📊 Дашборд", async (ctx) => {
    const url = `https://t.me/${ctx.me.username}/app`;
    await ctx.reply(`Відкрий дашборд: ${url}`, { reply_markup: MAIN_KEYBOARD });
  });
  bot.hears("📖 Допомога", handleHelp);
  bot.hears("📅 Звіт тижня", (ctx) => {
    (ctx.message as { text: string }).text = "/report weekly";
    return handleReport(ctx);
  });
  bot.hears("📅 Звіт дня", (ctx) => {
    (ctx.message as { text: string }).text = "/report daily";
    return handleReport(ctx);
  });

  bot.on("message:text", handleTextMessage);
  bot.on("message:voice", handleVoiceMessage);

  // Generous timeout — edge functions allow up to 25s on Vercel Pro
  // onTimeout "return" means Telegram gets 200 OK even if we hit the limit
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
