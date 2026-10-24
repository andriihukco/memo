# File Split Refactoring Plan

This document outlines the strategy for splitting all files exceeding the 200-line limit into modular, maintainable components.

---

## Priority 1: Critical Files (>1,000 lines)

### 1. `src/app/miniapp/dashboard/page.tsx` (2,046 lines)

**Split Strategy:**

1. **Extract constants** → `src/components/features/dashboard/dashboard-constants.ts` ✅ DONE
   - EMOJI_LIBRARY
   - ICON_COLORS
   - METRIC_EMOJI
   - METRIC_ICON_MAP

2. **Extract types** → `src/components/features/dashboard/dashboard-types.ts` ✅ DONE
   - DateRange, DateFilter
   - GoalMetricAgg
   - CustomWidget
   - MeasureOption
   - Helper functions (rangeFor, fmtDate, isoDate, getRangeLabels)

3. **Extract helpers** → `src/components/features/dashboard/dashboard-helpers.ts` ✅ DONE
   - getIconColor
   - aggregateGoals
   - metricEmoji

4. **Extract CreateWidgetSheet** → `src/components/features/dashboard/create-widget-sheet.tsx` (~400 lines)
   - Complete widget creation flow
   - Step 0, 1, 2 logic
   - Icon picker, color picker

5. **Extract MetricCard** → `src/components/features/dashboard/metric-card.tsx` (~150 lines)
   - Individual metric display
   - Progress bar
   - Goal tracking

6. **Extract DateFilterBar** → `src/components/features/dashboard/date-filter-bar.tsx` (~100 lines)
   - Date range selector
   - Custom date picker

7. **Extract WidgetGrid** → `src/components/features/dashboard/widget-grid.tsx` (~200 lines)
   - Grid layout for widgets
   - Staggered animations

8. **Main page** → `src/app/miniapp/dashboard/page.tsx` (~300 lines)
   - Orchestration
   - Data fetching
   - State management

---

### 2. `src/app/miniapp/graph/page.tsx` (1,422 lines)

**Split Strategy:**

1. **Extract D3 graph logic** → `src/components/features/graph/graph-simulation.ts` (~300 lines)
   - Force simulation setup
   - Node/link creation
   - Zoom behavior

2. **Extract NodeDetailPanel** → `src/components/features/graph/node-detail-panel.tsx` (~200 lines)
   - Bottom sheet for node details
   - Linked entries display

3. **Extract DateFilterSheet** → `src/components/features/graph/date-filter-sheet.tsx` (~150 lines)
   - Date range picker
   - Paywall integration

4. **Extract GraphControls** → `src/components/features/graph/graph-controls.tsx` (~100 lines)
   - Zoom controls
   - Filter toggles

5. **Main page** → `src/app/miniapp/graph/page.tsx` (~400 lines)
   - Orchestration
   - Data fetching
   - Canvas rendering

---

### 3. `src/app/miniapp/reports/page.tsx` (1,270 lines)

**Split Strategy:**

1. **Extract ReportCharts** → `src/components/features/reports/report-charts.tsx` (~400 lines)
   - ActivityHeatmap
   - CategoryBreakdown
   - MetricHighlights
   - MoodSparkline
   - VolumeChart
   - HourlyChart
   - WeekdayPattern

2. **Extract StreakCard** → `src/components/features/reports/streak-card.tsx` (~100 lines)
   - Current streak
   - Longest streak
   - Consistency %

3. **Extract NewReportSheet** → `src/components/features/reports/new-report-sheet.tsx` (~150 lines)
   - Period picker
   - Report generation

4. **Extract ReportDetail** → `src/components/features/reports/report-detail.tsx` (~200 lines)
   - Full report view
   - Stats overlay

5. **Extract MarkdownText** → `src/components/features/reports/markdown-text.tsx` (~100 lines)
   - Custom markdown renderer

6. **Main page** → `src/app/miniapp/reports/page.tsx` (~300 lines)
   - Orchestration
   - Data fetching
   - Navigation

---

### 4. `src/app/miniapp/layout.tsx` (1,252 lines)

**Split Strategy:**

1. **Extract OnboardingSlides** → `src/components/features/onboarding/onboarding-slides.tsx` (~200 lines)
   - Slide definitions
   - Slide navigation
   - Progress indicator

2. **Extract OnboardingPaywall** → `src/components/features/onboarding/onboarding-paywall.tsx` (~200 lines)
   - Paywall UI
   - Subscription flow
   - Trial activation

3. **Extract OnboardingPasscode** → `src/components/features/onboarding/onboarding-passcode.tsx` (~150 lines)
   - Passcode setup flow
   - Confirmation steps

4. **Extract OnboardingLanguagePicker** → `src/components/features/onboarding/onboarding-language-picker.tsx` (~100 lines)
   - Language selection
   - Locale persistence

5. **Extract MiniappTabBar** → `src/components/features/layout/miniapp-tab-bar.tsx` (~150 lines)
   - Tab navigation
   - Active state
   - Glassmorphism

6. **Main layout** → `src/app/miniapp/layout.tsx` (~300 lines)
   - Provider setup
   - Auth flow
   - Route protection

---

### 5. `src/app/miniapp/settings/page.tsx` (1,209 lines)

**Split Strategy:**

1. **Extract SettingsSection** → `src/components/features/settings/settings-section.tsx` (~100 lines)
   - Reusable section component
   - Section header
   - Divider

2. **Extract SettingsRow** → `src/components/features/settings/settings-row.tsx` (~80 lines)
   - Individual setting row
   - Icon, label, value
   - Tap handling

3. **Extract CategoryManager** → `src/components/features/settings/category-manager.tsx` (~200 lines)
   - Category list
   - Edit/delete
   - Color picker

4. **Extract ProfileSettings** → `src/components/features/settings/profile-settings.tsx` (~150 lines)
   - Profile info
   - Username edit
   - Settings toggles

5. **Extract SubscriptionSettings** → `src/components/features/settings/subscription-settings.tsx` (~150 lines)
   - Current plan
   - Billing history
   - Cancel flow

6. **Extract DataExport** → `src/components/features/settings/data-export.tsx` (~100 lines)
   - Export options
   - Download handler

7. **Extract AccountDangerZone** → `src/components/features/settings/account-danger-zone.tsx` (~100 lines)
   - Delete account
   - Data removal

8. **Main page** → `src/app/miniapp/settings/page.tsx` (~200 lines)
   - Orchestration
   - Section organization

---

## Priority 2: High Priority Files (500-1,000 lines)

### 6. `src/app/miniapp/page.tsx` (957 lines)

**Split Strategy:**

1. **Extract EntryList** → `src/components/features/feed/entry-list.tsx` (~300 lines)
   - Entry cards
   - Swipe gestures
   - Thread grouping

2. **Extract CategoryFilterBar** → `src/components/features/feed/category-filter-bar.tsx` (~100 lines)
   - Category chips
   - Filter logic

3. **Extract CreateEntrySheet** → `src/components/features/feed/create-entry-sheet.tsx` (~200 lines)
   - Quick entry creation
   - Category selection

4. **Main page** → `src/app/miniapp/page.tsx` (~300 lines)
   - Orchestration
   - Data fetching

---

### 7. `src/lib/processing/loop.ts` (775 lines)

**Split Strategy:**

1. **Extract union-find logic** → `src/lib/processing/union-find.ts` (~100 lines)
   - find()
   - union()
   - path compression

2. **Extract similarity logic** → `src/lib/processing/similarity-graph.ts` (~150 lines)
   - Adjacency building
   - Edge creation
   - Threshold logic

3. **Extract cluster assignment** → `src/lib/processing/cluster-assignment.ts` (~100 lines)
   - Branch ID assignment
   - Stability handling

4. **Main function** → `src/lib/processing/loop.ts` (~300 lines)
   - Orchestration
   - Data fetching
   - Error handling

---

### 8. `src/components/ui/edit-drawer.tsx` (742 lines)

**Split Strategy:**

1. **Extract icon library** → `src/components/ui/edit-drawer-icons.ts` (~100 lines)
   - ICON_LIBRARY
   - getIconName

2. **Extract color palette** → `src/components/ui/edit-drawer-colors.ts` (~100 lines)
   - COLOR_PALETTE
   - color helpers

3. **Extract category picker** → `src/components/ui/category-picker.tsx` (~150 lines)
   - Horizontal scroll
   - Category chips
   - Selection logic

4. **Extract emoji picker** → `src/components/ui/emoji-picker.tsx` (~100 lines)
   - Emoji grid
   - Selection

5. **Main drawer** → `src/components/ui/edit-drawer.tsx` (~200 lines)
   - Layout
   - Save/delete logic
   - Keyboard handling

---

### 9. `src/app/miniapp/subscriptions/page.tsx` (655 lines)

**Split Strategy:**

1. **Extract PlanCard** → `src/components/features/subscriptions/plan-card.tsx` (~150 lines)
   - Plan display
   - Features list
   - Selection highlight

2. **Extract BillingPeriodSelector** → `src/components/features/subscriptions/billing-period-selector.tsx` (~100 lines)
   - Period toggle
   - Discount badges

3. **Extract PaymentHandler** → `src/components/features/subscriptions/payment-handler.tsx` (~150 lines)
   - Telegram invoice
   - Web fallback
   - Success/error handling

4. **Main page** → `src/app/miniapp/subscriptions/page.tsx` (~200 lines)
   - Orchestration
   - Trial logic

---

### 10. `src/lib/bot/commands.ts` (515 lines)

**Split Strategy:**

1. **Extract report commands** → `src/lib/bot/commands/reports.ts` (~100 lines)
   - handleReport, handleReportDaily, etc.

2. **Extract utility commands** → `src/lib/bot/commands/utility.ts` (~100 lines)
   - handleHelp, handleStats, handleInvite, etc.

3. **Extract recommendation commands** → `src/lib/bot/commands/recommendations.ts` (~100 lines)
   - handleRecommendations, handleRemind

4. **Extract subscription commands** → `src/lib/bot/commands/subscription.ts` (~100 lines)
   - handleCancel, handleLanguage

5. **Main exports** → `src/lib/bot/commands.ts` (~100 lines)
   - Re-export all handlers

---

### 11. `src/lib/bot/qa.ts` (513 lines)

**Split Strategy:**

1. **Extract RAG logic** → `src/lib/bot/qa/rag.ts` (~150 lines)
   - Context retrieval
   - Embedding search
   - Prompt construction

2. **Extract answer generation** → `src/lib/bot/qa/generation.ts` (~150 lines)
   - LLM call
   - Response parsing
   - Error handling

3. **Main function** → `src/lib/bot/qa.ts` (~150 lines)
   - Orchestration
   - Fallback logic

---

## Priority 3: Medium Priority Files (400-500 lines)

### 12. `src/lib/classifier.ts` (438 lines)

**Split Strategy:**

1. **Extract BUILTIN_CATEGORIES** → `src/lib/classifier/categories.ts` (~100 lines)
   - Category definitions
   - Color mappings

2. **Extract classification logic** → `src/lib/classifier/classify.ts` (~200 lines)
   - Text classification
   - Category matching
   - Metric extraction

3. **Extract audio classification** → `src/lib/classifier/audio.ts` (~100 lines)
   - Transcription
   - Audio-specific logic

4. **Main exports** → `src/lib/classifier.ts` (~50 lines)
   - Re-export functions

---

### 13. `src/components/ui/paywall-modal.tsx` (439 lines)

**Split Strategy:**

1. **Extract PlanSelector** → `src/components/ui/paywall-plan-selector.tsx` (~150 lines)
   - Plan tabs
   - Feature comparison

2. **Extract BillingToggle** → `src/components/ui/paywall-billing-toggle.tsx` (~100 lines)
   - Period switcher
   - Price calculation

3. **Main modal** → `src/components/ui/paywall-modal.tsx` (~150 lines)
   - Layout
   - Integration

---

### 14. `src/lib/processing/widgets.ts` (434 lines)

**Split Strategy:**

1. **Extract widget creation** → `src/lib/processing/widget-creation.ts` (~150 lines)
   - AI prompt
   - Widget generation
   - Validation

2. **Extract widget data** → `src/lib/processing/widget-data.ts` (~150 lines)
   - Data fetching
   - Aggregation
   - Formatting

3. **Main exports** → `src/lib/processing/widgets.ts` (~100 lines)
   - Orchestration

---

### 15. `src/lib/processing/notifications.ts` (432 lines)

**Split Strategy:**

1. **Extract notification logic** → `src/lib/processing/notification-logic.ts` (~200 lines)
   - Notification types
   - Scheduling
   - Template rendering

2. **Extract notification handlers** → `src/lib/processing/notification-handlers.ts` (~150 lines)
   - Telegram sending
   - Error handling

3. **Main exports** → `src/lib/processing/notifications.ts` (~50 lines)
   - Orchestration

---

### 16. `src/lib/bot/handlers/text.ts` (411 lines)

**Split Strategy:**

1. **Extract question handling** → `src/lib/bot/handlers/text-question.ts` (~100 lines)
   - Question detection
   - Answer generation

2. **Extract action handling** → `src/lib/bot/handlers/text-action.ts` (~100 lines)
   - Action detection
   - Execution

3. **Extract entry saving** → `src/lib/bot/handlers/text-entry.ts` (~100 lines)
   - Entry creation
   - Metadata handling

4. **Main handler** → `src/lib/bot/handlers/text.ts` (~100 lines)
   - Orchestration
   - Routing

---

## Priority 4: Low Priority Files (200-400 lines)

### 17. `src/app/api/telegram/webhook/route.ts` (342 lines)

**Split Strategy:**

1. **Extract referral logic** → `src/lib/bot/webhook/referral.ts` (~100 lines)
   - handleStartWithReferral
   - processReferralReward

2. **Extract payment logic** → `src/lib/bot/webhook/payment.ts` (~100 lines)
   - Pre-checkout
   - Successful payment

3. **Main route** → `src/app/api/telegram/webhook/route.ts` (~150 lines)
   - Bot setup
   - Middleware
   - Routing

---

### 18. `src/app/api/auth/telegram/route.ts` (343 lines)

**Split Strategy:**

1. **Extract verification logic** → `src/lib/auth/telegram-verification.ts` (~150 lines)
   - verifyInitData
   - Timing-safe comparison
   - User lookup

2. **Main route** → `src/app/api/auth/telegram/route.ts` (~200 lines)
   - Route handler
   - Response formatting

---

### 19. `src/components/ui/splash-screen.tsx` (343 lines)

**Split Strategy:**

1. **Extract logo animation** → `src/components/ui/splash-logo.tsx` (~100 lines)
   - Logo component
   - Animation

2. **Main screen** → `src/components/ui/splash-screen.tsx` (~200 lines)
   - Layout
   - Loading state

---

### 20. `src/components/ui/ios-action-sheet.tsx` (257 lines)

**Split Strategy:**

1. **Extract action item** → `src/components/ui/action-sheet-item.tsx` (~80 lines)
   - Individual action
   - Destructive styling

2. **Main sheet** → `src/components/ui/ios-action-sheet.tsx` (~150 lines)
   - Layout
   - Animation

---

### 21. `src/components/ui/passcode-screen.tsx` (201 lines)

**Split Strategy:**

1. **Extract keypad** → `src/components/ui/passcode-keypad.tsx` (~80 lines)
   - Numeric grid
   - Button styling

2. **Extract dots** → `src/components/ui/passcode-dots.tsx` (~50 lines)
   - Progress indicator
   - Animation

3. **Main screen** → `src/components/ui/passcode-screen.tsx` (~100 lines)
   - Layout
   - Validation

---

## Execution Order

1. **Phase 1:** Dashboard, Graph, Reports, Layout, Settings (5 largest files)
2. **Phase 2:** Feed page, processing loop, edit-drawer, subscriptions, bot commands (5 high priority)
3. **Phase 3:** Bot QA, classifier, paywall-modal, widgets, notifications (5 medium priority)
4. **Phase 4:** Webhook, auth route, splash-screen, action-sheet, passcode-screen (5 low priority)

## Testing Checklist After Each Split

- [ ] Component renders without errors
- [ ] All imports resolve correctly
- [ ] TypeScript compiles without errors
- [ ] Functionality preserved (manual test)
- [ ] No console errors
- [ ] File is < 200 lines
- [ ] Extracted file is < 200 lines
