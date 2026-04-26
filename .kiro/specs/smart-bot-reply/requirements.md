# Requirements Document

## Introduction

The **Smart Bot Reply** feature unifies the Memo bot's conversational response and log confirmation into a single, coherent message. Currently, the bot's conversational reply (`converse.ts`) and the saved-entry summary feel disconnected, causing users to send follow-up questions to verify that their entry was actually recorded. This feature produces one reply per user message that is simultaneously warm and human (matching the user's tone and language) and explicitly confirms what was logged — category, key metrics, and values — so users never need to ask "was that saved?".

The feature applies to all entry types: calories, workout, sleep, expenses, mood, health, and custom categories.

---

## Glossary

- **Smart_Reply_Generator**: The module responsible for producing the unified bot reply after an entry is saved. Replaces the current ad-hoc prompt injection in `text.ts` and `voice.ts`.
- **Log_Summary**: The compact, structured portion of the reply that names the category and lists the key metrics and values extracted from the saved entry.
- **Conversational_Wrap**: The warm, human-sounding portion of the reply that matches the user's tone, language, and energy level.
- **Entry_Payload**: The structured object produced by `classify()` containing `category`, `category_label`, `content`, `dashboard_metrics`, and `goal_metrics`.
- **User_Context**: The object loaded by `loadUserContext()` containing the user's writing-style samples (`tone`) and persistent memory facts (`memory`).
- **Tone_Of_Voice_Rules**: The guidelines defined in `docs/11-tone-of-voice.md` that govern how the bot communicates.
- **Multi_Entry_Message**: A single user message that produces more than one `EntryPayload` (e.g., "ran 5km and ate 200g chicken").
- **Converse_Intent**: A classification result with `intent === "converse"` — the user shares feelings or context alongside a loggable entry.

---

## Requirements

### Requirement 1: Unified Reply for Saved Entries

**User Story:** As a user who just logged an entry, I want the bot's reply to confirm what was saved and feel like a natural conversation, so that I don't need to send a follow-up message to verify the record.

#### Acceptance Criteria

1. WHEN a user message is classified as `save_entry` or `converse` and at least one entry is successfully persisted to the database, THE Smart_Reply_Generator SHALL produce a single reply that contains both a Conversational_Wrap and a Log_Summary.
2. THE Smart_Reply_Generator SHALL include in the Log_Summary the `category_label` and all `dashboard_metrics` (label, value, unit) from the saved Entry_Payload.
3. WHEN an Entry_Payload contains zero `dashboard_metrics`, THE Smart_Reply_Generator SHALL still confirm the category and the entry content in the Conversational_Wrap without appending an empty metrics block.
4. THE Smart_Reply_Generator SHALL produce the reply in the same language the user wrote in (Ukrainian, Russian, or English), matching the language-detection behaviour already present in `converse.ts`.
5. THE Smart_Reply_Generator SHALL NOT start the reply with robotic confirmation phrases such as "Записано!", "Entry saved.", "✅ Збережено", or any equivalent in any supported language.

---

### Requirement 2: Tone and Style Compliance

**User Story:** As a user, I want the bot to sound like a person who noticed what I logged, not a system that confirmed a transaction, so that the interaction feels natural and engaging.

#### Acceptance Criteria

1. THE Smart_Reply_Generator SHALL reference at least one specific number or value from the saved entry's `dashboard_metrics` or `content` in the Conversational_Wrap when such data is present.
2. WHEN the user's message is brief (fewer than 10 words) and contains sufficient numeric data, THE Smart_Reply_Generator SHALL produce a reply of 1–3 sentences and SHALL NOT ask a clarifying question.
3. WHEN the user's message is brief and lacks numeric detail (no measurable quantities), THE Smart_Reply_Generator SHALL ask exactly one clarifying question to gather missing data.
4. THE Smart_Reply_Generator SHALL match the user's energy level: casual messages receive casual replies; detailed messages receive replies that engage with the details.
5. THE Smart_Reply_Generator SHALL NOT include more than one question per reply.
6. THE Smart_Reply_Generator SHALL apply the User_Context tone samples when generating the Conversational_Wrap, replicating the user's vocabulary, emoji usage, and sentence length.

---

### Requirement 3: Log Summary Format

**User Story:** As a user, I want to see a compact summary of exactly what was recorded — category and key numbers — so that I can trust the entry is correct without opening the mini-app.

#### Acceptance Criteria

1. WHEN an Entry_Payload contains one or more `dashboard_metrics`, THE Smart_Reply_Generator SHALL render the Log_Summary as a compact inline block listing each metric as `<label>: <value> <unit>`.
2. THE Smart_Reply_Generator SHALL display ALL `dashboard_metrics` from the Entry_Payload in the Log_Summary without truncation; WHEN multiple metrics are present, THE Smart_Reply_Generator SHALL order them by user-relevance (primary metrics such as kcal_intake, protein_g, distance_km, sleep_hours, expense_amount, and mood_score appear before derived or secondary metrics such as steps_count, fat_g, and carbs_g), but SHALL NOT omit any metric.
3. THE Smart_Reply_Generator SHALL position the Log_Summary after the Conversational_Wrap, not before it.
4. WHEN the entry category is `expenses`, THE Smart_Reply_Generator SHALL include the amount and currency in the Log_Summary.
5. WHEN the entry category is `sleep`, THE Smart_Reply_Generator SHALL include `sleep_hours` in the Log_Summary.
6. WHEN the entry category is `mood` or `feelings`, THE Smart_Reply_Generator SHALL include the `mood_score` or equivalent metric in the Log_Summary if present, and SHALL NOT display a numeric score without a human-readable label.

---

### Requirement 4: Multi-Entry Message Handling

**User Story:** As a user who logs multiple things in one message (e.g., "ran 5km and had 200g chicken"), I want the reply to acknowledge all entries, so that I know everything was captured.

#### Acceptance Criteria

1. WHEN a user message produces a Multi_Entry_Message (two or more Entry_Payloads), THE Smart_Reply_Generator SHALL produce a single reply that covers all saved entries.
2. THE Smart_Reply_Generator SHALL include a complete Log_Summary block for each entry in a Multi_Entry_Message; each Log_Summary block SHALL be separated from the next by a blank line so that each entry's metrics are visually distinct.
3. WHEN a single user message contains multiple distinct categories (e.g., food + drink + exercise + expense), THE Smart_Reply_Generator SHALL decompose the message into one Entry_Payload per distinct item or activity, each with its own full set of `dashboard_metrics`, before rendering the combined reply.
4. THE Smart_Reply_Generator SHALL keep the total reply length for a Multi_Entry_Message under 300 characters of Conversational_Wrap text (excluding the Log_Summary blocks) to avoid overwhelming the user.
5. THE Smart_Reply_Generator SHALL produce a single Conversational_Wrap that acknowledges the full scope of the user's day holistically, rather than repeating a separate conversational sentence for each entry.
6. THE Smart_Reply_Generator SHALL NOT send separate Telegram messages for each entry in a Multi_Entry_Message; all entries SHALL be confirmed in one message.

---

### Requirement 5: Converse Intent Handling

**User Story:** As a user who shares feelings or context alongside a log entry (converse intent), I want the bot to acknowledge my emotional state first and then confirm what was logged, so that the reply feels empathetic rather than transactional.

#### Acceptance Criteria

1. WHEN the classification result has `intent === "converse"`, THE Smart_Reply_Generator SHALL place the empathetic Conversational_Wrap before the Log_Summary.
2. WHEN the classification result has `intent === "converse"` and the entry contains measurable metrics, THE Smart_Reply_Generator SHALL still include the Log_Summary so the user knows the data was captured.
3. WHEN the classification result has `intent === "converse"` and the entry contains no measurable metrics (e.g., a pure feelings entry), THE Smart_Reply_Generator SHALL produce only the Conversational_Wrap with no Log_Summary block.

---

### Requirement 6: Fallback Behaviour

**User Story:** As a user, I want the bot to always send a reply after I log something — even if the AI generation fails — so that I know my entry was saved.

#### Acceptance Criteria

1. IF the Smart_Reply_Generator fails to produce a reply due to an AI generation error, THEN THE Smart_Reply_Generator SHALL send a minimal fallback reply that confirms the category and at least one metric value derived directly from the Entry_Payload without calling the AI model.
2. IF the Entry_Payload contains no metrics and AI generation fails, THEN THE Smart_Reply_Generator SHALL send a fallback reply that names the `category_label` and the entry `content` truncated to 60 characters.
3. THE Smart_Reply_Generator SHALL log all AI generation failures with sufficient context (user ID, category, error message) for debugging, without logging personally identifiable entry content.

---

### Requirement 7: Integration with Existing Pipeline

**User Story:** As a developer, I want the Smart Bot Reply to integrate cleanly into the existing `text.ts` and `voice.ts` handlers without duplicating logic, so that the codebase remains maintainable.

#### Acceptance Criteria

1. THE Smart_Reply_Generator SHALL be implemented as a standalone function exported from a dedicated module (e.g., `src/lib/bot/smart-reply.ts`) that accepts an array of Entry_Payloads, the original user message, the User_Context, and an optional thread context string.
2. THE Smart_Reply_Generator SHALL replace the current ad-hoc `replyPrompt` construction in `src/lib/bot/handlers/text.ts` and `src/lib/bot/handlers/voice.ts` without altering the surrounding entry-save logic.
3. THE Smart_Reply_Generator SHALL reuse `generateConverseReply()` from `converse.ts` as its AI generation backend, passing a structured prompt that includes both the Conversational_Wrap instructions and the Log_Summary data.
4. THE Smart_Reply_Generator SHALL accept a pre-fetched User_Context object so that no additional database round-trips are required beyond those already performed by the calling handler.
5. WHEN the calling handler already has a resolved thread context string, THE Smart_Reply_Generator SHALL incorporate it into the generation prompt to maintain conversational continuity.

---

### Requirement 8: Reply Length and Formatting

**User Story:** As a user on a mobile device, I want bot replies to be concise and easy to read in Telegram, so that I can process the confirmation at a glance.

#### Acceptance Criteria

1. THE Smart_Reply_Generator SHALL produce replies where the Conversational_Wrap is between 1 and 4 sentences.
2. THE Smart_Reply_Generator SHALL use Telegram-compatible Markdown formatting for the Log_Summary (e.g., italic or plain text metric lines), consistent with the existing `sanitizeMarkdown()` utility already used in the handlers.
3. THE Smart_Reply_Generator SHALL NOT use headers, bullet-point lists with dashes, or multi-level formatting in the Conversational_Wrap; the Conversational_Wrap SHALL read as natural prose.
4. THE Smart_Reply_Generator SHALL use emoji naturally and sparingly in the Conversational_Wrap, consistent with the Tone_Of_Voice_Rules, and SHALL NOT add emoji to the Log_Summary metric lines.


---

### Requirement 9: Real-World Input Diversity and Edge Case Handling

**User Story:** As a user who communicates naturally — with vague language, mixed languages, typos, emoji, emotional context, and complex multi-item messages — I want the bot to handle every realistic input gracefully, so that I never feel confused or judged by the response.

#### Acceptance Criteria

##### 9.1 Complex Multi-Category Messages

1. WHEN a user message contains multiple distinct food items, activities, and expenses in a single message (e.g., "Випив пиво, їв біг мак меню і пасту з креветками, потратив 400 грн але і побігав годину в футбол і плавав ще 40хв"), THE Smart_Reply_Generator SHALL decompose the message into one Entry_Payload per distinct item or activity: beer (alcohol_units, kcal), BigMac menu (kcal_intake, protein_g, carbs_g, fat_g), pasta with shrimp (kcal_intake, protein_g, carbs_g, fat_g), expense (400 UAH), football 1 hour (kcal_burned, active_min, steps_count), swimming 40 minutes (kcal_burned, active_min).
2. WHEN a complex multi-category message is decomposed, THE Smart_Reply_Generator SHALL render a separate Log_Summary block for each resulting entry, separated by a blank line.
3. WHEN a complex multi-category message is decomposed, THE Smart_Reply_Generator SHALL produce a single Conversational_Wrap that acknowledges the full day holistically rather than listing each item individually.

##### 9.2 Vague and Implicit Entries

4. WHEN a user message is too vague to extract any measurable data (e.g., "поїв", "потренувався", "витратив гроші"), THE Smart_Reply_Generator SHALL ask exactly one clarifying question to gather the missing information and SHALL NOT create an entry until the user provides sufficient detail.
5. WHEN a user message implies a sleep concern without specifying hours (e.g., "погано сплю"), THE Smart_Reply_Generator SHALL log a mood or sleep-quality note and SHALL ask exactly one question about sleep duration.

##### 9.3 Emotional and Empathy-First Entries

6. WHEN a user message contains emotional context alongside loggable data (e.g., "сьогодні був важкий день, але все ж пробіг 5км і з'їв нормально"), THE Smart_Reply_Generator SHALL place an empathetic acknowledgment before the Log_Summary and SHALL log any quantifiable data present.
7. WHEN a user message expresses frustration about progress alongside a loggable item (e.g., "не можу схуднути, знову з'їв піцу"), THE Smart_Reply_Generator SHALL produce an empathetic Conversational_Wrap, log the calories if estimable, and SHALL NOT use shaming or judgmental language.

##### 9.4 Approximate and Estimated Quantities

8. WHEN a user provides an approximate quantity (e.g., "з'їв десь пів курки"), THE Smart_Reply_Generator SHALL estimate the value using built-in nutritional data (approximately 150 g chicken breast) and SHALL note in the Log_Summary that the value is an estimate.
9. WHEN a user provides a vague distance (e.g., "пробіг кілька кілометрів"), THE Smart_Reply_Generator SHALL either ask for clarification OR log an estimated value (e.g., 3 km) with a note that the value is approximate.
10. WHEN a user provides an unquantifiable liquid reference (e.g., "випив багато води"), THE Smart_Reply_Generator SHALL ask for the amount or log the entry as unquantified without assigning a numeric value.

##### 9.5 Mixed-Language and Emoji-Only Entries

11. WHEN a user message mixes languages (e.g., Ukrainian + English: "зробив workout, з'їв protein shake"), THE Smart_Reply_Generator SHALL classify and log the entry correctly regardless of language mixing and SHALL reply in the user's dominant language.
12. WHEN a user message consists of food emoji without text (e.g., "поел 🍕🍕🍕"), THE Smart_Reply_Generator SHALL classify the entry as calories, estimate the quantity from the emoji count, and log accordingly.
13. WHEN a user message is a single activity emoji (e.g., "🏃"), THE Smart_Reply_Generator SHALL classify it as a workout entry and SHALL ask exactly one clarifying question about duration or distance.

##### 9.6 Correction and Addendum Entries

14. WHEN a user message indicates a correction to a previously stated quantity (e.g., "ні, то було 300г, не 200г"), THE Smart_Reply_Generator SHALL treat the message as an update intent rather than a new entry and SHALL update the most recent relevant entry rather than creating a duplicate.
15. WHEN a user message adds information to a prior entry in the same session (e.g., "забув додати — ще й каву випив"), THE Smart_Reply_Generator SHALL treat the message as an addendum and SHALL append the new data to the existing session context.

##### 9.7 Time-Referenced Entries

16. WHEN a user message references a past date for logging (e.g., "вчора забув записати — пробіг 10км"), THE Smart_Reply_Generator SHALL log the entry with the referenced date rather than the current date.
17. WHEN a user message contains multiple time-of-day references for the same category (e.g., "зранку з'їв вівсянку, в обід суп, ввечері м'ясо"), THE Smart_Reply_Generator SHALL create three separate food entries, each with its own Log_Summary block.

##### 9.8 Goal and Progress Entries

18. WHEN a user message reports goal completion without specific metrics (e.g., "виконав план на тиждень"), THE Smart_Reply_Generator SHALL produce a Conversational_Wrap that acknowledges the achievement and SHALL NOT generate an empty Log_Summary block.
19. WHEN a user message reports a missed activity (e.g., "не вийшло сьогодні потренуватись"), THE Smart_Reply_Generator SHALL log a mood or note entry and SHALL produce an empathetic Conversational_Wrap without shaming language.

##### 9.9 Health and Body Metric Entries

20. WHEN a user message contains a blood pressure reading (e.g., "тиск 120/80"), THE Smart_Reply_Generator SHALL log it as a health metric entry with the appropriate systolic and diastolic values.
21. WHEN a user message contains a body weight (e.g., "вага 78кг"), THE Smart_Reply_Generator SHALL log it as a health metric entry with `weight_kg` as the primary dashboard metric.
22. WHEN a user message contains an elevated body temperature (e.g., "температура 37.5"), THE Smart_Reply_Generator SHALL log it as a health metric entry and SHALL use a tone that acknowledges the health concern without providing medical advice.

##### 9.10 Alcohol Entries

23. WHEN a user message logs alcohol consumption (e.g., "випив 2 пива"), THE Smart_Reply_Generator SHALL log `alcohol_units` and `alcohol_kcal` in the Log_Summary and SHALL use a non-judgmental tone.
24. WHEN a user message implies alcohol consumption without a quantity (e.g., "бухнули з друзями"), THE Smart_Reply_Generator SHALL ask exactly one non-judgmental clarifying question about the quantity consumed.

##### 9.11 Sleep Detail Entries

25. WHEN a user message provides sleep start and end times (e.g., "ліг о 23, встав о 7"), THE Smart_Reply_Generator SHALL calculate the sleep duration (8 hours in this example) and log `sleep_hours` accordingly.
26. WHEN a user message describes disrupted sleep without specifying hours (e.g., "погано спав, прокидався"), THE Smart_Reply_Generator SHALL log a sleep quality concern and SHALL ask exactly one question about total sleep duration.

##### 9.12 Custom and Unusual Activity Categories

27. WHEN a user message logs meditation (e.g., "медитував 20хв"), THE Smart_Reply_Generator SHALL classify it under the health category and SHALL log `meditation_min` as the primary dashboard metric.
28. WHEN a user message logs reading (e.g., "читав годину"), THE Smart_Reply_Generator SHALL classify it under the books category and SHALL log `active_min` or an equivalent reading-time metric.
29. WHEN a user message logs medication intake (e.g., "прийняв ліки"), THE Smart_Reply_Generator SHALL classify it under the health category and SHALL log the entry without requesting medical details beyond what the user provided.

##### 9.13 Voice Message Edge Cases

30. WHEN a voice message transcription has low confidence due to background noise, THE Smart_Reply_Generator SHALL ask the user to confirm the transcribed content before saving the entry.
31. WHEN a voice message is long (approximately 2 minutes or more) and contains multiple distinct items, THE Smart_Reply_Generator SHALL decompose all mentioned items into separate Entry_Payloads following the same multi-entry rules as Requirement 4.
32. WHEN a voice message is in a mixed language, THE Smart_Reply_Generator SHALL detect the dominant language and reply in that language.

##### 9.14 Short and Ambiguous Messages

33. WHEN a user message is a generic acknowledgment with no loggable content (e.g., "ок", "добре", "так"), THE Smart_Reply_Generator SHALL classify it as smalltalk and SHALL NOT create an entry.
34. WHEN a user message is ambiguous (e.g., "все"), THE Smart_Reply_Generator SHALL ask one clarifying question about what the user wants to log.
35. WHEN a user message is a bare number with no unit or context (e.g., "78"), THE Smart_Reply_Generator SHALL ask one clarifying question about what the number refers to (weight, calories, steps, etc.).
36. WHEN a user message is a single "+" character, THE Smart_Reply_Generator SHALL ask one clarifying question about what the user wants to add.

##### 9.15 Formatting and Typo Tolerance

37. WHEN a user message is written in all caps (e.g., "З'ЇВ ПІЦУ"), THE Smart_Reply_Generator SHALL normalize the input and log the entry as if it were written in standard case.
38. WHEN a user message contains minor typos that do not change the meaning (e.g., "пробіг 5кмм"), THE Smart_Reply_Generator SHALL handle the input gracefully, interpret the intended value, and log the entry without requesting correction.
39. WHEN a user message contains emphatic punctuation (e.g., "пробіг 10км!!!"), THE Smart_Reply_Generator SHALL match the user's casual, energetic tone in the Conversational_Wrap.
