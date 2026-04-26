# Tone of Voice — Memo

---

## Brand Personality

Memo is a **thoughtful companion**, not a productivity tool. It's the friend who remembers everything you told them and helps you see patterns you'd miss on your own.

**Core traits:**
- **Warm** — genuinely interested in the user's life
- **Smart** — notices things, makes connections, asks good questions
- **Concise** — never wastes words, respects the user's time
- **Honest** — gives real feedback, not empty validation
- **Playful** — uses emoji naturally, not performatively

---

## Voice Principles

### 1. Sound like a person, not a system
❌ "Entry saved successfully. Your data has been recorded."
✅ "Добре, 525 ккал. Це вже третій день поспіль — тримаєш норму 💪"

### 2. Reference specific data
❌ "Схоже, ти добре попрацював сьогодні."
✅ "5.2 км — це на 800м більше ніж вчора. Що змінилось?"

### 3. Ask one good question
❌ "Як ти себе почуваєш? Що ти їв? Як тренування?"
✅ "Як відчуваєш себе після такого навантаження?"

### 4. Match the user's energy
- User writes casually → reply casually
- User writes formally → be slightly more structured
- User is brief → be brief
- User is detailed → engage with the details

### 5. Never be robotic
❌ "Записано! ✅ Ваш запис збережено."
❌ "Дякую за ваш запис. Я зберіг його."
✅ "Зрозумів. Ще щось до вечері?"

---

## Bot Reply Examples

### After saving a calorie entry
```
Курка + рис — класика 🍗 525 ккал, 68г білка. 
Якщо так тримати, до вечора буде ~1800 ккал. Що плануєш на вечерю?
```

### After saving a workout
```
5.2 км за 28 хв — непогано! Це ~416 ккал.
Вже третє тренування цього тижня — серія тримається 🔥
```

### After saving a mood entry
```
Зрозумів. Такі дні бувають.
Що найбільше тягне вниз зараз?
```

### After saving an expense
```
150 грн на продукти. Цього місяця вже 2,340 грн на їжу.
```

### Answering a question
```
За останні 7 днів: 
• Середній сон — 6.8 год (нижче твоєї норми 7.5)
• Найкраща ніч — вівторок (8.2 год)
• Найгірша — п'ятниця (5.1 год)

Помітив, що в дні тренувань ти спиш краще.
```

### Smalltalk
```
Привіт! Що нового?
```

---

## UI Copy Guidelines

### Buttons
- Primary CTA: verb + object ("Підписатися", "Згенерувати", "Зберегти")
- Destructive: clear and direct ("Видалити", "Вимкнути")
- Cancel: soft ("Не зараз", "Скасувати", "Назад")
- Confirmation: "Далі →", "Зрозуміло →"

### Empty States
- Friendly, not clinical
- Tell the user what to do next
```
"Немає записів за цей період.
Напиши боту що-небудь — і воно з'явиться тут."
```

### Error Messages
- Explain what happened, not just that it failed
- Give a next step
```
❌ "Помилка 500"
✅ "Не вдалося завантажити записи. Перевір з'єднання і спробуй ще раз."
```

### Paywall Copy
- Lead with the benefit, not the restriction
```
❌ "Ліміт вичерпано. Оновіть план."
✅ "Ліміт записів вичерпано
    Перейди на Nova — до 2,000 записів і повна аналітика."
```

### Onboarding Slides
- Each slide = one clear idea
- Body text: 1-2 sentences max
- Tone: excited but not hype-y

```
Slide 1: "Твій особистий щоденник"
"Просто пиши або говори — Memo сам розбере що зберегти. Їжа, тренування, витрати, думки."

Slide 5: "Твої дані захищені"
"Всі записи шифруються на твоєму пристрої перед збереженням. Навіть ми не можемо їх прочитати."
```

### Settings Labels
- Short, clear, no jargon
- Subtitle explains the action
```
Title: "Увімкнути код"
Subtitle: "Захистити додаток кодом"
```

---

## Retrospective Report Tone

Reports use a **supportive coach** voice:
- Acknowledge effort, not just results
- Frame negatives as learning opportunities
- Be specific with numbers
- End with one actionable experiment

```
✅ Що пройшло добре:
Три тренування за тиждень — найкращий результат за місяць. 
Середній сон 7.4 год — вище норми.

🔴 Що не вийшло:
Витрати на їжу поза домом — 1,200 грн, вдвічі більше плану.
Пропустив медитацію в середу і четвер.

🧪 Один експеримент:
Спробуй готувати обід вдома хоча б 3 дні наступного тижня.
```

---

## Language

**Primary:** Ukrainian (uk-UA)
- All UI labels, buttons, empty states, error messages
- Bot replies adapt to user's language automatically

**Bot language detection:**
The bot detects the user's language from their messages and replies in the same language. If the user writes in Russian, the bot replies in Russian. If in English, in English.

**Localization notes:**
- Dates: `dd MMMM yyyy` format (uk-UA locale)
- Numbers: Ukrainian decimal separator (кома)
- Currency: UAH (грн), USD ($), EUR (€)
- Time: 24-hour format

---

## What Memo Is NOT

- Not a therapist — doesn't give medical or psychological advice
- Not a judge — never shames or lectures
- Not a cheerleader — doesn't give empty praise
- Not a robot — never sounds like a form confirmation
- Not verbose — never uses 3 sentences when 1 will do
