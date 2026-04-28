import { Context } from "grammy";
import { createClient } from "@supabase/supabase-js";
import {
  classify, ClassificationError, ClassificationResult,
  EntryPayload, BUILTIN_CATEGORIES, colorForNewCategory,
} from "@/lib/classifier";
import { embedEntry } from "@/lib/embedding";
import { env } from "@/lib/env";
import type { Profile } from "@/lib/profile";
import { answerQuestion } from "@/lib/bot/qa";
import { generateConverseReply, loadUserContext } from "@/lib/bot/converse";
import { generateSmartReply } from "@/lib/bot/smart-reply";
import { handleAction } from "@/lib/bot/handlers/action";
import { sanitizeMarkdown } from "@/lib/utils";
import { extractFacts, saveMemory } from "@/lib/bot/memory";
import { deriveUserKey, encryptField } from "@/lib/crypto";
import type { Locale } from "@/i18n/locales";

interface BotContext extends Context {
  profile?: Profile;
  locale: Locale;
}

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ── Typing indicator ──────────────────────────────────────────────────────────

async function withTypingIndicator<T>(ctx: BotContext, fn: () => Promise<T>): Promise<T> {
  // Use a self-cancelling interval to prevent loop leak on throw (bug 1.7)
  const interval = setInterval(() => {
    ctx.replyWithChatAction("typing").catch(() => {});
  }, 4000);
  ctx.replyWithChatAction("typing").catch(() => {});
  try {
    return await fn();
  } finally {
    clearInterval(interval);
  }
}

// ── Category upsert ───────────────────────────────────────────────────────────

async function upsertCategory(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  entry: EntryPayload
): Promise<void> {
  if (entry.is_new_category) {
    await supabase.from("categories").upsert({
      user_id: userId,
      name: entry.category,
      label_ua: entry.category_label,
      color: colorForNewCategory(entry.category),
      icon: "tag",
    }, { onConflict: "user_id,name", ignoreDuplicates: true });
  } else if (!(entry.category in BUILTIN_CATEGORIES)) {
    await supabase.from("categories").upsert({
      user_id: userId,
      name: entry.category,
      label_ua: entry.category_label,
      color: BUILTIN_CATEGORIES[entry.category]?.color ?? colorForNewCategory(entry.category),
      icon: BUILTIN_CATEGORIES[entry.category]?.icon ?? "tag",
    }, { onConflict: "user_id,name", ignoreDuplicates: true });
  }
}

// ── Thread resolution ─────────────────────────────────────────────────────────

async function resolveThread(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  replyToMessageId: number | undefined
): Promise<{ threadId: string | null; parentEntryId: string | null }> {
  if (!replyToMessageId) return { threadId: null, parentEntryId: null };

  // All bot_msg_id values are stored as JSON strings after migration 20240001000022
  const { data } = await supabase
    .from("entries")
    .select("id, thread_id, reply_to_entry_id")
    .eq("user_id", userId)
    .eq("metadata->>bot_msg_id", String(replyToMessageId))
    .maybeSingle();

  if (!data) return { threadId: null, parentEntryId: null };

  // Walk up the chain to find the true thread root (bug 1.30)
  let threadId = data.thread_id;
  if (!threadId) {
    // If this entry has a reply_to_entry_id, walk up to find root
    if (data.reply_to_entry_id) {
      const { data: parent } = await supabase
        .from("entries")
        .select("id, thread_id")
        .eq("id", data.reply_to_entry_id)
        .maybeSingle();
      threadId = parent?.thread_id ?? data.id;
    } else {
      threadId = data.id;
    }
    await supabase.from("entries").update({ thread_id: threadId }).eq("id", data.id);
  }
  return { threadId, parentEntryId: data.id };
}

// ── Thread context loader ─────────────────────────────────────────────────────
// Loads recent thread messages (max 48h old) as a conversation string.

async function loadThreadContext(
  supabase: ReturnType<typeof getServiceClient>,
  threadId: string,
  userId: string,
  excludeEntryId?: string,
  maxAgeHours = 48
): Promise<string | undefined> {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("entries")
    .select("id, content, bot_reply, created_at")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(8);

  // Exclude the current entry so it doesn't appear twice in context (bug 1.31)
  if (excludeEntryId) {
    query = query.neq("id", excludeEntryId);
  }

  const { data } = await query;

  if (!data || data.length === 0) return undefined;

  return (data as { content: string; bot_reply: string | null }[])
    .map((e) => `User: ${e.content}${e.bot_reply ? `\nMemo: ${e.bot_reply}` : ""}`)
    .join("\n\n");
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function handleTextMessage(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const profile = ctx.profile;
  if (!profile) {
    await ctx.reply("Щось пішло не так з профілем. Спробуй ще раз або напиши /start 🙏");
    return;
  }

  // Guard: if the message looks like a mistyped command (no slash), redirect the user.
  // This prevents the AI from treating "invite", "stats", "cancel" etc. as diary entries
  // and generating follow-up questions that get the bot stuck in a thread loop.
  const COMMAND_WORDS = ['invite', 'start', 'cancel', 'stats', 'help', 'report', 'remind', 'recommendations'];
  const trimmedLower = text.trim().toLowerCase();
  if (COMMAND_WORDS.includes(trimmedLower)) {
    await ctx.reply(
      `Схоже, ти мав на увазі команду /${trimmedLower}?\n\nНапиши зі слешем: /${trimmedLower}`,
    );
    return;
  }

  await ctx.replyWithChatAction("typing");

  // Check pending delete confirmation first (fast path, no AI)
  const { checkPendingDelete } = await import("@/lib/bot/handlers/action");
  if (await checkPendingDelete(ctx)) return;

  // Load user context (memory + tone) and classify in parallel
  // Pass thread context to classifier so short replies like "2 ложки" are understood in context
  const replyToMsgId = ctx.message?.reply_to_message?.message_id;
  const supabase = getServiceClient();

  // Resolve thread first so we can pass context to classifier (same as voice handler)
  const [userCtx, threadResolution] = await Promise.all([
    loadUserContext(profile.id),
    resolveThread(supabase, profile.id, replyToMsgId),
  ]);

  // Load thread context for classifier (short replies like "2 ложки" need context)
  let classifierThreadCtx: string | undefined;
  if (threadResolution.threadId) {
    classifierThreadCtx = await loadThreadContext(supabase, threadResolution.threadId, profile.id);
  }

  const classifyResult = await classify(text, classifierThreadCtx).catch((err) => {
    if (err instanceof ClassificationError) return err;
    throw err;
  });

  if (classifyResult instanceof ClassificationError) {
    console.error("[text handler] ClassificationError:", classifyResult.message, classifyResult.cause);
    await ctx.reply("Не вдалося обробити повідомлення. Спробуй ще раз 🙏");
    return;
  }

  const result = classifyResult as ClassificationResult;

  // ── Questions ──────────────────────────────────────────────────────────────
  if (result.intent === "question") {
    const thinkingPhrases = [
      "Хм, секунду... 🤔 Копаюсь у твоїх записах",
      "Зачекай, шукаю в пам'яті... 🧠",
      "Дай-но покопатись... 📖",
      "Секунду, переглядаю твій щоденник... 🔍",
    ];
    const thinkingMsg = await ctx.reply(
      thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)]
    );

    const answer = await withTypingIndicator(ctx, () =>
      answerQuestion({ userId: profile.id, question: text, currentUtcDate: new Date() })
    );
    try {
      await ctx.api.editMessageText(ctx.chat!.id, thinkingMsg.message_id, sanitizeMarkdown(answer));
    } catch {
      await ctx.reply(sanitizeMarkdown(answer));
    }
    return;
  }

  // ── Smalltalk ──────────────────────────────────────────────────────────────
  if (result.intent === "smalltalk") {
    const reply = await withTypingIndicator(ctx, () =>
      generateConverseReply(text, undefined, undefined, undefined, userCtx, ctx.locale)
    );
    await ctx.reply(sanitizeMarkdown(reply));
    return;
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  if (result.intent === "action") {
    await handleAction(ctx, result);
    return;
  }

  // ── Save entries (save_entry | converse) ───────────────────────────────────
  const { threadId: resolvedThreadId, parentEntryId } = threadResolution;

  const entriesToSave: EntryPayload[] = result.entries.length > 0
    ? result.entries
    : [{
        category: result.category,
        category_label: result.category_label,
        is_new_category: result.is_new_category,
        content: result.content,
        metadata: result.metadata,
        dashboard_metrics: result.dashboard_metrics,
        goal_metrics: result.goal_metrics,
      }];

  const savedIds: string[] = [];

  // Derive encryption key once for all entries in this batch
  let cryptoKey: CryptoKey | null = null;
  try {
    const { data: profileForSalt } = await supabase
      .from("profiles")
      .select("encryption_salt")
      .eq("id", profile.id)
      .single();
    cryptoKey = await deriveUserKey(
      profile.telegram_id.toString(),
      profileForSalt?.encryption_salt ?? null
    );
  } catch (cryptoErr) {
    console.error("[text handler] key derivation failed:", cryptoErr);
  }

  for (const entryPayload of entriesToSave) {
    await upsertCategory(supabase, profile.id, entryPayload);

    const contentToStore = cryptoKey
      ? await encryptField(entryPayload.content, cryptoKey)
      : entryPayload.content;

    const { data: entry, error } = await supabase
      .from("entries")
      .insert({
        user_id: profile.id,
        content: contentToStore,
        category: entryPayload.category,
        metadata: {
          ...entryPayload.metadata,
          ...(entryPayload.dashboard_metrics.length > 0 ? { dashboard_metrics: entryPayload.dashboard_metrics } : {}),
          ...(entryPayload.goal_metrics.length > 0 ? { goal_metrics: entryPayload.goal_metrics } : {}),
        },
        raw_media_url: null,
        thread_id: resolvedThreadId,
        reply_to_entry_id: parentEntryId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[text handler] DB insert error:", error.message);
      // Best-effort rollback of already-inserted entries (bug 1.8)
      if (savedIds.length > 0) {
        const { error: rollbackError } = await supabase.from("entries").delete().in("id", savedIds);
        if (rollbackError) {
          console.error("[text handler] rollback failed:", rollbackError);
        }
      }
      await ctx.reply("Не вдалося зберегти запис. Спробуй ще раз 🙏");
      return;
    }

    if (entry) savedIds.push(entry.id);
  }

  // ── Generate reply ─────────────────────────────────────────────────────────
  const threadCtx = resolvedThreadId
    ? await loadThreadContext(supabase, resolvedThreadId, profile.id, savedIds[0])
    : undefined;

  const smartReply = await withTypingIndicator(ctx, () =>
    generateSmartReply({
      entries: entriesToSave,
      userMessage: text,
      userCtx,
      threadCtx,
      intent: result.intent as "save_entry" | "converse",
    })
  );
  const finalReplyText = smartReply.text;

  const sent = await ctx.reply(sanitizeMarkdown(finalReplyText));
  // Only store bot_msg_id when message_id is a valid number (bug 1.5)
  const botMsgId: number | null = (sent?.message_id && typeof sent.message_id === "number") ? sent.message_id : null;
  if (!botMsgId) {
    console.warn("[text handler] sent.message_id missing — thread linking skipped for this reply");
  }

  // ── Persist bot reply + thread metadata ───────────────────────────────────
  const primaryId = savedIds[0];
  if (primaryId) {
    const newThreadId = resolvedThreadId ?? primaryId;

    const botReplyToStore = cryptoKey
      ? await encryptField(finalReplyText, cryptoKey)
      : finalReplyText;

    await supabase.from("entries").update({
      bot_reply: botReplyToStore,
      thread_id: newThreadId,
      metadata: {
        ...entriesToSave[0].metadata,
        ...(entriesToSave[0].dashboard_metrics.length > 0 ? { dashboard_metrics: entriesToSave[0].dashboard_metrics } : {}),
        ...(entriesToSave[0].goal_metrics.length > 0 ? { goal_metrics: entriesToSave[0].goal_metrics } : {}),
        ...(botMsgId ? { bot_msg_id: String(botMsgId) } : {}),
      },
    }).eq("id", primaryId);

    if (savedIds.length > 1) {
      await supabase.from("entries").update({ thread_id: newThreadId }).in("id", savedIds.slice(1));
    }

    if (!resolvedThreadId && parentEntryId) {
      await supabase.from("entries").update({ thread_id: newThreadId }).eq("id", parentEntryId);
    }

    // ── Async post-processing (non-blocking) ──────────────────────────────
    // 1. Embed all saved entries
    for (const [i, savedId] of savedIds.entries()) {
      const payload = entriesToSave[i];
      embedEntry(savedId, payload.content, {
        userId: profile.id,
        category: payload.category,
        created_at: new Date().toISOString(),
        // No sendMessage — insight/conversational messages removed from UX
        // They were noisy and confusing. Insights are visible in the miniapp.
      }).catch((err) => console.error("[text handler] embedEntry failed:", err));
    }

    // 2. Extract and save any new memory facts (fire-and-forget)
    extractFacts(text).then(async (facts) => {
      if (Object.keys(facts).length > 0) {
        await saveMemory(profile.id, facts);
        console.log(`[memory] saved facts for ${profile.id}:`, facts);
      }
    }).catch((err) => console.error("[memory] extractFacts failed:", err));
  }
}
