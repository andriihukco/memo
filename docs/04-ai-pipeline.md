# AI Pipeline — Memo

All AI operations use **Google Gemini** via `@google/generative-ai`.

---

## Models Used

| Model | Purpose | Where |
|-------|---------|-------|
| `gemini-2.5-flash` | Classification, generation, QA, reports | `classifier.ts`, `converse.ts`, `qa.ts`, `retrospective.ts` |
| `gemini-2.5-flash-lite` | Fast classification pass | `classifier.ts` (first pass) |
| `gemini-embedding-001` | 768-dim text embeddings | `embedding.ts` |

---

## 1. Classification (`src/lib/classifier.ts`)

Every incoming message goes through `classify()` (text) or `classifyAudio()` (voice).

### Input
- Raw message text (or audio buffer for voice)
- User's existing categories (for context)
- Thread context (up to 6 prior messages)

### Output (Zod-validated JSON)
```typescript
{
  intent: "save_entry" | "question" | "converse" | "smalltalk" | "action",
  entries: EntryPayload[],          // array for multi-entry messages
  action_type: "delete_entries" | "create_widget" | "merge_widgets" | "update_schedule" | "update_entry" | "none",
  action_params: Record<string, unknown>,
  // backward-compat single-entry fields:
  category: string,                 // snake_case
  category_label: string,           // human-readable
  is_new_category: boolean,
  content: string,                  // cleaned text
  metadata: object,
  dashboard_metrics: DashboardMetric[],
  goal_metrics: GoalMetric[]
}
```

### Decomposition Intelligence
The classifier applies built-in formulas to derive multiple metrics from a single input:

| Input | Derived Metrics |
|-------|----------------|
| "ran 5km" | distance_km=5, kcal_burned=400, active_min=30, steps_count=6000 |
| "ate 200g chicken" | kcal_intake=330, protein_g=62, carbs_g=0, fat_g=7.2 |
| "slept 8 hours" | sleep_hours=8 |
| "spent 150 UAH on groceries" | expense_amount=150, expense_currency=UAH |
| "mood 7/10" | mood_score=7 |

**Built-in nutritional values (per 100g):**
- Chicken breast: 165kcal / 31g protein / 0g carbs / 3.6g fat
- Rice (cooked): 130kcal / 2.7g protein / 28g carbs / 0.3g fat
- Buckwheat (cooked): 92kcal / 3.4g protein / 20g carbs / 0.6g fat
- Egg: 155kcal / 13g protein / 1g carbs / 11g fat
- Salmon: 208kcal / 20g protein / 0g carbs / 13g fat
- Oats: 389kcal / 17g protein / 66g carbs / 7g fat

### Voice Classification (`classifyAudio`)
Gemini multimodal: audio buffer → transcription + classification in a single API call. Audio is never written to disk.

---

## 2. Embedding Pipeline (`src/lib/embedding.ts`)

Runs **asynchronously** after the bot reply is sent (non-blocking).

```
embedEntry(userId, entryId, content)
    │
    ▼
gemini-embedding-001.embedContent(content)
    → 768-dimensional float vector
    │
    ▼
UPDATE entries SET embedding = $vector, embedding_status = 'done'
    │
    ▼
find_similar_entries(userId, vector, entryId, topK=5)
    → entries with cosine similarity > 0.75
    │
    ├── if similar entries found:
    │       generateInsight(entry, similarEntries) → Gemini
    │       INSERT INTO insights
    │       ctx.reply(insightText)
    │
    └── generateConversationalReply(entry, similarEntries)
            → pattern-aware reply referencing specific past data
            ctx.reply(reply)
```

---

## 3. Question Answering / RAG (`src/lib/bot/qa.ts`)

Triggered when `intent === "question"`.

```
User: "how much protein did I eat this week?"
    │
    ▼
embedQuestion(text) → 768-dim vector
    │
    ▼
resolveTemporalFilter(text)
    → { from: Date, to: Date } or null
    (handles: "today", "yesterday", "this week", "last week", "this month")
    │
    ▼
resolveCategoryFilter(text)
    → category string or null
    (handles: "calories", "workout", "sleep", etc.)
    │
    ▼
find_similar_entries(userId, vector, null, topK=10)
    │
    ▼
intersect with temporal + category filters
    → if empty, fallback to structured-only query
    │
    ▼
Gemini 2.5 Flash synthesis:
    "Based on your entries from [date range]:
     Total protein: 187g across 4 meals.
     Highest day: Tuesday (62g from chicken + eggs)."
```

---

## 4. Conversational Reply (`src/lib/bot/converse.ts`)

For all saved entries, a natural reply is generated.

**Context loaded:**
- Last 10 entries (tone learning — writing style, vocabulary, emoji usage)
- Thread context (up to 6 prior messages, 48h window)

**System prompt principles:**
- Never start with "Записано!" or robotic confirmations
- Match the user's energy and tone
- Ask one follow-up question when appropriate
- Reference specific numbers from the entry
- Use the user's language (Ukrainian/Russian/English detected automatically)

---

## 5. Retrospective Reports (`src/lib/bot/retrospective.ts`)

Generates agile-style retrospectives with 5 structured sections.

**Input:** All entries in the requested period with their `dashboard_metrics`.

**Output structure:**
```typescript
{
  content: string,              // full Telegram Markdown report
  summary: string,              // 1-2 sentence TLDR
  went_well: string,            // ✅ What went well
  didnt_go_well: string,        // 🔴 What didn't work
  start_stop_continue: string,  // 🔄 Start / Stop / Continue
  experiment: string,           // 🧪 One experiment for next period
  lesson: string,               // 💡 Main lesson learned
  insights: ReportInsight[]     // structured insight objects
}
```

**Rotating status messages during generation:**
- "Аналізую твої записи..."
- "Шукаю патерни..."
- "Формую ретроспективу..."
- "Майже готово..."

---

## 6. Memory & Facts (`src/lib/bot/memory.ts`)

After saving an entry, `extractFacts()` runs asynchronously:
- Extracts persistent facts about the user (name, preferences, goals, health conditions)
- Stores in a dedicated memory table for long-term context
- Used to personalize future replies

---

## 7. Recommendations (`src/lib/bot/recommendations.ts`)

Triggered by `/recommendations` command:
- Analyzes patterns across recent entries
- Identifies: insufficient sleep, excess alcohol, low protein, sedentary days
- Generates actionable, personalized suggestions
- Tone: supportive coach, not judgmental

---

## 8. Daily Processing Cron (`src/lib/processing/`)

### `clusterEntries(userId)` — `loop.ts`
```
For each entry with embedding:
    find_similar_entries(userId, embedding, entryId, topK=20)
    
Union-Find algorithm:
    if similarity > 0.75: union(entryA, entryB)
    
Assign shared branch_id to clusters of ≥ 3 entries
UPDATE entries SET branch_id = $clusterId
UPDATE insights SET branch_id = $clusterId
```

### `buildAndSaveWidgets(userId)` — `widgets.ts`
Generates and saves to `profiles.settings.dashboard_widgets`:
- `calories_today` — sum of today's kcal_intake metrics
- `expenses_today` — sum by currency
- `mood_trend` — Gemini analysis: "improving" / "stable" / "declining"
- `life_theme` — per-cluster theme label (Gemini)
- `daily_summary` / `weekly_summary` / `monthly_summary` — narrative summaries
- `insight_cluster` — summarized insight clusters

### `autoIncrementStreaks(userId)`
- Finds entries from yesterday with `aggregate=last` streak metrics (keys ending in `_days`)
- If no entry today for that category, creates a new entry with value+1
- Maintains streak counters without user action

---

## Prompt Engineering Notes

### Classification Prompt
- Strict JSON schema output (no markdown wrapping)
- Explicit examples for edge cases (short replies in thread context)
- Category list provided to avoid hallucination
- Fallback: if JSON parse fails, retry with simplified prompt

### Conversational Reply Prompt
- User's last 10 entries provided as "writing style examples"
- Thread context provided as conversation history
- Explicit instruction: "do not start with 'Записано' or similar"
- Temperature: 0.8 (creative but coherent)

### Report Generation Prompt
- All entries in period with metrics provided
- Structured output: 5 sections + summary
- Temperature: 0.7
- Max tokens: 2000
