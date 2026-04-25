# Tasks — Mobile UX Overhaul v2

## Implementation Plan

Tasks are ordered so that shared primitives are built first, then page-level features that depend on them. Each task maps to one or more requirements from `requirements.md`.

---

- [x] 1. Build shared UI primitives
  - Create `src/components/ui/bottom-sheet.tsx` with animated slide-up/down panel, drag-to-dismiss (40% threshold), `bg-black/50 backdrop-blur-sm` backdrop, centred drag handle (40×4 px, `bg-muted rounded-full`), and safe-area-aware bottom padding (`calc(max(var(--bottom-inset, 0px), 16px) + 1rem)`)
  - Create `src/components/ui/chip.tsx` with `min-h-[44px] px-4 rounded-full` touch target, selected/unselected/disabled visual states, optional leading Material Symbols icon, and `SELECT` sound on click
  - Create `src/components/ui/skeleton.tsx` with shimmer animation and pre-built shapes: `SkeletonReportCard`, `SkeletonMetricCard`, `SkeletonEntryCard`
  - Add `@keyframes shimmer` and `.skeleton-shimmer` to `src/app/globals.css`
  - Create `src/components/ui/error-banner.tsx` with `bg-destructive/10 border-destructive/30` styling, `error` icon, Ukrainian message, "Повторити" retry button, `×` dismiss button, fade-out animation, `role="alert"` for accessibility
  - Create `src/components/ui/empty-state.tsx` with 48 px icon, Title heading, Body subtitle, optional full-width CTA button
  - Create `src/components/ui/confirm-sheet.tsx` using `BottomSheet`, destructive CTA, cancel button, `CAUTION` sound on open and confirm, `CLOSE` sound on cancel
  - Create `src/components/ui/progress-bar.tsx` with `h-1.5 rounded-full bg-muted` track, animated fill, `bg-green-400` when `completed` prop is true
  - **Requirements:** 7, 9, 10, 11, 12, 15

- [x] 2. Insights page — iOS-style layout and report cards
  - Replace the existing page header with iOS_Large_Title "Інсайти" (28 px bold) and Caption subtitle "Ретроспектива та аналіз"
  - Add a 40×40 px circular `+` button (top-right of header, `bg-primary`) that opens the new report sheet and plays `OPEN`
  - Implement month-group section headers (Caption, uppercase, `tracking-wide`, `text-muted-foreground`) with reports sorted newest-first within each group
  - Implement `ReportCard` with collapsed state (period label, date range, two-line truncated summary, `expand_more` chevron, delete icon button) and expanded state (retro sections with iOS_Section_Header labels and hairline dividers, chevron rotated 180°)
  - Apply `bg-surface-elevated rounded-2xl border border-border/50` card styling
  - Add `aria-expanded` to the expand toggle button
  - Replace the existing spinner with `SkeletonReportCard × 2` during loading
  - Implement `EmptyState` with icon `wb_incandescent`, title "Ще немає ретроспектив", subtitle "Проаналізуй свій прогрес за будь-який період", CTA "Створити першу ретроспективу"
  - **Requirements:** 1, 10, 13

- [x] 3. Insights page — New Report bottom sheet (iOS action-sheet style)
  - Replace `NewReportDrawer` with a new sheet built on `BottomSheet`
  - Render period options as full-width list rows (not a grid): each row has a leading icon, label, and trailing chevron/checkmark; rows: Сьогодні (`today`), 7 днів (`date_range`), Місяць (`calendar_month`), Свій діапазон (`tune`)
  - Implement inline date-range expansion: when "Свій діапазон" is selected, animate-height-expand two date inputs below a hairline divider without closing the sheet
  - Add full-width "Згенерувати ретроспективу" CTA button, disabled until a period is selected, with safe-area bottom padding
  - On CTA tap: close sheet, play `PROCESSING`, show existing rotating progress labels on the Insights page
  - On swipe-down or backdrop tap: close and play `CLOSE`
  - On generation failure: show `ErrorBanner` below the page title (not a modal)
  - **Requirements:** 2, 11

- [x] 4. Insights page — Report deletion confirmation
  - Replace the existing `DeleteSheet` with `ConfirmSheet` (title "Видалити ретроспективу?", subtitle "Цю дію не можна скасувати.", confirmLabel "Видалити")
  - On confirm: remove the report card with a fade-out + translateX(-20px) animation, play `CLOSE`
  - On cancel: close sheet, play `CLOSE`, leave card unchanged
  - **Requirements:** 3, 12

- [x] 5. Widgets page — Chip-based widget creation flow
  - Replace the free-text prompt in `CreateWidgetSheet` with a 3-step chip flow using the new `Chip` component
  - Step 1: display title "Що хочеш відстежувати?" and 8 category chips (Харчування `restaurant`, Активність `fitness_center`, Сон `bedtime`, Вода `water_drop`, Вага `scale`, Витрати `account_balance_wallet`, Настрій `sentiment_satisfied`, Кастомний `add_circle`); on chip tap play `SELECT` and slide to step 2
  - Step 2: display 2–3 pre-built question chips per category (per the spec table) plus "Свій варіант" chip; "Свій варіант" reveals an auto-focused text input (play `OPEN`); "← Назад" button returns to step 1 without losing category selection; "Далі" button enabled when a question is selected
  - Step 3: summary card with category icon + name + selected question; "← Змінити" link; "Створити віджет" CTA; on tap show spinner + "AI створює твій віджет...", call `/api/widgets`, on success play `CELEBRATION` and close after 1.2 s
  - Implement horizontal slide animation between steps (translateX transition on a flex container)
  - Show `ErrorBanner` inside the sheet on creation failure with retry
  - Wrap the sheet in `BottomSheet` with drag handle and `backdrop-blur-sm` backdrop
  - Add 3-dot step indicator at the top of the sheet
  - **Requirements:** 4, 11, 15

- [x] 6. Widgets page — Direct log entry from widget card
  - Change widget card `onClick` to open `LogEntrySheet` instead of `DrillDownDrawer`; play `OPEN` on open, `CLOSE` on close
  - Implement `LogEntrySheet` using `BottomSheet`: widget icon + title + unit header, large numeric input (`text-[24px]`, `autoFocus`, `inputMode="decimal"`), "Зберегти" CTA, "Переглянути записи" secondary link (opens `DrillDownDrawer`)
  - On save: POST to entries API, play `CELEBRATION`, close sheet, refresh widget value without full page reload
  - On failure: show `ErrorBanner` inside the sheet, do not close
  - **Requirements:** 5, 11

- [x] 7. Feed page — Log vs Goal visual distinction
  - Read `entry.metadata?.entry_type` (default `'log'` when absent/null)
  - Apply `border-l-4 border-primary/40` to Log_Entry cards and `border-l-4 border-amber-400` to Goal_Entry cards
  - Add "Ціль" badge (amber) before category badges on Goal_Entry cards
  - Add "Лог" badge (primary/blue) on Log_Entry cards that have `metadata.dashboard_metrics` with at least one metric
  - For Goal_Entry cards: render `ProgressBar` below entry content using `metadata.goal_metrics[0]` (target value); show "current / target unit · pct%" row; show `check_circle` icon in green when pct ≥ 100; render at 0% when no matching logged value
  - **Requirements:** 6

- [x] 8. Feed page — Skeleton loading and empty states
  - Replace the existing spinner with `SkeletonEntryCard × 4` during initial load
  - Replace the existing empty state with `EmptyState` (icon `contract`, title "Стрічка порожня", subtitle "Надішли повідомлення боту, щоб почати")
  - Add filtered empty state when a category filter is active and returns no results: `EmptyState` (icon `filter_list`, title "Немає записів у цій категорії", subtitle "Спробуй іншу категорію або зніми фільтр", CTA "Зняти фільтр" that calls `setFilter(null)`)
  - **Requirements:** 10, 13

- [x] 9. Feed page — Inline error banner and delete confirmation
  - Replace the existing inline error display with `ErrorBanner` positioned below the category filter bar; "Повторити" re-triggers `fetchEntries`; `×` dismisses; plays `BUTTON` on retry, `CLOSE` on dismiss
  - Replace the existing inline delete confirm (swipe-reveal "Так/Ні") with `ConfirmSheet` (title "Видалити запис?", subtitle "Цю дію не можна скасувати.", confirmLabel "Видалити"); on confirm play `CAUTION` then execute delete with fade-out animation
  - **Requirements:** 11, 12

- [x] 10. Widgets page — Skeleton loading and empty states
  - Replace the existing spinner with `SkeletonMetricCard × 4` (Metrics tab) and `SkeletonMetricCard × 4` (Goals tab) during loading
  - Replace the metrics empty state with `EmptyState` (icon `dashboard`, title "Немає даних за цей період", subtitle "Запиши активність, їжу або сон у боті", no CTA)
  - Replace the goals empty state with `EmptyState` (icon `my_location`, title "Цілей ще немає", subtitle "Скажи боту: «Хочу пробігти 100 км цього місяця»", no CTA)
  - **Requirements:** 10, 13

- [x] 11. Widgets page — Inline error banner and delete confirmation
  - Replace the existing error display with `ErrorBanner` below the tab bar; retry re-triggers the data fetch
  - Replace the existing widget delete confirm with `ConfirmSheet` (title "Видалити віджет?", subtitle "Цю дію не можна скасувати.", confirmLabel "Видалити")
  - Replace the metric delete confirm inside `MetricEditSheet` with `ConfirmSheet`
  - **Requirements:** 11, 12

- [x] 12. Standardise all existing bottom sheets
  - Migrate `EditDrawer` to use `BottomSheet` as its outer wrapper: update backdrop to `bg-black/50 backdrop-blur-sm`, ensure drag handle is the first child, verify safe-area bottom padding on the save button
  - Migrate `MetricEditSheet` to use `BottomSheet`: add drag handle, update backdrop, add `close` icon button (44×44 px) in top-right corner
  - Migrate `DrillDownDrawer` to use `BottomSheet`: add drag handle, add `close` icon button top-right
  - Migrate `CalendarSheet` to use `BottomSheet`: add drag handle, update backdrop
  - Verify all sheets play `OPEN` on open and `CLOSE` on close (any method)
  - Verify all CTA buttons are full-width, `min-h-[44px]`, last interactive element before bottom padding
  - **Requirements:** 7, 9, 15

- [x] 13. Back navigation on sub-pages
  - In `src/app/miniapp/layout.tsx`, detect when the current pathname is not a root tab destination (`/miniapp`, `/miniapp/dashboard`, `/miniapp/graph`, `/miniapp/reports`)
  - Render a `arrow_back` icon button (44×44 px, top-left) on sub-pages that calls `router.back()` and plays `SLIDE`
  - Add the back button to `/miniapp/subscriptions` and `/miniapp/onboarding` (when accessed as a standalone page)
  - Verify multi-step sheets (CreateWidgetSheet steps 2–3) show "← Назад" text button instead of a close button
  - **Requirements:** 14

- [x] 14. Typography scale audit and polish
  - Audit all new and modified components to ensure they use only the five defined sizes: 28 px (iOS_Large_Title), 17 px (Title), 15 px (Body), 13 px (Caption), 11 px (Footnote)
  - Apply `font-semibold` to all Bottom_Sheet titles and card primary labels
  - Apply `text-muted-foreground` to all Caption and Footnote text
  - Fix any existing page headings on Feed and Widgets pages to use iOS_Large_Title (28 px bold) if they are root tab destinations
  - **Requirements:** 8

- [x] 15. Touch target audit
  - Audit all interactive elements introduced or modified by this spec
  - Ensure every button, chip, tab, icon button, and link has `min-h-[44px] min-w-[44px]` or equivalent padding
  - Ensure drag handle areas have a 44 px tall touch zone wrapping the 4 px visual handle
  - Ensure period rows in `NewReportSheet` have `min-h-[44px]`
  - **Requirements:** 9


- [x] 16. Update tier definitions and paywall library
  - In `src/lib/stars/paywall.ts`: expand `TierInfo` interface to include `limits: { entries, widgets, reports, historyDays }` and `features: { label, included }[]`
  - Update `TIER_INFO` for all three tiers with the new limits (Free: 100 entries / 3 widgets / 5 reports / 30 days; Basic: 2000 / 15 / 50 / 365; Pro: Infinity) and full 14-feature lists with `included` booleans
  - Update `FEATURE_TIERS` to include all gated features: `ai_reports`, `ai_recommendations`, `voice_logging`, `goal_tracking`, `custom_widgets`, `full_history`, `graph_full`, `data_export`, `priority_processing`
  - Add a `getEffectiveTier(userId)` helper that checks `subscription_ends_at` and returns `"free"` if expired, regardless of the stored `subscription_tier`
  - Add a `getUserUsageCounts(userId)` helper that returns `{ entries: number, widgets: number, reports: number }` using the service-role client
  - **Requirements:** 16, 22

- [x] 17. Server-side limit enforcement in API routes
  - In `/api/entries` POST: call `getEffectiveTier`, check entry count against `TIER_INFO[tier].limits.entries`, return HTTP 402 with `{ error: "limit_exceeded", feature: "entries", limit, current, required_tier }` if exceeded
  - In `/api/entries` GET: apply history filter — `created_at >= now() - historyDays * 86400s` — based on effective tier; Pro gets no filter
  - In `/api/widgets` POST: check widget count against `TIER_INFO[tier].limits.widgets`, return 402 if exceeded; also check `custom_widgets` feature gate and return 402 with `feature: "custom_widgets"` for Free tier
  - In `/api/reports` POST: check report count against `TIER_INFO[tier].limits.reports`, return 402 if exceeded; also check `ai_reports` feature gate for Free tier
  - Add a new Supabase migration `supabase/migrations/20240001000013_tier_limits.sql` with a `get_user_usage_counts(p_user_id UUID)` function returning `(entries_count INT, widgets_count INT, reports_count INT)`
  - **Requirements:** 16

- [x] 18. Build PaywallModal component
  - Create `src/components/ui/paywall-modal.tsx` using `BottomSheet`
  - Accept props: `open`, `onClose`, `feature` (string key), `current?` (number), `limit?` (number), `requiredTier` (`SubscriptionTier`)
  - Implement `PAYWALL_COPY` map with feature-specific icon, title, and subtitle function for all 9 gated features plus `entries`, `widgets`, `reports` count limits
  - Render: feature icon (48 px, amber/primary), title, subtitle with usage numbers, feature comparison row ("Basic: N · Pro: необмежено"), primary CTA ("Перейти на Basic — 250 ⭐" or Pro), ghost "Не зараз" button
  - Primary CTA navigates to `/miniapp/subscriptions` and plays `OPEN`; "Не зараз" closes and plays `CLOSE`; sheet open plays `CAUTION`
  - **Requirements:** 17

- [x] 19. Wire PaywallModal into pages on 402 responses
  - In `src/app/miniapp/reports/page.tsx`: catch 402 from `/api/reports` POST, extract `feature` and `current`/`limit` from response body, open `PaywallModal` with correct props instead of showing an error banner
  - In `src/app/miniapp/dashboard/page.tsx`: catch 402 from `/api/widgets` POST, open `PaywallModal`; also intercept the "+" button tap for Free tier users and open `PaywallModal` with `feature: "custom_widgets"` before any API call
  - In `src/app/miniapp/page.tsx`: catch 402 from `/api/entries` (if surfaced via bot), open `PaywallModal`
  - **Requirements:** 17

- [x] 20. Usage counters and soft limit warnings
  - Create a `useUsageCounts()` hook that fetches `GET /api/profile/usage` (new endpoint) returning `{ entries, widgets, reports }` and caches in component state
  - Add `GET /api/profile/usage` route that calls `getUserUsageCounts(userId)` and returns the counts
  - In `src/app/miniapp/reports/page.tsx`: show `UsageCounterChip` ("N / 5 звітів") in the header when Free tier and usage ≥ 3 (60%); chip tap opens `PaywallModal`
  - In `src/app/miniapp/dashboard/page.tsx`: show `UsageCounterChip` ("N / 3 віджетів") when Free tier and usage ≥ 2 (67%)
  - In `src/app/miniapp/page.tsx`: show `UsageCounterChip` ("N / 100 записів") when Free tier and usage ≥ 70
  - Implement `UsageCounterChip` as a small inline component: `bg-amber-400/10 border-amber-400/30 text-amber-300 rounded-full px-3 min-h-[32px]`, `warning` icon, tappable
  - **Requirements:** 20

- [x] 21. Locked feature indicators
  - In `src/app/miniapp/reports/page.tsx`: add lock overlay badge (amber, 16×16 px, `lock` icon 10 px) on the "+" button for Free tier users
  - In `src/app/miniapp/dashboard/page.tsx`: add lock overlay badge on the "+" button when Free tier and widget count ≥ 3
  - In `src/app/miniapp/page.tsx`: for Free tier users, replace Goal_Entry progress bars with a locked state (blurred bar + `lock` icon + "Доступно з Basic" caption at 11 px muted)
  - In `src/app/miniapp/graph/page.tsx`: add a full-chart overlay for Free tier users showing "Доступно з Basic" with a `lock` icon (48 px, muted) and a "Розблокувати" CTA button that opens `PaywallModal` with `feature: "graph_full"`
  - **Requirements:** 21

- [x] 22. Enhanced onboarding — 6 slides with privacy slide
  - Update the `SLIDES` array in both `src/app/miniapp/layout.tsx` (OnboardingOverlay) and `src/app/miniapp/onboarding/page.tsx` to 6 slides: add Slide 5 "Твої дані захищені" (emoji 🔐, `from-emerald-950`, `text-emerald-400`, `showPrivacyBadge: true`) between the recommendations slide and the final plan slide
  - Update Slide 6 (final) CTA text from "⭐ Почати безкоштовно" to "Почати безкоштовно →"
  - Add the privacy badge render on Slide 5: `lock` icon (16 px, `text-emerald-400/60`) + "Зашифровано" text (11 px) in the bottom-left corner of the slide content area
  - Update dot indicators to show 6 dots
  - **Requirements:** 19

- [x] 23. Onboarding Paywall full-screen overlay
  - In `src/app/miniapp/layout.tsx` `OnboardingOverlay`: add `showPaywall` state; when the user taps the final slide CTA or "Пропустити", set `showPaywall(true)` instead of calling `finish()` directly
  - Implement `OnboardingPaywall` component (inline in layout.tsx or extracted to a sibling file): full-screen overlay `z-[101]`, `from-yellow-950 to-slate-950` gradient, slide-up animation (300 ms ease-out)
  - Render three compact `PlanCard` components (Free, Basic with "Рекомендовано" badge, Pro) each showing emoji, name, price, and 3 key features
  - Primary CTA: "Перейти на Basic — 250 ⭐" — calls `handleSubscribe('stars_basic')` using the existing Telegram Stars invoice flow
  - Secondary link: "Продовжити безкоштовно →" — calls `finish()` (sets `memo_onboarding_done`, dismisses onboarding)
  - On successful payment: play `CELEBRATION`, show a confetti emoji burst (8 ⭐ emojis animate outward from center using CSS keyframes), then call `finish()` after 1.5 s
  - On payment cancel or failure: stay on the paywall (do not dismiss)
  - **Requirements:** 19

- [x] 24. Subscriptions page full redesign
  - Replace the existing subscriptions page layout with the new design: iOS_Large_Title header with back button, CurrentPlanBanner, UsageSection (for non-Pro users), three full PlanCards, footer note
  - Implement `UsageSection`: fetch usage counts via `useUsageCounts()`, render three `UsageRow` items (Записи, Віджети, Звіти) each with label, "N / limit" text, and a 64 px wide mini progress bar
  - Implement full `PlanCard` with all 14 feature rows (✓ green / ✗ muted), "Найпопулярніший" badge on Basic, gold gradient CTA on Pro
  - Add expiry warning badge on the CurrentPlanBanner when `subscription_ends_at` is within 7 days: "Закінчується через N днів" in amber
  - Keep the existing `handleSubscribe` payment flow unchanged; update success/error display to use `ErrorBanner` component
  - **Requirements:** 18

- [x] 25. Subscription expiry handling and renewal banner
  - In `src/app/miniapp/layout.tsx` `MiniAppContent`: after auth succeeds and profile is loaded, check if `subscription_ends_at < now()` and `subscription_tier !== 'free'`; if so, and if `localStorage.memo_renewal_banner_shown_date !== today`, show the renewal banner
  - Implement the renewal banner as a fixed element above the tab bar: amber styling, tier name, "Поновити" CTA (navigates to `/miniapp/subscriptions`), `×` dismiss button
  - On dismiss: set `localStorage.memo_renewal_banner_shown_date = today's ISO date string`
  - In all limit-checked API routes: treat `subscription_ends_at < now()` as `tier = "free"` regardless of the stored column value (use `getEffectiveTier` helper from Task 16)
  - **Requirements:** 23
