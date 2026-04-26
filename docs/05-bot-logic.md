# Bot Logic — Memo

Entry point: `src/app/api/telegram/webhook/route.ts` (Edge runtime, grammY)

---

## Middleware Stack

```
Request → grammY Bot
    │
    ├── Profile Middleware
    │   resolveOrCreateProfile(telegramId)
    │   → attaches ctx.profile to context
    │
    ├── Command Router
    │   /start, /help, /report, /stats, /recommendations
    │
    └── Message Handler
        ├── Text messages → handleTextMessage()
        └── Voice messages → handleVoiceMessage()
```

---

## Commands

### `/start`
Welcome message with feature overview. Creates profile if first visit.

### `/help`
Full command reference with examples.

### `/stats`
Today's summary: aggregated metrics from today's entries (kcal, steps, expenses, etc.).

### `/report [daily|weekly|monthly]`
Generates retrospective report with rotating status messages:
1. Sends "Аналізую твої записи..." 
2. Generates report (Gemini, ~5-15s)
3. Edits message with full report
4. Saves to `reports` table

### `/recommendations`
AI-generated insights based on patterns in recent entries.

---

## Text Message Flow

```
handleTextMessage(ctx, profile)
    │
    ├── 1. Check pending delete confirmation
    │   if profile.settings.pending_delete exists and not expired:
    │       if message matches confirmation → execute delete
    │       else → cancel pending delete
    │
    ├── 2. Prefetch user tone
    │   loadUserContext(userId) → last 10 entries
    │
    ├── 3. Resolve thread context
    │   if ctx.message.reply_to_message:
    │       find entry by bot_msg_id
    │       walk up chain to find thread root
    │       load up to 6 messages (48h window)
    │
    ├── 4. Classify with Gemini
    │   classify(text, existingCategories, threadContext)
    │
    ├── 5. Route by intent
    │   │
    │   ├── "question"
    │   │   show "thinking..." message
    │   │   answerQuestion(userId, text) → RAG
    │   │   edit message with answer
    │   │
    │   ├── "smalltalk"
    │   │   generateConverseReply(text, userContext)
    │   │   reply to user
    │   │
    │   ├── "action"
    │   │   handleAction(ctx, profile, classification)
    │   │   → delete_entries: two-step confirmation
    │   │   → create_widget: save to profile.settings
    │   │
    │   └── "save_entry" / "converse"
    │       for each entry in classification.entries:
    │           upsertCategory(supabase, userId, entry)
    │           resolveThread(supabase, userId, replyToMsgId)
    │           encrypt(content) → INSERT INTO entries
    │           store bot_msg_id in metadata
    │       generateConverseReply() → reply to user
    │       embedEntry() [async, non-blocking]
    │       extractFacts() [async, non-blocking]
    │
    └── withTypingIndicator() wraps all async operations
```

---

## Voice Message Flow

```
handleVoiceMessage(ctx, profile)
    │
    ├── Download audio buffer from Telegram CDN
    │   (in-memory, never written to disk)
    │
    ├── classifyAudio(audioBuffer, mimeType)
    │   Gemini multimodal: transcription + classification in one call
    │
    └── Same routing as text from step 5 above
```

---

## Thread System

The thread system enables multi-turn conversations where context is preserved.

### How threads are created:
1. User sends message → bot replies
2. Bot reply's `message_id` is stored in `entry.metadata.bot_msg_id`
3. User replies to the bot message
4. Telegram provides `reply_to_message.message_id` in the update
5. Handler queries `entries WHERE metadata->>'bot_msg_id' = $msgId`
6. Found entry's `thread_id` (or its own `id` if root) becomes the thread root
7. New entry gets `thread_id = rootId` and `reply_to_entry_id = parentId`

### Thread context for classification:
Short replies like "2 ложки" are ambiguous without context. The classifier receives the last 6 thread messages so it can understand "2 tablespoons of what?" from context.

### Thread context for replies:
The conversational reply generator receives thread history so responses feel like a natural continuation of the conversation.

---

## Action Handler (`src/lib/bot/handlers/action.ts`)

### `delete_entries`
Two-step safety flow:
1. First message: "Видалити 3 записи про калорії за сьогодні? Відповідай 'так' для підтвердження."
2. Stores pending delete in `profile.settings.pending_delete` with 5-minute expiry
3. Next message "так" → execute delete
4. Any other message → cancel

### `create_widget`
Creates a custom dashboard widget from natural language:
- "додай віджет для відстеження води" → creates water_ml widget
- Saves to `profile.settings.custom_widgets`

### `merge_widgets`
Merges duplicate widgets (e.g., two calorie widgets).

### `update_schedule`
Updates report schedule in `profile.settings.report_schedule`.

---

## Typing Indicator

All async operations are wrapped in `withTypingIndicator()`:
```typescript
async function withTypingIndicator<T>(ctx, fn): Promise<T> {
  const interval = setInterval(() => ctx.replyWithChatAction("typing"), 4000);
  ctx.replyWithChatAction("typing");
  try {
    return await fn();
  } finally {
    clearInterval(interval);
  }
}
```
This sends "typing..." every 4 seconds while processing, giving users visual feedback.

---

## Profile Resolution

```typescript
resolveOrCreateProfile(telegramId, username)
    │
    ├── SELECT FROM profiles WHERE telegram_id = $id
    │
    ├── if not found:
    │   supabase.auth.admin.createUser({
    │     email: `telegram_${id}@memo.app`,
    │     password: hmac(telegramId, secret)
    │   })
    │   INSERT INTO profiles (id = auth.uid(), telegram_id, username)
    │
    └── return profile
```

The profile `id` is set to the Supabase Auth UUID so `auth.uid()` in RLS policies matches `entries.user_id`.

---

## Error Handling

- Classification failures: retry with simplified prompt, fallback to `save_entry` with raw content
- Embedding failures: set `embedding_status = 'failed'`, log error, continue (non-blocking)
- Insight generation failures: silently skip (non-critical)
- Reply failures: log error, attempt fallback message
- All handlers wrapped in try/catch to prevent webhook failures
