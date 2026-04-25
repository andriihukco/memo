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

