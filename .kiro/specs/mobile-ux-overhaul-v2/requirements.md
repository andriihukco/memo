# Requirements Document

## Introduction

This document specifies the requirements for **Mobile UX Overhaul v2** of the Memo Telegram Mini App (Next.js 14, Tailwind CSS, dark theme). The overhaul covers four areas:

1. **Insights tab iOS-style redesign** — Apple Health-inspired large-title layout, grouped card sections, iOS action-sheet bottom sheet for report creation, and a polished empty state.
2. **Widget creation chip-based AI flow** — Replace the free-text prompt with a category chip selector → pre-built question chips → confirm flow; add direct log-entry bottom sheet from widget cards.
3. **Log vs Goals visual distinction** — Feed entries visually differentiate "log" facts from "goal" targets; goal entries show a progress bar and current/target values.
4. **Full UX polish pass** — Consistent bottom-sheet anatomy, backdrop-blur modals, SF Pro-style typography scale, 44 × 44 px touch targets, haptic-style sound feedback, skeleton loading, inline dismissible errors, destructive-action confirmation sheets, and back-navigation on all sub-pages.

All changes build on the existing dark gradient background (`#1E1B4A → #04081A`), the `snd-lib` sound system, Material Symbols Rounded icons, and the pill-shaped Tab_Bar already in place.

---

## Glossary

- **App**: The Memo Telegram Mini App running inside Telegram WebApp.
- **Tab_Bar**: The floating pill-shaped bottom navigation bar in `src/app/miniapp/layout.tsx`.
- **Feed_Page**: `src/app/miniapp/page.tsx` — the chronological entry feed.
- **Widgets_Page**: `src/app/miniapp/dashboard/page.tsx` — metric widgets and goals.
- **Insights_Page**: `src/app/miniapp/reports/page.tsx` — retrospective reports.
- **Entry**: A single user journal record in the `entries` table.
- **Log_Entry**: An Entry whose `metadata.entry_type` equals `"log"` (or is absent/null) — records a fact that already happened (e.g., "з'їв 400 ккал").
- **Goal_Entry**: An Entry whose `metadata.entry_type` equals `"goal"` — records a target or intention (e.g., "хочу схуднути на 5 кг").
- **Widget**: A custom metric tracker stored in the `widgets` table, rendered as a card on the Widgets_Page.
- **Report**: A retrospective analysis record stored in the `reports` table, rendered as a card on the Insights_Page.
- **Bottom_Sheet**: A modal panel that slides up from the bottom of the screen, with a drag handle, backdrop, and safe-area-aware padding.
- **Chip**: A compact, pill-shaped selectable button used for category or option selection.
- **Skeleton_Screen**: A placeholder UI that mimics the shape of loading content using animated grey blocks, shown instead of a spinner while data is fetching.
- **Sound_System**: The `snd-lib`-based `SoundContext` / `useSound()` hook already implemented in `src/lib/sound/`.
- **Safe_Area**: The device-specific inset values exposed by `window.Telegram.WebApp.safeAreaInset` and `contentSafeAreaInset`.
- **iOS_Large_Title**: A page heading style with font-size 28 px, font-weight 700, matching Apple's iOS large-title pattern.
- **iOS_Section_Header**: A grouped-list section label at 13 px, uppercase, letter-spacing 0.05 em, muted colour — matching Apple's UITableView grouped section header style.
- **Progress_Bar**: A horizontal bar showing current value as a filled proportion of a target value.
- **Haptic_Sound**: A sound played via `useSound().play()` to simulate haptic feedback in the Telegram WebApp environment.
- **CTA_Button**: A full-width primary action button placed at the bottom of a Bottom_Sheet or page section.
- **Material_Symbols**: Google Material Symbols Rounded icon font already loaded in the App.
- **WCAG_AA**: Web Content Accessibility Guidelines 2.1 Level AA — minimum 4.5:1 contrast for normal text, 3:1 for large text and UI components.

---

## Requirements

### Requirement 1: Insights Tab — iOS-Style Page Layout

**User Story:** As a user, I want the Insights tab to feel like the Apple Health app, so that retrospective reports are presented in a clean, premium, and easy-to-scan layout.

#### Acceptance Criteria

1. THE Insights_Page SHALL render the page title "Інсайти" as an iOS_Large_Title (28 px, bold) at the top of the scrollable content area, with a subtitle "Ретроспектива та аналіз" at 13 px in muted colour directly below it.
2. THE Insights_Page SHALL render each Report as a card styled as an iOS list row: white/surface background, 16 px horizontal padding, 14 px vertical padding, 16 px border-radius, and a subtle 1 px border using the existing `border-border` token.
3. WHEN a Report card is in its collapsed state, THE Insights_Page SHALL display the period label (e.g., "7 днів"), the date range (e.g., "1 лип — 7 лип"), and a two-line truncated summary, with a chevron icon (`expand_more`) on the right edge.
4. WHEN a Report card is expanded, THE Insights_Page SHALL render each retro section (went_well, didnt_go_well, start_stop_continue, experiment, lesson) as an iOS_Section_Header followed by the section body text, grouped inside the same card with a hairline divider between sections.
5. THE Insights_Page SHALL group Report cards under iOS_Section_Header labels by month (e.g., "Липень 2025"), sorted newest-first within each month group.
6. THE Insights_Page SHALL use the existing dark gradient background (`#1E1B4A → #04081A`) as the page background, with Report cards using a slightly elevated surface colour (`bg-surface-elevated` or equivalent) to create depth.
7. WHEN the Insights_Page has no Reports and is not loading, THE Insights_Page SHALL display a polished empty state: a large `wb_incandescent` Material Symbols icon (48 px, muted), a title "Ще немає ретроспектив" (17 px, semibold), a subtitle "Натисни + щоб проаналізувати свій прогрес" (15 px, muted), and a full-width CTA_Button "Створити першу ретроспективу" that opens the New Report Bottom_Sheet.
8. THE Insights_Page SHALL render a floating `+` action button (40 × 40 px, primary colour, circular) in the top-right of the header area that opens the New Report Bottom_Sheet when tapped, playing the `OPEN` Haptic_Sound.
9. WHEN the Insights_Page is loading Reports, THE Insights_Page SHALL display a Skeleton_Screen consisting of two placeholder Report card shapes (rounded rectangles with animated shimmer) instead of a spinner.

---

### Requirement 2: Insights Tab — New Report Bottom Sheet (iOS Action Sheet Style)

**User Story:** As a user, I want the "new report" flow to feel like a native iOS action sheet, so that selecting a report period is fast and visually polished.

#### Acceptance Criteria

1. THE New_Report_Bottom_Sheet SHALL be a Bottom_Sheet with a drag handle (40 × 4 px, rounded, muted colour) centred at the top, a title "Нова ретроспектива" (17 px, semibold), and a subtitle "Оберіть період для аналізу" (13 px, muted).
2. THE New_Report_Bottom_Sheet SHALL render period options as full-width iOS-style list rows (not a 3-column grid), each row containing a leading icon, a label, and a trailing chevron or checkmark when selected. The rows SHALL be: "Сьогодні" (`today` icon), "7 днів" (`date_range` icon), "Місяць" (`calendar_month` icon), "Свій діапазон" (`tune` icon).
3. WHEN the user selects "Свій діапазон", THE New_Report_Bottom_Sheet SHALL expand inline to reveal two date-picker inputs (from / to) with a hairline divider above them, without closing and reopening the sheet.
4. THE New_Report_Bottom_Sheet SHALL display a full-width CTA_Button "Згенерувати ретроспективу" at the bottom, disabled until a period is selected, with Safe_Area bottom padding applied.
5. WHEN the CTA_Button is tapped, THE New_Report_Bottom_Sheet SHALL close, play the `PROCESSING` Haptic_Sound, and show a generation progress indicator on the Insights_Page (rotating progress labels as currently implemented).
6. THE New_Report_Bottom_Sheet backdrop SHALL use `bg-black/50 backdrop-blur-sm` so the page content is visible but blurred behind the sheet.
7. WHEN the user swipes down on the drag handle or taps the backdrop, THE New_Report_Bottom_Sheet SHALL close and play the `CLOSE` Haptic_Sound.
8. IF the report generation fails, THEN THE Insights_Page SHALL display an inline dismissible error banner (destructive background, error text, × dismiss button, retry action) below the page title, without showing a modal.

---

### Requirement 3: Insights Tab — Report Deletion Confirmation

**User Story:** As a user, I want deleting a report to require confirmation, so that I don't accidentally lose retrospective data.

#### Acceptance Criteria

1. WHEN the user taps the delete icon on a Report card, THE Insights_Page SHALL open a confirmation Bottom_Sheet (not an inline confirm) with title "Видалити ретроспективу?", subtitle "Цю дію не можна скасувати.", a full-width destructive CTA_Button "Видалити", and a secondary "Скасувати" button below it.
2. THE confirmation Bottom_Sheet SHALL play the `CAUTION` Haptic_Sound when it opens.
3. WHEN the user confirms deletion, THE Insights_Page SHALL remove the Report card from the list with a fade-out animation and play the `CLOSE` Haptic_Sound.
4. WHEN the user cancels, THE confirmation Bottom_Sheet SHALL close and play the `CLOSE` Haptic_Sound, leaving the Report card unchanged.

---

### Requirement 4: Widget Creation — Chip-Based Category Selector

**User Story:** As a user, I want to create a widget by tapping category chips instead of typing a free-text prompt, so that widget creation is faster and requires less cognitive effort.

#### Acceptance Criteria

1. THE Create_Widget_Sheet SHALL replace the current free-text prompt input with a chip-based flow consisting of three sequential steps: (1) category selection, (2) question/metric selection, (3) confirmation.
2. THE Create_Widget_Sheet step 1 SHALL display a title "Що хочеш відстежувати?" and a horizontally wrapping grid of Chips for the following categories: "Харчування" (`restaurant` icon), "Активність" (`fitness_center` icon), "Сон" (`bedtime` icon), "Вода" (`water_drop` icon), "Вага" (`scale` icon), "Витрати" (`account_balance_wallet` icon), "Настрій" (`sentiment_satisfied` icon), "Кастомний" (`add_circle` icon).
3. WHEN the user taps a category Chip, THE Create_Widget_Sheet SHALL highlight the selected Chip (primary border and background tint) and transition to step 2 with a horizontal slide animation, playing the `SELECT` Haptic_Sound.
4. THE Create_Widget_Sheet step 2 SHALL display 2–3 pre-built question Chips relevant to the selected category, plus a "Свій варіант" Chip that reveals a text input. The pre-built questions per category SHALL be:
   - Харчування: "Калорії за день", "Білки / жири / вуглеводи", "Конкретний продукт"
   - Активність: "Кроки за день", "Хвилини тренування", "Дистанція (км)"
   - Сон: "Годин сну", "Якість сну (1–10)", "Час підйому"
   - Вода: "Мл води за день", "Склянки води", "Відсоток норми"
   - Вага: "Поточна вага (кг)", "Зміна ваги за тиждень", "ІМТ"
   - Витрати: "Витрати за день (грн)", "Витрати за категорією", "Залишок бюджету"
   - Настрій: "Оцінка настрою (1–10)", "Рівень стресу (1–10)", "Рівень енергії (1–10)"
   - Кастомний: (no pre-built chips — immediately shows text input)
5. WHEN the user taps a pre-built question Chip, THE Create_Widget_Sheet SHALL highlight it and enable the "Далі" button, playing the `SELECT` Haptic_Sound.
6. WHEN the user taps "Свій варіант", THE Create_Widget_Sheet SHALL reveal a text input field below the chips and focus it automatically, playing the `OPEN` Haptic_Sound.
7. THE Create_Widget_Sheet step 2 SHALL display a "← Назад" text button that returns to step 1 without losing the category selection.
8. THE Create_Widget_Sheet step 3 SHALL display a summary card showing the selected category icon, category name, and metric question, with a full-width CTA_Button "Створити віджет" and a secondary "← Змінити" link.
9. WHEN the CTA_Button "Створити віджет" is tapped, THE Create_Widget_Sheet SHALL show a creating state (spinner + "AI створює твій віджет..."), call the existing `/api/widgets` endpoint with the resolved prompt, and on success play the `CELEBRATION` Haptic_Sound and close the sheet after 1.2 seconds.
10. IF widget creation fails, THEN THE Create_Widget_Sheet SHALL return to step 3 and display an inline error message in Ukrainian below the summary card, with a retry button.
11. THE Create_Widget_Sheet SHALL be a Bottom_Sheet with a drag handle, `backdrop-blur-sm` backdrop, and Safe_Area bottom padding on the CTA_Button.

---

### Requirement 5: Widget Cards — Direct Log Entry

**User Story:** As a user, I want to log a value directly from a widget card without navigating away, so that tracking is fast and frictionless.

#### Acceptance Criteria

1. WHEN a Widget card on the Widgets_Page is tapped (not long-pressed), THE Widgets_Page SHALL open a Log_Entry_Bottom_Sheet for that widget instead of the existing DrillDownDrawer.
2. THE Log_Entry_Bottom_Sheet SHALL display the widget's icon, title, and unit, a large numeric input field (font-size ≥ 24 px) pre-focused, and a full-width CTA_Button "Зберегти" with Safe_Area bottom padding.
3. WHEN the user submits a value via the Log_Entry_Bottom_Sheet, THE Widgets_Page SHALL create a new entry via the existing entries API, play the `CELEBRATION` Haptic_Sound, close the sheet, and refresh the widget value without a full page reload.
4. THE Log_Entry_Bottom_Sheet SHALL include a "Переглянути записи" secondary link below the CTA_Button that opens the existing DrillDownDrawer for that widget.
5. WHEN the Log_Entry_Bottom_Sheet is open, THE Widgets_Page SHALL play the `OPEN` Haptic_Sound on open and `CLOSE` on close.
6. IF the log submission fails, THEN THE Log_Entry_Bottom_Sheet SHALL display an inline error message in Ukrainian below the input, with a retry action, without closing the sheet.
7. THE Log_Entry_Bottom_Sheet SHALL have a drag handle and `backdrop-blur-sm` backdrop consistent with all other Bottom_Sheets in the App.

---

### Requirement 6: Log vs Goals Visual Distinction in the Feed

**User Story:** As a user, I want to immediately see whether a feed entry is a logged fact or a goal/intention, so that I can understand my history at a glance without reading every entry.

#### Acceptance Criteria

1. THE Feed_Page SHALL visually distinguish Log_Entry cards from Goal_Entry cards using a distinct left-edge accent: Log_Entry cards SHALL have a `border-l-4 border-primary/40` accent; Goal_Entry cards SHALL have a `border-l-4 border-amber-400` accent.
2. WHEN a Goal_Entry card is rendered, THE Feed_Page SHALL display a Progress_Bar below the entry content showing the ratio of the current logged value to the goal target value, using data from `metadata.goal_metrics[0]` (current value from matching Log_Entry aggregation, target from `goal_metrics[0].target`).
3. WHEN a Goal_Entry card is rendered, THE Feed_Page SHALL display a compact row below the Progress_Bar showing: current value, "/" separator, target value, unit, and percentage (e.g., "32 / 100 км · 32%").
4. WHEN a Goal_Entry has no matching logged value yet, THE Feed_Page SHALL render the Progress_Bar at 0% and display "0 / {target} {unit} · 0%".
5. WHEN a Goal_Entry's progress reaches 100% or more, THE Feed_Page SHALL render the Progress_Bar fully filled in `bg-green-400` and display a `check_circle` icon (14 px, green) next to the percentage.
6. THE Feed_Page SHALL display a small "Ціль" badge (amber background, dark text, 10 px) on Goal_Entry cards in the category badge row, positioned before the category badges.
7. THE Feed_Page SHALL display a small "Лог" badge (primary/blue background, 10 px) on Log_Entry cards only when the entry has `metadata.dashboard_metrics` with at least one metric, to indicate it contains tracked data.
8. WHEN `metadata.entry_type` is absent or null on an Entry, THE Feed_Page SHALL treat it as a Log_Entry for display purposes.

---

### Requirement 7: Bottom Sheet Anatomy Standard

**User Story:** As a user, I want all bottom sheets in the app to look and behave consistently, so that the interface feels cohesive and predictable.

#### Acceptance Criteria

1. THE App SHALL ensure every Bottom_Sheet has: a centred drag handle (40 × 4 px, `bg-muted`, `rounded-full`) as the first child element inside the sheet panel.
2. THE App SHALL ensure every Bottom_Sheet applies bottom padding equal to `max(var(--bottom-inset, 0px), 16px) + 1rem` so content is never obscured by the device home indicator.
3. THE App SHALL ensure every Bottom_Sheet CTA_Button is full-width (`w-full`), has a minimum height of 44 px, and is placed as the last interactive element before the bottom padding.
4. THE App SHALL ensure every Bottom_Sheet backdrop uses `bg-black/50 backdrop-blur-sm` and closes the sheet when tapped.
5. WHEN any Bottom_Sheet opens, THE App SHALL play the `OPEN` Haptic_Sound; WHEN it closes (by any means), THE App SHALL play the `CLOSE` Haptic_Sound.
6. THE App SHALL apply these Bottom_Sheet standards to all existing sheets: NewReportDrawer, DeleteSheet (reports), CreateWidgetSheet, MetricEditSheet, DrillDownDrawer, CalendarSheet, EditDrawer, and DeleteConfirmDialog (feed).

---

### Requirement 8: Typography Scale

**User Story:** As a user, I want the app's text to follow a clear visual hierarchy, so that I can scan content quickly and understand importance at a glance.

#### Acceptance Criteria

1. THE App SHALL apply the following typography scale consistently across all pages and components:
   - **iOS_Large_Title**: 28 px, font-weight 700 — page titles (Insights, Feed, Widgets headings)
   - **Title**: 17 px, font-weight 600 — Bottom_Sheet titles, card primary labels, section headings
   - **Body**: 15 px, font-weight 400 — entry content, description text, list row primary text
   - **Caption**: 13 px, font-weight 400 — subtitles, secondary labels, iOS_Section_Header text
   - **Footnote**: 11 px, font-weight 400 — timestamps, badge text, metadata annotations
2. THE App SHALL NOT use font sizes outside this scale for new UI elements introduced by this spec.
3. THE App SHALL apply `font-weight 600` (semibold) to all Bottom_Sheet titles and card primary labels.
4. THE App SHALL apply `text-muted-foreground` colour to all Caption and Footnote text to maintain WCAG_AA contrast against the dark background.

---

### Requirement 9: Touch Target Compliance

**User Story:** As a user, I want every tappable element to be large enough to tap accurately on a phone, so that I don't accidentally trigger the wrong action.

#### Acceptance Criteria

1. THE App SHALL ensure every interactive element (button, link, icon button, chip, tab) has a minimum touch target of 44 × 44 px, achieved via padding, `min-h-[44px] min-w-[44px]`, or an invisible tap-area overlay.
2. THE App SHALL ensure Chip elements have a minimum height of 44 px and horizontal padding of at least 16 px.
3. THE App SHALL ensure icon-only buttons (close, delete, expand) have a minimum 44 × 44 px tap area even if the visible icon is smaller (e.g., 14–18 px icon inside a 44 × 44 px button).
4. THE App SHALL ensure Tab_Bar tab items maintain their existing 44 × 44 px minimum touch target.
5. THE App SHALL ensure the drag handle area of every Bottom_Sheet has a minimum 44 px tall tap/drag zone even though the visible handle is 4 px tall.

---

### Requirement 10: Loading States — Skeleton Screens

**User Story:** As a user, I want to see placeholder content while data loads, so that the app feels fast and I understand that content is coming.

#### Acceptance Criteria

1. THE Insights_Page SHALL display a Skeleton_Screen of 2–3 placeholder Report card shapes while Reports are loading, replacing the current spinner.
2. THE Widgets_Page SHALL display a Skeleton_Screen of 4–6 placeholder metric card shapes (matching the MetricCard dimensions) while metrics are loading, replacing the current spinner.
3. THE Feed_Page SHALL display a Skeleton_Screen of 3–5 placeholder entry card shapes while entries are loading, replacing the current spinner.
4. WHEN a Skeleton_Screen is displayed, THE App SHALL animate the placeholder shapes with a left-to-right shimmer effect using a CSS animation (`animate-pulse` or a custom shimmer keyframe).
5. WHEN data finishes loading, THE App SHALL transition from Skeleton_Screen to real content without a flash or layout shift.

---

### Requirement 11: Error States — Inline Dismissible Banners

**User Story:** As a user, I want errors to appear inline and be dismissible, so that I can understand what went wrong and retry without losing my context.

#### Acceptance Criteria

1. THE App SHALL display all non-fatal errors (failed data fetch, failed save, failed generation) as inline error banners positioned immediately below the page title or the triggering UI element, NOT as modal dialogs.
2. THE Error_Banner SHALL contain: a `error` Material Symbols icon (16 px, destructive colour), an error message in Ukrainian (Body size, destructive colour), a "Повторити" text button on the right, and a `×` dismiss icon button on the far right.
3. WHEN the user taps "Повторити", THE Error_Banner SHALL hide and re-trigger the failed operation, playing the `BUTTON` Haptic_Sound.
4. WHEN the user taps `×`, THE Error_Banner SHALL dismiss with a fade-out animation and play the `CLOSE` Haptic_Sound.
5. THE Error_Banner SHALL have a `bg-destructive/10 border border-destructive/30 rounded-xl` appearance consistent with the existing dark theme.
6. THE App SHALL apply this Error_Banner pattern to: report generation errors (Insights_Page), widget creation errors (Create_Widget_Sheet), log entry submission errors (Log_Entry_Bottom_Sheet), and entry fetch errors (Feed_Page, Widgets_Page).

---

### Requirement 12: Destructive Action Confirmation Standard

**User Story:** As a user, I want all destructive actions to require a confirmation step, so that I never accidentally delete data.

#### Acceptance Criteria

1. THE App SHALL require a confirmation Bottom_Sheet before executing any destructive action: deleting a Report, deleting a Widget, deleting one or more Feed entries, and deleting a metric (MetricEditSheet).
2. THE Confirmation_Bottom_Sheet SHALL contain: a drag handle, a title describing the action (e.g., "Видалити ретроспективу?"), a subtitle "Цю дію не можна скасувати." (Caption, muted), a full-width destructive CTA_Button as the primary action, and a full-width secondary "Скасувати" button below it.
3. WHEN the Confirmation_Bottom_Sheet opens, THE App SHALL play the `CAUTION` Haptic_Sound.
4. WHEN the user confirms the destructive action, THE App SHALL play the `CAUTION` Haptic_Sound and execute the deletion.
5. WHEN the user cancels, THE App SHALL play the `CLOSE` Haptic_Sound and close the sheet without any data change.
6. THE App SHALL NOT use inline confirm patterns (e.g., "Так / Ні" inside a card row) for destructive actions; all confirmations SHALL use the Confirmation_Bottom_Sheet.

---

### Requirement 13: Empty States Standard

**User Story:** As a user, I want empty states to be informative and actionable, so that I understand what the section is for and know how to get started.

#### Acceptance Criteria

1. THE App SHALL render a standardised empty state on every page and section that can have zero items, consisting of: a large Material Symbols icon (48 px, `text-muted-foreground/40`), a title (Title size, `text-muted-foreground`), a subtitle (Body size, `text-muted-foreground/70`), and a CTA_Button where a primary action is available.
2. THE Insights_Page empty state SHALL use icon `wb_incandescent`, title "Ще немає ретроспектив", subtitle "Проаналізуй свій прогрес за будь-який період", CTA "Створити першу ретроспективу".
3. THE Widgets_Page metrics empty state SHALL use icon `dashboard`, title "Немає даних за цей період", subtitle "Запиши активність, їжу або сон у боті", and no CTA (data comes from bot entries).
4. THE Widgets_Page goals empty state SHALL use icon `my_location`, title "Цілей ще немає", subtitle "Скажи боту: «Хочу пробігти 100 км цього місяця»", and no CTA.
5. THE Feed_Page empty state SHALL use icon `contract`, title "Стрічка порожня", subtitle "Надішли повідомлення боту, щоб почати", and no CTA.
6. WHEN a category filter is active and returns no results, THE Feed_Page SHALL display a filtered empty state: icon `filter_list`, title "Немає записів у цій категорії", subtitle "Спробуй іншу категорію або зніми фільтр", CTA "Зняти фільтр".

---

### Requirement 14: Back Navigation on Sub-Pages

**User Story:** As a user, I want a back button on every sub-page and deep-linked view, so that I can always return to the previous context without using the device gesture.

#### Acceptance Criteria

1. THE App SHALL render a back button (`arrow_back` Material Symbols icon, 44 × 44 px touch target) in the top-left of the header on every page that is not a root Tab_Bar destination.
2. WHEN the back button is tapped, THE App SHALL navigate to the previous page using `router.back()` and play the `SLIDE` Haptic_Sound.
3. THE back button SHALL be present on: the Subscriptions page (`/miniapp/subscriptions`), the Onboarding page (`/miniapp/onboarding`), and any future sub-pages added by this spec.
4. THE DrillDownDrawer and all Bottom_Sheets SHALL include a close button (`close` icon, 44 × 44 px) in the top-right corner as an alternative to swipe-down dismissal.
5. WHEN a Bottom_Sheet or DrillDownDrawer has a multi-step flow (e.g., Create_Widget_Sheet steps 1–3), each step after the first SHALL display a "← Назад" text button that returns to the previous step, not a close button.

---

### Requirement 15: Modal Backdrop and Animation Standard

**User Story:** As a user, I want modals and bottom sheets to open and close with smooth, spring-like animations, so that the app feels fluid and native.

#### Acceptance Criteria

1. THE App SHALL animate every Bottom_Sheet entrance with a slide-up transition (`translateY` from 100% to 0%) over 300 ms using a CSS ease-out or spring curve.
2. THE App SHALL animate every Bottom_Sheet exit with a slide-down transition (`translateY` from 0% to 100%) over 250 ms using a CSS ease-in curve.
3. THE App SHALL animate every modal backdrop entrance with a fade-in (`opacity` 0 → 0.5) over 200 ms and exit with a fade-out over 200 ms.
4. THE App SHALL apply `backdrop-blur-sm` to all modal backdrops so the underlying page content is visible but blurred.
5. WHEN a Bottom_Sheet is dragged down past 40% of its height, THE App SHALL commit the close animation and dismiss the sheet, playing the `CLOSE` Haptic_Sound.
6. THE App SHALL NOT use abrupt show/hide (display: none toggling without animation) for any Bottom_Sheet or modal introduced or modified by this spec.


---

## Subscription & Monetisation Requirements

### Glossary Additions

- **Free_Tier**: The default plan every new user starts on. Hard limits apply to entries, widgets, and reports.
- **Basic_Tier** (`stars_basic`): 250 Telegram Stars (~$3.25 / month). Removes most limits and unlocks AI features.
- **Pro_Tier** (`stars_pro`): 500 Telegram Stars (~$6.50 / month). Fully unlimited — no caps on any feature.
- **Paywall_Modal**: A Bottom_Sheet that appears when a user hits a Free_Tier limit or taps a locked feature, explaining the limit and offering an upgrade path.
- **Onboarding_Paywall**: A full-screen paywall shown immediately after the last onboarding slide, before the user enters the app for the first time.
- **Usage_Counter**: A small inline indicator (e.g., "3 / 5 звітів") shown near a limited feature so the user always knows how close they are to the cap.
- **Limit_Gate**: Server-side enforcement of tier limits in API routes; returns HTTP 402 with a structured error body when a limit is exceeded.

---

### Requirement 16: Subscription Tier Definitions and Limits

**User Story:** As a product owner, I want clearly defined tier limits so that the free plan is genuinely useful but creates natural upgrade pressure, and paid plans feel worth the price.

#### Tier Limit Table

| Feature | Free | Basic (250 ⭐) | Pro (500 ⭐) |
|---|---|---|---|
| Journal entries (total stored) | 100 | 2 000 | Unlimited |
| Widgets (active) | 3 | 15 | Unlimited |
| Retrospective reports (total stored) | 5 | 50 | Unlimited |
| Entry history visible in feed | 30 days | 1 year | All time |
| AI retrospective generation | ✗ | ✓ | ✓ |
| AI smart recommendations | ✗ | ✓ | ✓ |
| Voice message logging | ✗ | ✓ | ✓ |
| Goal tracking & progress bars | ✗ | ✓ | ✓ |
| Custom widget creation (AI flow) | ✗ | ✓ | ✓ |
| Graph / analytics page | Read-only last 7 days | Full history | Full history + export |
| Entry encryption (client-side AES) | ✓ | ✓ | ✓ |
| Passcode lock | ✓ | ✓ | ✓ |
| Priority AI processing | ✗ | ✗ | ✓ |
| Data export (JSON / CSV) | ✗ | ✗ | ✓ |

#### Acceptance Criteria

1. THE App SHALL enforce all Free_Tier limits server-side in the relevant API routes (`/api/entries`, `/api/widgets`, `/api/reports`). When a limit is exceeded, the API SHALL return HTTP 402 with body `{ "error": "limit_exceeded", "feature": "<name>", "limit": <n>, "current": <n>, "required_tier": "stars_basic" | "stars_pro" }`.
2. THE App SHALL enforce all Basic_Tier limits server-side. Pro_Tier has no numeric caps.
3. THE App SHALL read the user's `subscription_tier` from the `profiles` table on every limit-checked API call using the service-role client (not the user JWT) to prevent spoofing.
4. THE App SHALL NOT silently drop data when a limit is reached; it SHALL reject the write and return the structured 402 error.
5. THE App SHALL enforce the entry history visibility limit by filtering `created_at` in the `/api/entries` query: Free = last 30 days, Basic = last 365 days, Pro = no filter.
6. THE App SHALL enforce the widget active count limit by counting rows in the `widgets` table for the user before inserting a new one.
7. THE App SHALL enforce the report count limit by counting rows in the `reports` table for the user before inserting a new one.

---

### Requirement 17: Paywall Modal (Limit Gate UI)

**User Story:** As a user, when I hit a plan limit, I want to see a clear, non-intrusive explanation of what I've hit and a direct path to upgrade, so that I understand the value of upgrading without feeling punished.

#### Acceptance Criteria

1. WHEN the App receives an HTTP 402 `limit_exceeded` response from any API route, THE App SHALL open a Paywall_Modal Bottom_Sheet instead of showing a generic error banner.
2. THE Paywall_Modal SHALL display:
   - A relevant icon (48 px, primary/amber colour) matching the blocked feature (e.g., `wb_incandescent` for reports, `dashboard` for widgets, `contract` for entries).
   - A title describing the limit hit (e.g., "Ліміт звітів вичерпано") at Title size (17 px, semibold).
   - A subtitle showing the current usage (e.g., "У безкоштовному плані доступно 5 звітів. Ти використав 5 з 5.") at Body size (15 px, muted).
   - A feature comparison row showing what the upgrade unlocks (e.g., "Basic: до 50 звітів · Pro: необмежено").
   - A primary CTA_Button "Перейти на Basic — 250 ⭐" (or Pro if Basic is already active).
   - A secondary ghost button "Не зараз" that closes the sheet.
3. THE Paywall_Modal SHALL play the `CAUTION` Haptic_Sound on open.
4. WHEN the primary CTA is tapped, THE Paywall_Modal SHALL close and navigate to `/miniapp/subscriptions` with the recommended tier pre-selected, playing the `OPEN` Haptic_Sound.
5. THE Paywall_Modal SHALL be dismissible by swipe-down, backdrop tap, or "Не зараз" button, all playing the `CLOSE` Haptic_Sound.
6. THE App SHALL show the Paywall_Modal for the following triggers: entry limit reached (Feed_Page, bot entry creation), widget limit reached (Widgets_Page), report limit reached (Insights_Page), and any attempt to use a locked feature (AI reports, recommendations, voice logging, custom widgets, goal tracking).
7. WHEN a locked feature (not a count limit) is tapped by a Free_Tier user, THE App SHALL open the Paywall_Modal with a feature-specific message (e.g., "Ретроспективи доступні з планом Basic") before any API call is made.

---

### Requirement 18: Subscriptions Page Redesign

**User Story:** As a user, I want the subscriptions page to clearly show what I get at each tier, how the pricing compares, and make it easy to upgrade, so that the decision to pay feels informed and confident.

#### Acceptance Criteria

1. THE Subscriptions_Page SHALL display a page header with iOS_Large_Title "Підписка" and Caption subtitle "Підтримай Memo та отримай більше можливостей".
2. THE Subscriptions_Page SHALL display the user's current plan in a highlighted banner at the top, showing the tier name, icon, and either the expiry date or "Постійний доступ" for granted access.
3. THE Subscriptions_Page SHALL render three plan cards in order: Free → Basic → Pro. Each card SHALL display:
   - Tier icon (emoji) and name (Title size).
   - Price in Stars with "/ місяць" label, or "Безкоштовно" for Free.
   - A short description (Caption, muted).
   - A feature list with checkmarks (✓ green) for included features and (✗ muted) for excluded features, covering all 14 features from the Tier Limit Table.
   - A CTA button: "Підписатися за N ⭐" for upgrades, "Активний" badge for the current tier, "Поточний план" label for Free when on Free.
4. THE Basic plan card SHALL be visually highlighted as the recommended option with a "Найпопулярніший" badge (primary colour, top-right corner of the card).
5. THE Pro plan card SHALL use a gold gradient (`from-yellow-400 to-amber-400`) on the CTA button.
6. THE Subscriptions_Page SHALL display a Usage_Counter section below the plan cards showing the user's current usage for each limited feature (e.g., "Записи: 47 / 100", "Віджети: 3 / 3", "Звіти: 2 / 5").
7. THE Subscriptions_Page SHALL display a footer note: "Оплата через Telegram Stars · Підписка на 30 днів · Поновлення вручну · Без прихованих платежів".
8. WHEN the user successfully subscribes, THE Subscriptions_Page SHALL show a success banner (green, dismissible) and refresh the profile data to reflect the new tier.
9. THE Subscriptions_Page SHALL apply the back-navigation standard from Requirement 14 (arrow_back button, plays `SLIDE`).

---

### Requirement 19: Enhanced Onboarding with Feature Details and Paywall

**User Story:** As a new user, I want the onboarding to explain Memo's key differentiators (including encryption and privacy), and I want to see the subscription options immediately after, so that I understand the value before I start using the app.

#### Acceptance Criteria

1. THE Onboarding SHALL consist of exactly 6 slides (up from 5), in this order:
   - **Slide 1 — "Твій особистий щоденник"**: emoji 📓, body explains voice + text logging, AI parsing.
   - **Slide 2 — "AI, що тебе розуміє"**: emoji 🤖, body explains calorie counting, activity tracking, Q&A over past entries.
   - **Slide 3 — "Дашборд і графіки"**: emoji 📊, body explains metrics, progress, trends.
   - **Slide 4 — "Розумні рекомендації"**: emoji 💡, body explains AI pattern detection (sleep, nutrition, stress).
   - **Slide 5 — "Твої дані захищені"**: emoji 🔐, body: "Всі записи шифруються на твоєму пристрої перед збереженням. Навіть ми не можемо їх прочитати. Твоя приватність — наш пріоритет." Accent colour: `text-emerald-400`.
   - **Slide 6 — "Обери свій план"**: emoji ⭐, body: "Базові функції безкоштовні назавжди. Перейди на Basic або Pro щоб розблокувати AI-аналітику, необмежені записи та більше." Accent colour: `text-yellow-400`, `isFinal: true`.
2. THE final slide CTA SHALL read "Почати безкоштовно →" (not "⭐ Почати безкоштовно").
3. WHEN the user taps the final slide CTA or "Пропустити", THE App SHALL NOT immediately dismiss the onboarding. Instead, THE App SHALL show the Onboarding_Paywall full-screen overlay on top of the onboarding background.
4. THE Onboarding_Paywall SHALL be a full-screen overlay (not a bottom sheet) with:
   - A gradient background matching the final slide (`from-yellow-950 to-slate-950`).
   - A title "Обери свій план" (iOS_Large_Title, 28 px, bold, white).
   - Three compact plan cards (Free, Basic, Pro) stacked vertically, each showing: icon, name, price, and 3 key features.
   - The Basic card highlighted with a "Рекомендовано" badge.
   - A primary CTA "Перейти на Basic — 250 ⭐" that opens the Telegram Stars payment flow for `stars_basic`.
   - A secondary link "Продовжити безкоштовно →" (small, muted) that dismisses the paywall and enters the app.
5. WHEN the user completes or dismisses the Onboarding_Paywall, THE App SHALL set `localStorage.memo_onboarding_done = '1'` and navigate to the main app.
6. WHEN the user successfully pays during the Onboarding_Paywall, THE App SHALL show a brief success animation (CELEBRATION sound + confetti-style emoji burst) before entering the app.
7. THE Onboarding_Paywall SHALL NOT be shown again after `memo_onboarding_done` is set.
8. THE Onboarding slides SHALL display a small privacy badge on Slide 5: a `lock` icon (16 px, emerald) + "Зашифровано" text (11 px, emerald/60) in the bottom-left corner of the slide.

---

### Requirement 20: Usage Counters and Soft Limit Warnings

**User Story:** As a user, I want to see how close I am to my plan limits before I hit them, so that I can decide to upgrade proactively rather than being surprised.

#### Acceptance Criteria

1. THE Feed_Page SHALL display a Usage_Counter chip below the category filter bar when the user is on the Free_Tier and has used ≥ 70% of their entry limit. The chip SHALL read "N / 100 записів" with a warning amber colour and a `warning` icon.
2. THE Widgets_Page SHALL display a Usage_Counter chip in the header when the user is on the Free_Tier and has used ≥ 67% (2 of 3) of their widget limit. The chip SHALL read "N / 3 віджетів".
3. THE Insights_Page SHALL display a Usage_Counter chip in the header when the user is on the Free_Tier and has used ≥ 60% (3 of 5) of their report limit. The chip SHALL read "N / 5 звітів".
4. WHEN a Usage_Counter chip is tapped, THE App SHALL open the Paywall_Modal for the relevant feature.
5. THE Usage_Counter chip SHALL have a `bg-amber-400/10 border border-amber-400/30 text-amber-300` appearance and `min-h-[32px] px-3 rounded-full` shape (smaller than a full Chip since it is informational, not interactive in the primary sense).
6. THE App SHALL fetch the user's current usage counts from the API on page load and cache them in component state for the session.

---

### Requirement 21: Locked Feature Indicators

**User Story:** As a Free_Tier user, I want to see which features are locked and why, so that I understand what I'm missing without having to discover limits by hitting errors.

#### Acceptance Criteria

1. THE Insights_Page "+" button SHALL display a `lock` overlay icon (12 px, amber) in the bottom-right of the button when the user is on the Free_Tier, indicating that AI report generation requires an upgrade.
2. THE Widgets_Page "+" button SHALL display a `lock` overlay icon when the user is on the Free_Tier and has reached the widget limit (3 widgets).
3. THE Create_Widget_Sheet SHALL be blocked entirely for Free_Tier users — tapping the "+" button SHALL open the Paywall_Modal directly instead of the chip flow.
4. THE Feed_Page goal-tracking progress bars (Requirement 6) SHALL be hidden for Free_Tier users; instead, Goal_Entry cards SHALL show a locked state: a blurred/greyed progress bar area with a `lock` icon and "Доступно з Basic" caption.
5. THE Graph_Page SHALL show a "Доступно з Basic" overlay on the chart area for Free_Tier users, with a CTA button "Розблокувати" that opens the Paywall_Modal.
6. THE Settings_Page (or wherever recommendations are surfaced) SHALL show locked recommendation cards with a `lock` icon and "Доступно з Basic" for Free_Tier users.

---

### Requirement 22: Unit Economics and Pricing Rationale

*(Non-functional — documents the business logic behind the tier pricing for future reference.)*

**Pricing Model:**

- **1 Telegram Star ≈ $0.013 USD** (Telegram's current rate; Stars are sold in bundles, effective rate ~$0.013/star).
- **Basic — 250 Stars ≈ $3.25/month**: Targets daily journalers who want AI features. Comparable to a coffee. Break-even at ~77 paying users covering $250/month in AI API costs (GPT-4o-mini at ~$0.003/1K tokens, ~100K tokens/user/month = ~$0.30/user/month AI cost; 250 users × $0.30 = $75 AI cost, leaving $3.25 × 250 − $75 = $737.50 margin at 250 users).
- **Pro — 500 Stars ≈ $6.50/month**: Targets power users who want unlimited everything + priority processing. 2× Basic price for unlimited storage, export, and priority queue. At 100 Pro users: $650/month revenue, ~$60 AI cost (higher usage), $590 margin.
- **Conversion target**: 8–12% of active users convert to paid (industry benchmark for Telegram mini-apps: 5–15%). At 1 000 MAU: 80–120 paying users, ~60% Basic / 40% Pro mix → ~$390–$520/month.
- **Free tier limits are calibrated to**: (a) be genuinely useful for casual users (100 entries ≈ 3 months of daily journaling at 1 entry/day), (b) create natural upgrade pressure at the 30-day mark when history disappears, and (c) make the 5-report limit hit within the first month for active users (1 report/week = 4 reports in month 1).

#### Acceptance Criteria

1. THE `TIER_INFO` constant in `src/lib/stars/paywall.ts` SHALL be updated to reflect the new feature lists, limits, and descriptions defined in Requirement 16.
2. THE `FEATURE_TIERS` map SHALL be updated to include all gated features: `ai_reports`, `ai_recommendations`, `voice_logging`, `goal_tracking`, `custom_widgets`, `full_history`, `graph_full`, `data_export`, `priority_processing`.
3. THE `checkFeatureAccess` function SHALL support checking both feature flags (boolean gates) and count limits (numeric gates) via a unified interface.

---

### Requirement 23: Subscription Persistence and Expiry Handling

**User Story:** As a user, I want my subscription to be correctly reflected in the app at all times, including when it expires, so that I'm never confused about my current plan.

#### Acceptance Criteria

1. THE App SHALL check `subscription_ends_at` on every app launch (in the layout auth flow) and downgrade the local UI state to Free_Tier if the date has passed, even before the server confirms it.
2. THE API routes SHALL check `subscription_ends_at` server-side on every limit-checked request and treat expired subscriptions as Free_Tier regardless of `subscription_tier` column value.
3. WHEN a subscription expires, THE App SHALL show a one-time renewal banner on the next app open: "Твоя підписка Basic закінчилась. Поновити за 250 ⭐?" with a "Поновити" CTA and "Пізніше" dismiss. This banner SHALL appear above the Tab_Bar, below the page content, and SHALL be dismissible.
4. THE renewal banner SHALL NOT appear more than once per day (tracked via `localStorage.memo_renewal_banner_shown_date`).
5. THE Subscriptions_Page SHALL show a "Закінчується N днів" warning badge on the current plan card when `subscription_ends_at` is within 7 days.
