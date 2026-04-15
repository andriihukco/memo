import { Context } from "grammy";
import { createClient } from "@supabase/supabase-js";
import { classifyAudio, ClassificationError, ClassificationResult } from "@/lib/classifier";
import { embedEntry } from "@/lib/embedding";
import { processUser } from "@/lib/processing/loop";
import { env } from "@/lib/env";
import type { Profile } from "@/lib/profile";
import { answerQuestion } from "@/lib/bot/qa";
import { generateConverseReply } from "@/lib/bot/converse";
import { sanitizeMarkdown } from "@/lib/utils";

interface BotContext extends Context {
  profile?: Profile;
}

function getServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function handleVoiceMessage(ctx: BotContext): Promise<void> {
  const voice = ctx.message?.voice;
  if (!voice) return;

  const profile = ctx.profile;
  if (!profile) {
    await ctx.reply("⚠️ Не вдалося знайти твій профіль. Спробуй ще раз.");
    return;
  }

  // Show typing indicator immediately
  await ctx.replyWithChatAction("typing");

  // 1. Download audio into an in-memory buffer (no storage write)
  let audioBuffer: Buffer;
  try {
    const file = await ctx.getFile();
    const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    audioBuffer = Buffer.from(arrayBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[voice handler] Audio download failed:", message);
    await ctx.reply("⚠️ Could not download your voice note. Please try again.");
    return;
  }

  // 2. Transcribe and classify (buffer used here, then discarded)
  let result: ClassificationResult;
  try {
    result = await classifyAudio(audioBuffer, "audio/ogg");
  } catch (err) {
    if (err instanceof ClassificationError) {
      console.error("[voice handler] ClassificationError:", err.message, err.cause);
      await ctx.reply("⚠️ Не вдалося класифікувати запис. Спробуй ще раз.");
      return;
    }
    throw err;
  } finally {
    // Discard the buffer immediately after transcription attempt
    audioBuffer = Buffer.alloc(0);
  }

  // 3. Route questions — do NOT persist
  if (result.intent === "question") {
    await ctx.replyWithChatAction("typing");
    const answer = await answerQuestion({
      userId: profile.id,
      question: result.content,
      currentUtcDate: new Date(),
    });
    await ctx.reply(sanitizeMarkdown(answer));
    return;
  }

  // 3b. Smalltalk — do NOT persist
  if (result.intent === "smalltalk") {
    await ctx.replyWithChatAction("typing");
    const reply = await generateConverseReply(result.content, undefined, profile.id);
    await ctx.reply(sanitizeMarkdown(reply));
    return;
  }

  // 4. Persist entry (save_entry or converse)
  const supabase = getServiceClient();
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
    })
    .select("id")
    .single();

  if (error) {
    console.error("[voice handler] DB insert error:", error.message);
    await ctx.reply("⚠️ Не вдалося зберегти запис. Спробуй ще раз.");
    return;
  }

  // 5. Confirm to user — always natural, never robotic
  await ctx.replyWithChatAction("typing");
  const botReplyText = await generateConverseReply(result.content, undefined, profile.id);
  await ctx.reply(sanitizeMarkdown(botReplyText));

  // 6. Async embedding (non-blocking) → triggers RAG insight pipeline after embedding is stored
  if (entry) {
    embedEntry(entry.id, result.content, {
      userId: profile.id,
      category: result.category,
      created_at: new Date().toISOString(),
      sendMessage: (text) => ctx.reply(sanitizeMarkdown(text)).then(() => {}),
    }).catch((err) =>
      console.error("[voice handler] embedEntry failed:", err)
    );

    // Async processing loop trigger (non-blocking)
    processUser(profile.id).catch((err) =>
      console.error("[voice handler] processUser failed:", err)
    );
  }
}
