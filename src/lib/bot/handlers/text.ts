import { Context } from "grammy";
import { createClient } from "@supabase/supabase-js";
import { classify, ClassificationError, ClassificationResult, BUILTIN_CATEGORIES, colorForNewCategory } from "@/lib/classifier";
import { embedEntry } from "@/lib/embedding";
import { processUser } from "@/lib/processing/loop";
import { env } from "@/lib/env";
import type { Profile } from "@/lib/profile";
import { answerQuestion } from "@/lib/bot/qa";
import { generateConverseReply, loadUserTone } from "@/lib/bot/converse";
import { handleAction } from "@/lib/bot/handlers/action";
import { loadUserRules, saveUserRule, extractRuleFromMessage, formatRulesForPrompt } from "@/lib/bot/teach";
import { sanitizeMarkdown } from "@/lib/utils";

interface BotContext extends Context {
  profile?: Profile;
}

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ── Thread resolution ─────────────────────────────────────────────────────────
// We store the bot's reply message_id in entry metadata as { bot_msg_id: number }.
// When the user replies to that bot message, Telegram gives us reply_to_message.message_id
// which matches bot_msg_id, letting us find the parent entry and its thread.

async function resolveThread(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  replyToMessageId: number | undefined
): Promise<{ threadId: string | null; parentEntryId: string | null }> {
  if (!replyToMessageId) return { threadId: null, parentEntryId: null };

  const { data } = await supabase
    .from("entries")
    .select("id, thread_id")
    .eq("user_id", userId)
    .contains("metadata", { bot_msg_id: replyToMessageId })
    .maybeSingle();

  if (!data) return { threadId: null, parentEntryId: null };

  const threadId = data.thread_id ?? data.id;
  if (!data.thread_id) {
    await supabase.from("entries").update({ thread_id: threadId }).eq("id", data.id);
  }
  return { threadId, parentEntryId: data.id };
}

async function loadThreadContext(
  supabase: ReturnType<typeof getServiceClient>,
  threadId: string,
  userId: string
): Promise<string | undefined> {
  const { data } = await supabase
    .from("entries")
    .select("content, bot_reply")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(6);

  if (!data || data.length === 0) return undefined;
  return (data as { content: string; bot_reply: string | null }[])
    .map((e) => `User: ${e.content}${e.bot_reply ? `\nMemo: ${e.bot_reply}` : ""}`)
    .join("\n\n");
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function handleTextMessage(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const profile = ctx.profile;
  if (!profile) {
    await ctx.reply("⚠️ Не вдалося знайти твій профіль. Спробуй ще раз.");
    return;
  }

  await ctx.replyWithChatAction("typing");

  // Check if user has a pending delete confirmation first
  const { checkPendingDelete } = await import("@/lib/bot/handlers/action");
  if (await checkPendingDelete(ctx)) return;

  // Load user's custom rules for injection into classifier
  // Prefetch user tone in parallel — it'll be ready by the time we need to reply
  const [userRules, prefetchedTone] = await Promise.all([
    loadUserRules(profile.id),
    loadUserTone(profile.id),
  ]);
  const rulesPrompt = formatRulesForPrompt(userRules);

  // 1. Classify
  let result: ClassificationResult;
  try {
    result = await classify(text, rulesPrompt || undefined);
  } catch (err) {
    if (err instanceof ClassificationError) {
      console.error("[text handler] ClassificationError:", err.message, err.cause);
      await ctx.reply("⚠️ Не вдалося класифікувати запис. Спробуй ще раз.");
      return;
    }
    throw err;
  }

  // 2. Questions — no persist
  if (result.intent === "question") {
    // Send a human "thinking" message immediately so the user sees activity
    const thinkingPhrases = [
      "Хм, секунду... 🤔 Копаюсь у твоїх записах",
      "Зачекай, шукаю в пам'яті... 🧠",
      "Дай-но покопатись... 📖",
      "Секунду, переглядаю твій щоденник... 🔍",
    ];
    const thinking = thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)];
    const thinkingMsg = await ctx.reply(thinking);

    try {
      const answer = await answerQuestion({ userId: profile.id, question: text, currentUtcDate: new Date() });
      // Edit the thinking message with the real answer
      await ctx.api.editMessageText(ctx.chat!.id, thinkingMsg.message_id, sanitizeMarkdown(answer));
    } catch {
      // If edit fails (e.g. answer too long), send as new message
      const answer = await answerQuestion({ userId: profile.id, question: text, currentUtcDate: new Date() });
      await ctx.reply(sanitizeMarkdown(answer));
    }
    return;
  }

  // 3. Smalltalk — no persist
  if (result.intent === "smalltalk") {
    await ctx.replyWithChatAction("typing");
    const reply = await generateConverseReply(text, undefined, profile.id, prefetchedTone);
    await ctx.reply(sanitizeMarkdown(reply));
    return;
  }

  // 3b. Action — no persist, execute operation
  if (result.intent === "action") {
    await handleAction(ctx, result);
    return;
  }

  // 3c. Teach — save custom rule
  if (result.intent === "teach") {
    await ctx.replyWithChatAction("typing");
    const rule = await extractRuleFromMessage(text);
    if (!rule) {
      await ctx.reply("Не зрозумів яке правило запам'ятати. Спробуй сформулювати чіткіше, наприклад: _\"Запам'ятай: мій стакан = 300мл\"_", { parse_mode: "Markdown" });
      return;
    }
    const saved = await saveUserRule(profile.id, rule);
    await ctx.reply(
      `✅ Запам'ятав правило *#${saved.id}*:\n\n_${rule.instruction}_\n\nВоно буде застосовуватись до всіх твоїх майбутніх записів.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  // 4. Resolve thread + prefetch thread context in parallel
  const supabase = getServiceClient();
  const replyToMsgId = ctx.message?.reply_to_message?.message_id;
  const { threadId: resolvedThreadId, parentEntryId } = await resolveThread(supabase, profile.id, replyToMsgId);

  // 5. Persist entry — upsert category if new
  if (result.is_new_category) {
    await supabase.from("categories").upsert({
      user_id: profile.id,
      name: result.category,
      label_ua: result.category_label,
      color: colorForNewCategory(result.category),
      icon: "tag",
    }, { onConflict: "user_id,name", ignoreDuplicates: true });
  } else if (!(result.category in BUILTIN_CATEGORIES)) {
    // Ensure even built-in-ish categories are seeded
    await supabase.from("categories").upsert({
      user_id: profile.id,
      name: result.category,
      label_ua: result.category_label,
      color: BUILTIN_CATEGORIES[result.category]?.color ?? colorForNewCategory(result.category),
      icon: BUILTIN_CATEGORIES[result.category]?.icon ?? "tag",
    }, { onConflict: "user_id,name", ignoreDuplicates: true });
  }

  const { data: entry, error } = await supabase
    .from("entries")
    .insert({
      user_id: profile.id,
      content: result.content,
      category: result.category,
      metadata: {
        ...result.metadata,
        ...(result.dashboard_metrics.length > 0 ? { dashboard_metrics: result.dashboard_metrics } : {}),
        ...(result.goal_metrics.length > 0 ? { goal_metrics: result.goal_metrics } : {}),
      },
      raw_media_url: null,
      thread_id: resolvedThreadId,
      reply_to_entry_id: parentEntryId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[text handler] DB insert error:", error.message);
    await ctx.reply("⚠️ Не вдалося зберегти запис. Спробуй ще раз.");
    return;
  }

  // 6. Generate + send reply, capture bot message_id
  // ALL entries get a natural reply — no robotic "✅ Збережено як..."
  let botMsgId: number | null = null;
  await ctx.replyWithChatAction("typing");
  // loadThreadContext and generateConverseReply (which internally fetches tone) run sequentially
  // but tone fetch already happened — just load thread ctx then generate
  const threadCtx = resolvedThreadId
    ? await loadThreadContext(supabase, resolvedThreadId, profile.id)
    : undefined;
  const finalReplyText = await generateConverseReply(text, threadCtx, profile.id, prefetchedTone);
  const sent = await ctx.reply(sanitizeMarkdown(finalReplyText));
  botMsgId = sent.message_id;

  // 7. Update entry with bot reply + thread metadata
  if (entry) {
    const currentMeta = (result.metadata as Record<string, unknown>) ?? {};
    const newThreadId = resolvedThreadId ?? entry.id;

    await supabase.from("entries").update({
      bot_reply: finalReplyText,
      thread_id: newThreadId,
      metadata: { ...currentMeta, ...(botMsgId ? { bot_msg_id: botMsgId } : {}) },
    }).eq("id", entry.id);

    // Backfill thread_id on parent if this is the first reply in a new thread
    if (!resolvedThreadId && parentEntryId) {
      await supabase.from("entries").update({ thread_id: newThreadId }).eq("id", parentEntryId);
    }

    embedEntry(entry.id, result.content, {
      userId: profile.id,
      category: result.category,
      created_at: new Date().toISOString(),
      sendMessage: (t) => ctx.reply(sanitizeMarkdown(t)).then(() => {}),
    }).catch((err) => console.error("[text handler] embedEntry failed:", err));

    processUser(profile.id).catch((err) => console.error("[text handler] processUser failed:", err));
  }
}
