import { Context } from "grammy";
import type { Profile } from "@/lib/profile";
import { loadUserRules, deleteUserRule } from "@/lib/bot/teach";
import { generateRetrospective, saveReport, formatReportForTelegram, getReportSchedule } from "@/lib/bot/retrospective";
import { sanitizeMarkdown } from "@/lib/utils";

interface BotContext extends Context {
  profile?: Profile;
}

const WELCOME = `👋 Привіт! Я *Memo* — твій особистий AI-щоденник.

Просто пиши або надсилай голосові повідомлення — я сам розберусь що зберегти і як.

*Що я вмію:*
🍗 Записую їжу і рахую калорії, білки, жири, вуглеводи автоматично
💪 Трекаю тренування і спалені калорії
💸 Веду облік витрат
😌 Слухаю твої думки і почуття
📊 Будую дашборд з твоїх даних
🔍 Відповідаю на питання про твої записи

*Приклади:*
• _"З'їв 200г курки і 50г рису"_ → автоматично рахую макроси
• _"Пробіг 5км, спалив ~400 ккал"_ → трекаю активність
• _"Не курю вже 5 днів"_ → стежу за стріком
• _"Скільки я витратив цього тижня?"_ → аналізую записи
• _"Видали всі записи про сон"_ → виконую дії

Напиши /help щоб побачити всі команди.`;

const HELP = `📖 *Довідка Memo*

*Записи (просто пиши):*
• Їжа: _"З'їв 150г лосося і салат"_
• Тренування: _"Зробив 40 присідань, 30 хв залу"_
• Витрати: _"Витратив 350 грн на продукти"_
• Вода: _"Випив 2 склянки води"_
• Сон: _"Спав 7 годин"_
• Вага: _"Вага 78кг"_
• Стріки: _"Не курю вже 10 днів"_
• Думки/почуття: просто пиши що думаєш

*Питання (я шукаю в твоїх записах):*
• _"Скільки калорій я з'їв сьогодні?"_
• _"Що я їв вчора?"_
• _"Скільки витратив цього місяця?"_
• _"Розкажи про мої тренування цього тижня"_
• _"Який у мене настрій останнім часом?"_

*Дії:*
• _"Видали записи про сон за сьогодні"_
• _"Хочу бачити медитацію на дашборді"_

*Звіти та ретроспективи:*
/report — тижневий звіт прямо зараз
/report daily — звіт за сьогодні
/report monthly — звіт за місяць
/schedule — налаштувати автоматичні звіти

*Команди:*
/start — привітання
/help — ця довідка
/rules — збережені правила
/delrule <id> — видалити правило
/report [daily|weekly|monthly] — ретроспектива
/schedule — налаштувати автозвіти*
Скажи мені правило і я запам'ятаю його назавжди:
• _"Запам'ятай: мій стакан = 300мл"_
• _"Коли я кажу 'зробив зарядку' — це 20 хв і 150 ккал"_
• _"Я веган, не рахуй м'ясо"_
• _"Виправ: моя кава = 50мл еспресо"_

*Голосові повідомлення:* просто надішли — я транскрибую і збережу 🎙️`;

export async function handleStart(ctx: BotContext): Promise<void> {
  await ctx.reply(WELCOME, { parse_mode: "Markdown" });
}

export async function handleHelp(ctx: BotContext): Promise<void> {
  await ctx.reply(HELP, { parse_mode: "Markdown" });
}

export async function handleRules(ctx: BotContext): Promise<void> {
  const profile = ctx.profile;
  if (!profile) return;

  const rules = await loadUserRules(profile.id);

  if (rules.length === 0) {
    await ctx.reply(
      "У тебе немає збережених правил.\n\nЩоб навчити мене, напиши наприклад:\n_\"Запам'ятай: мій стакан = 300мл\"_\n_\"Коли я кажу 'зробив зарядку' — це 20 хв і 150 ккал\"_",
      { parse_mode: "Markdown" }
    );
    return;
  }

  const list = rules.map((r, i) =>
    `*${i + 1}.* [#${r.id}] ${r.instruction}`
  ).join("\n\n");

  await ctx.reply(
    `📋 *Твої правила (${rules.length}):*\n\n${list}\n\nЩоб видалити правило: /delrule <id>`,
    { parse_mode: "Markdown" }
  );
}

export async function handleDelRule(ctx: BotContext): Promise<void> {
  const profile = ctx.profile;
  if (!profile) return;

  const text = ctx.message?.text ?? "";
  const ruleId = text.split(" ")[1]?.trim();

  if (!ruleId) {
    await ctx.reply("Вкажи ID правила: /delrule <id>\nПодивись ID через /rules");
    return;
  }

  await deleteUserRule(profile.id, ruleId);
  await ctx.reply(`✅ Правило #${ruleId} видалено.`);
}

export async function handleReport(ctx: BotContext): Promise<void> {
  const profile = ctx.profile;
  if (!profile) return;

  const text = ctx.message?.text ?? "";
  const arg = text.split(" ")[1]?.trim().toLowerCase();
  const periodType = (["daily","weekly","monthly"].includes(arg ?? "") ? arg : "weekly") as "daily" | "weekly" | "monthly";

  const thinkingMsg = await ctx.reply("🔍 Аналізую твої записи... Це займе кілька секунд.");

  const now = new Date();
  let from: Date, to: Date;
  if (periodType === "daily") {
    from = new Date(now); from.setHours(0,0,0,0);
    to = new Date(now); to.setHours(23,59,59,999);
  } else if (periodType === "monthly") {
    from = new Date(now); from.setDate(1); from.setHours(0,0,0,0);
    to = now;
  } else {
    from = new Date(now); from.setDate(now.getDate() - 7); from.setHours(0,0,0,0);
    to = now;
  }

  const report = await generateRetrospective(profile.id, periodType, from, to);

  if (!report) {
    await ctx.api.editMessageText(ctx.chat!.id, thinkingMsg.message_id,
      "Недостатньо записів за цей період. Продовжуй вести щоденник! 📝");
    return;
  }

  await saveReport(profile.id, report);
  const formatted = sanitizeMarkdown(formatReportForTelegram(report));

  // Telegram has 4096 char limit — split if needed
  if (formatted.length <= 4000) {
    await ctx.api.editMessageText(ctx.chat!.id, thinkingMsg.message_id, formatted, { parse_mode: "Markdown" });
  } else {
    await ctx.api.deleteMessage(ctx.chat!.id, thinkingMsg.message_id).catch(() => {});
    // Split into chunks
    const chunks = formatted.match(/[\s\S]{1,3900}/g) ?? [formatted];
    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: "Markdown" });
    }
  }
}

export async function handleSchedule(ctx: BotContext): Promise<void> {
  const profile = ctx.profile;
  if (!profile) return;

  const schedule = await getReportSchedule(profile.id);

  await ctx.reply(
    `⏰ *Налаштування автозвітів*\n\n` +
    `Щоденний: ${schedule.daily ? "✅" : "❌"}\n` +
    `Тижневий: ${schedule.weekly ? "✅" : "❌"}\n` +
    `Місячний: ${schedule.monthly ? "✅" : "❌"}\n` +
    `Час: ${schedule.time}\n\n` +
    `Щоб змінити, напиши наприклад:\n` +
    `_"Вмикай тижневий звіт щонеділі о 10:00"_\n` +
    `_"Вимкни щоденний звіт"_\n` +
    `_"Хочу місячний звіт 1-го числа о 9:00"_`,
    { parse_mode: "Markdown" }
  );
}
