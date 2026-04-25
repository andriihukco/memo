# Design Document — Mobile UX Overhaul v2

## Overview

This document describes the technical design for the Mobile UX Overhaul v2 of the Memo Telegram Mini App. The overhaul touches four pages (Feed, Widgets/Dashboard, Insights/Reports, Layout) and introduces a set of shared primitives (BottomSheet, Chip, SkeletonCard, ErrorBanner, EmptyState, ConfirmSheet) that unify the interaction model across the app.

The implementation builds entirely on the existing stack: Next.js 14 App Router, Tailwind CSS, the `snd-lib` sound system, Material Symbols Rounded icons, and the Supabase/Telegram auth layer. No new dependencies are introduced.

---

## Architecture

### Shared Component Layer

All new primitives live in `src/components/ui/`. They are pure presentational components with no data-fetching logic.

```
src/components/ui/
  bottom-sheet.tsx        ← universal animated bottom sheet
  chip.tsx                ← selectable pill button
  skeleton.tsx            ← shimmer placeholder shapes
  error-banner.tsx        ← inline dismissible error
  empty-state.tsx         ← standardised empty state
  confirm-sheet.tsx       ← destructive action confirmation sheet
  progress-bar.tsx        ← horizontal progress indicator
```

Page-level sheets that are too large or too domain-specific to be generic stay co-located with their page (e.g. `NewReportSheet` inside the reports page file, or extracted to a sibling file).

### State Management

All pages continue to use local `useState` / `useCallback` / `useRef` — no global state library is introduced. The new sheets receive their open/close state and callbacks as props from the parent page.

### Sound Integration

Every interactive event calls `useSound().play(event)` using the existing 15-event vocabulary:

| Trigger | Sound |
|---|---|
| Sheet opens | `OPEN` |
| Sheet closes (any method) | `CLOSE` |
| Chip / option selected | `SELECT` |
| Destructive sheet opens | `CAUTION` |
| Destructive action confirmed | `CAUTION` |
| Report generation starts | `PROCESSING` |
| Widget / entry saved successfully | `CELEBRATION` |
| Error retry tapped | `BUTTON` |
| Back navigation | `SLIDE` |

---

## Design Tokens (Existing — Referenced Throughout)

| Token | Value | Usage |
|---|---|---|
| `--background` | `hsl(222 47% 6%)` | Page background |
| `--card` | `hsl(217 33% 12%)` | Card surface |
| `--surface-elevated` | `hsl(217 33% 14%)` | Elevated sheet surface |
| `--primary` | `hsl(217 91% 60%)` | Primary actions, accents |
| `--muted` | `hsl(217 33% 17%)` | Muted backgrounds |
| `--muted-foreground` | `hsl(215 20% 65%)` | Secondary text |
| `--destructive` | `hsl(0 72% 51%)` | Destructive actions |
| `--border` | `hsl(217 33% 20%)` | Borders |
| `--bottom-inset` | CSS var from Telegram | Safe area bottom |
| `--tab-bar-h` | CSS var from layout | Tab bar height |

---

## Typography Scale

Applied via Tailwind utility classes. No new font sizes are added to `tailwind.config.ts` — the scale maps to existing Tailwind sizes.

| Role | Size | Weight | Tailwind |
|---|---|---|---|
| iOS_Large_Title | 28 px | 700 | `text-[28px] font-bold` |
| Title | 17 px | 600 | `text-[17px] font-semibold` |
| Body | 15 px | 400 | `text-[15px] font-normal` |
| Caption | 13 px | 400 | `text-[13px] font-normal text-muted-foreground` |
| Footnote | 11 px | 400 | `text-[11px] font-normal text-muted-foreground` |

---

## Shared Primitives

### 1. BottomSheet (`src/components/ui/bottom-sheet.tsx`)

**Purpose:** Replace the ad-hoc sheet implementations in EditDrawer, NewReportDrawer, CreateWidgetSheet, etc. with a single animated primitive.

**Props:**
```ts
interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}
```

**Anatomy:**
```
fixed inset-0 z-50
  └── backdrop: bg-black/50 backdrop-blur-sm  (fade in/out 200ms)
  └── panel: fixed bottom-0 left-0 right-0
        rounded-t-2xl bg-surface-elevated shadow-drawer
        translate-y animation: 0→100% on close, 100%→0 on open
        └── drag handle: mx-auto mt-3 h-1 w-10 rounded-full bg-muted
        └── children
        └── bottom padding: calc(max(var(--bottom-inset, 0px), 16px) + 1rem)
```

**Animation:**
- Open: `translateY(100%) → translateY(0)` over 300 ms, `cubic-bezier(0.16, 1, 0.3, 1)` (spring-like ease-out)
- Close: `translateY(0) → translateY(100%)` over 250 ms, `ease-in`
- Backdrop: `opacity 0 → 0.5` over 200 ms on open, reverse on close
- Implemented with CSS transitions on a `data-state` attribute (`open` / `closed`), toggled after a `requestAnimationFrame` to allow the enter animation to play

**Drag-to-dismiss:**
- `onTouchStart` / `onTouchMove` / `onTouchEnd` on the panel
- Track `deltaY`; if `deltaY > panelHeight * 0.4` on release → commit close
- During drag: `transform: translateY(${Math.max(0, deltaY)}px)` with `transition: none`
- On release below threshold: spring back with `transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1)`

**Backdrop tap:** `onClick` on backdrop div calls `onClose`.

**Sound:** Parent is responsible for calling `play('OPEN')` / `play('CLOSE')` at the appropriate moment (when `open` changes).

**Existing sheets to migrate:** NewReportDrawer, DeleteSheet (reports), CreateWidgetSheet, MetricEditSheet, DrillDownDrawer, CalendarSheet, EditDrawer, DeleteConfirmDialog (feed). Migration is done incrementally per task.

---

### 2. Chip (`src/components/ui/chip.tsx`)

**Purpose:** Selectable pill button for category and option selection.

**Props:**
```ts
interface ChipProps {
  label: string
  icon?: string          // Material Symbols name
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
  className?: string
}
```

**Anatomy:**
```
button
  min-h-[44px] min-w-[44px] px-4
  rounded-full border
  flex items-center gap-2
  text-[15px] font-normal
  transition: background, border-color, color 150ms ease
  
  unselected: bg-muted/40 border-border/50 text-foreground
  selected:   bg-primary/15 border-primary text-primary
  disabled:   opacity-40 cursor-not-allowed
```

**Icon:** `<Icon name={icon} size={18} />` rendered before the label when provided.

---

### 3. Skeleton (`src/components/ui/skeleton.tsx`)

**Purpose:** Shimmer placeholder for loading states.

**Props:**
```ts
interface SkeletonProps {
  className?: string   // width, height, border-radius
}
```

**Implementation:**
```tsx
// Base skeleton block
<div className={cn(
  "animate-pulse rounded-xl bg-muted/60",
  className
)} />
```

**Shimmer keyframe** (added to `globals.css`):
```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    hsl(var(--muted) / 0.6) 25%,
    hsl(var(--muted) / 0.9) 50%,
    hsl(var(--muted) / 0.6) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

**Pre-built skeleton shapes:**
- `SkeletonReportCard` — 80px tall rounded-xl block
- `SkeletonMetricCard` — 96px tall rounded-xl block
- `SkeletonEntryCard` — 72px tall rounded-xl block

---

### 4. ErrorBanner (`src/components/ui/error-banner.tsx`)

**Purpose:** Inline dismissible error message.

**Props:**
```ts
interface ErrorBannerProps {
  message: string
  onRetry?: () => void
  onDismiss: () => void
}
```

**Anatomy:**
```
div: bg-destructive/10 border border-destructive/30 rounded-xl
     px-4 py-3 flex items-center gap-3
  └── Icon "error" size=16 text-destructive
  └── p: text-[15px] text-destructive flex-1
  └── button "Повторити": text-[13px] text-destructive font-semibold (if onRetry)
  └── button "×": Icon "close" size=16 text-destructive min-h-[44px] min-w-[44px]
```

**Animation:** fade-out on dismiss (`opacity 0` over 200 ms, then `display: none`).

---

### 5. EmptyState (`src/components/ui/empty-state.tsx`)

**Props:**
```ts
interface EmptyStateProps {
  icon: string           // Material Symbols name
  title: string
  subtitle: string
  ctaLabel?: string
  onCta?: () => void
}
```

**Anatomy:**
```
div: flex flex-col items-center justify-center gap-4 py-16 px-6 text-center
  └── Icon: size=48 text-muted-foreground/40
  └── h3: text-[17px] font-semibold text-muted-foreground
  └── p: text-[15px] text-muted-foreground/70
  └── Button (if ctaLabel): full-width, primary variant, min-h-[44px]
```

---

### 6. ConfirmSheet (`src/components/ui/confirm-sheet.tsx`)

**Purpose:** Standardised destructive action confirmation bottom sheet.

**Props:**
```ts
interface ConfirmSheetProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  subtitle?: string
  confirmLabel: string
  cancelLabel?: string   // default: "Скасувати"
}
```

**Anatomy:** Uses `BottomSheet` internally.
```
BottomSheet
  └── h2: text-[17px] font-semibold (title)
  └── p: text-[13px] text-muted-foreground (subtitle)
  └── Button destructive full-width min-h-[44px] (confirmLabel)
  └── Button ghost full-width min-h-[44px] (cancelLabel)
```

**Sound:** Plays `CAUTION` on open, `CAUTION` on confirm, `CLOSE` on cancel.

---

### 7. ProgressBar (`src/components/ui/progress-bar.tsx`)

**Props:**
```ts
interface ProgressBarProps {
  value: number      // 0–100
  className?: string
  completed?: boolean  // renders green when true
}
```

**Anatomy:**
```
div: h-1.5 w-full rounded-full bg-muted overflow-hidden
  └── div: h-full rounded-full transition-all duration-500
           width: `${Math.min(value, 100)}%`
           bg-primary (default) | bg-green-400 (completed)
```

---

## Page Designs

### Insights Page (`src/app/miniapp/reports/page.tsx`)

**Layout:**
```
ScrollArea (full height, pb = tab-bar-h)
  └── Header row (px-4 pt-6 pb-2)
        └── div: flex-1
              └── h1: "Інсайти" — iOS_Large_Title
              └── p: "Ретроспектива та аналіз" — Caption, muted
        └── button: 40×40 circular, bg-primary, Icon "add" size=20
                    (opens NewReportSheet, plays OPEN)
  └── ErrorBanner (if error, below header)
  └── GeneratingProgress (if generating — existing rotating labels)
  └── SkeletonReportCards × 2 (if loading)
  └── EmptyState (if !loading && reports.length === 0)
  └── Month groups (sorted newest-first)
        └── iOS_Section_Header: "Липень 2025" — Caption uppercase tracking-wide muted
        └── ReportCard × n
              └── gap-2 flex flex-col
                  bg-surface-elevated rounded-2xl border border-border/50
                  px-4 py-3.5
                  border-l-0 (no left accent on reports)
```

**ReportCard (collapsed):**
```
div: flex items-start justify-between gap-3
  └── div: flex-1
        └── div: flex items-center gap-2
              └── span: period label — Title (e.g. "7 днів")
              └── span: date range — Caption muted (e.g. "1 лип — 7 лип")
        └── p: two-line truncated summary — Body, line-clamp-2
  └── div: flex items-center gap-1
        └── button: Icon "delete" size=18, 44×44 tap area, muted (opens ConfirmSheet)
        └── button: Icon "expand_more" size=20, 44×44 tap area, muted (toggles expand)
```

**ReportCard (expanded):**
```
div: flex flex-col gap-0
  └── [collapsed header — same as above but chevron rotated 180°]
  └── Separator (hairline, border-border/30)
  └── For each retro section:
        └── p: section label — Caption uppercase tracking-wide muted pt-3 pb-1
        └── p: section body — Body
        └── Separator (hairline) — except after last section
```

**Retro section label map:**
- `went_well` → "Що пройшло добре"
- `didnt_go_well` → "Що не вийшло"
- `start_stop_continue` → "Почати / Зупинити / Продовжити"
- `experiment` → "Експеримент"
- `lesson` → "Урок"

**Month grouping logic:**
```ts
// Group reports by "MMMM yyyy" in uk-UA locale
const grouped = reports.reduce((acc, r) => {
  const key = new Date(r.created_at).toLocaleDateString('uk-UA', {
    month: 'long', year: 'numeric'
  })
  // capitalise first letter
  const label = key.charAt(0).toUpperCase() + key.slice(1)
  ;(acc[label] ??= []).push(r)
  return acc
}, {} as Record<string, Report[]>)
// Sort groups newest-first by parsing the first report's date
```

---

### NewReportSheet

Replaces the existing `NewReportDrawer`. Uses the new `BottomSheet` primitive.

**Step 1 — Period selection:**
```
BottomSheet
  └── h2: "Нова ретроспектива" — Title
  └── p: "Оберіть період для аналізу" — Caption muted
  └── List of period rows (full-width, not a grid):
        Each row: button min-h-[44px] flex items-center gap-3 px-0 w-full
          └── Icon (leading, 20px, primary/60)
          └── span: label — Body
          └── Icon "chevron_right" or "check" (trailing, 18px, muted/primary)
        Rows: Сьогодні (today), 7 днів (date_range), Місяць (calendar_month),
              Свій діапазон (tune)
  └── [Custom range inputs — animated height expand when "Свій діапазон" selected]
        div: overflow-hidden transition-all duration-300
          └── Separator
          └── Two date inputs (from / to) — text-[15px], bg-muted/40 rounded-xl px-4 py-3
  └── Button: "Згенерувати ретроспективу" — full-width primary min-h-[44px]
              disabled until period selected
              safe-area bottom padding
```

---

### Widgets Page (`src/app/miniapp/dashboard/page.tsx`)

**Loading state:** Replace spinner with `SkeletonMetricCard × 4` (or 6 for goals tab).

**Widget card tap behaviour:** Change from opening DrillDownDrawer to opening `LogEntrySheet`.

**LogEntrySheet:**
```
BottomSheet
  └── div: flex items-center gap-3 mb-4
        └── Icon: widget.icon, size=24, primary
        └── div
              └── h2: widget.title — Title
              └── p: widget.unit — Caption muted
  └── input: type="number", text-[24px] font-semibold text-center
             bg-muted/40 rounded-xl px-4 py-4 w-full
             autoFocus, inputMode="decimal"
  └── ErrorBanner (if submit error)
  └── Button: "Зберегти" — full-width primary min-h-[44px]
  └── button: "Переглянути записи" — text-[13px] text-muted-foreground text-center
              min-h-[44px] w-full (opens DrillDownDrawer)
```

**CreateWidgetSheet — 3-step chip flow:**

Step indicator: `div: flex gap-1.5 justify-center mb-4` — 3 dots, active = bg-primary, inactive = bg-muted.

**Step 1 — Category:**
```
h2: "Що хочеш відстежувати?" — Title
div: flex flex-wrap gap-2 mt-4
  └── Chip × 8 (Харчування, Активність, Сон, Вода, Вага, Витрати, Настрій, Кастомний)
```

**Step 2 — Question:**
```
button: "← Назад" — text-[13px] text-muted-foreground min-h-[44px]
h2: "{category}" — Title
div: flex flex-wrap gap-2 mt-4
  └── Chip × 2-3 (pre-built questions for category)
  └── Chip "Свій варіант" (add_circle icon)
[if "Свій варіант" selected:]
  input: text-[15px] bg-muted/40 rounded-xl px-4 py-3 w-full mt-3 autoFocus
Button: "Далі" — full-width primary min-h-[44px] disabled until selection
```

**Step 3 — Confirm:**
```
button: "← Змінити" — text-[13px] text-muted-foreground min-h-[44px]
div: bg-muted/40 rounded-2xl p-4 flex items-center gap-3
  └── Icon: category.icon size=32 text-primary
  └── div
        └── p: category.label — Title
        └── p: selected question — Body muted
ErrorBanner (if creation error)
Button: "Створити віджет" — full-width primary min-h-[44px]
  [creating state: spinner + "AI створює твій віджет..."]
```

**Horizontal slide animation between steps:**
```css
/* Step container uses overflow-hidden + translateX */
.step-enter  { transform: translateX(100%); opacity: 0; }
.step-active { transform: translateX(0);    opacity: 1; transition: 300ms ease-out; }
.step-exit   { transform: translateX(-100%); opacity: 0; }
```

---

### Feed Page (`src/app/miniapp/page.tsx`)

**Loading state:** Replace spinner with `SkeletonEntryCard × 4`.

**Entry card left accent:**
```tsx
// Determine entry type
const entryType = entry.metadata?.entry_type ?? 'log'
const accentClass = entryType === 'goal'
  ? 'border-l-4 border-amber-400'
  : 'border-l-4 border-primary/40'
```

**Goal entry additions (below entry content):**
```tsx
// Goal metrics from metadata
const goalMetric = entry.metadata?.goal_metrics?.[0]
if (goalMetric) {
  const current = /* aggregated from matching log entries */ 0
  const target = goalMetric.target
  const unit = goalMetric.unit
  const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0
  const completed = pct >= 100
  return (
    <div className="mt-2 flex flex-col gap-1">
      <ProgressBar value={pct} completed={completed} />
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <span>{current} / {target} {unit} · {pct}%</span>
        {completed && <Icon name="check_circle" size={14} className="text-green-400" />}
      </div>
    </div>
  )
}
```

**Entry type badges:**
```tsx
// In the badge row, before category badges:
{entryType === 'goal' && (
  <span className="rounded-full bg-amber-400/20 border border-amber-400/40
                   text-amber-300 text-[10px] px-2 py-0.5">
    Ціль
  </span>
)}
{entryType !== 'goal' && entry.metadata?.dashboard_metrics?.length > 0 && (
  <span className="rounded-full bg-primary/20 border border-primary/40
                   text-primary text-[10px] px-2 py-0.5">
    Лог
  </span>
)}
```

**Empty state:** Replace existing empty state with `EmptyState` component:
- icon: `contract`, title: "Стрічка порожня", subtitle: "Надішли повідомлення боту, щоб почати"

**Filtered empty state** (when category filter active and no results):
- icon: `filter_list`, title: "Немає записів у цій категорії",
  subtitle: "Спробуй іншу категорію або зніми фільтр",
  ctaLabel: "Зняти фільтр", onCta: `() => setFilter(null)`

**Delete confirmation:** Replace inline confirm with `ConfirmSheet`:
- title: "Видалити запис?", subtitle: "Цю дію не можна скасувати.",
  confirmLabel: "Видалити"

---

### Layout (`src/app/miniapp/layout.tsx`)

**Back navigation:** Add `BackButton` component rendered on sub-pages:
```tsx
// Detect if current path is a sub-page (not a root tab destination)
const rootPaths = ['/miniapp', '/miniapp/dashboard', '/miniapp/graph', '/miniapp/reports']
const isSubPage = !rootPaths.includes(pathname)

// BackButton
<button
  onClick={() => { router.back(); play('SLIDE') }}
  className="min-h-[44px] min-w-[44px] flex items-center justify-center"
  aria-label="Назад"
>
  <Icon name="arrow_back" size={24} />
</button>
```

Sub-pages that need back button: `/miniapp/subscriptions`, `/miniapp/onboarding` (when accessed directly, not via overlay).

---

## Bottom Sheet Migration Map

| Existing Component | Migration Strategy |
|---|---|
| `NewReportDrawer` (reports page) | Replace with `BottomSheet` + new period-row layout |
| `DeleteSheet` (reports page) | Replace with `ConfirmSheet` |
| `CreateWidgetSheet` (dashboard page) | Refactor internals to use `BottomSheet` + `Chip` |
| `MetricEditSheet` (dashboard page) | Wrap with `BottomSheet`, add drag handle, update backdrop |
| `DrillDownDrawer` (dashboard page) | Wrap with `BottomSheet`, add close button top-right |
| `CalendarSheet` (dashboard page) | Wrap with `BottomSheet` |
| `EditDrawer` (feed page) | Wrap with `BottomSheet`, update backdrop to `bg-black/50 backdrop-blur-sm` |
| `DeleteConfirmDialog` (feed page) | Replace with `ConfirmSheet` |

---

## Animation Specifications

### Bottom Sheet Enter/Exit

```css
/* Panel */
[data-state="closed"] .sheet-panel {
  transform: translateY(100%);
  transition: transform 250ms ease-in;
}
[data-state="open"] .sheet-panel {
  transform: translateY(0);
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Backdrop */
[data-state="closed"] .sheet-backdrop {
  opacity: 0;
  transition: opacity 200ms ease-in;
  pointer-events: none;
}
[data-state="open"] .sheet-backdrop {
  opacity: 1;
  transition: opacity 200ms ease-out;
}
```

### Shimmer Skeleton

```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
```

### Step Slide (CreateWidgetSheet)

Implemented with a `translateX` CSS transition on a wrapper div. The step index drives the transform: `translateX(-${step * 100}%)` on a flex container of fixed-width step panels.

### Report Card Expand

```css
/* Retro sections container */
.retro-sections {
  overflow: hidden;
  max-height: 0;
  transition: max-height 300ms ease-out;
}
.retro-sections.expanded {
  max-height: 2000px; /* large enough */
}
```

### Entry Delete Fade-out

```css
.entry-card.deleting {
  opacity: 0;
  transform: translateX(-20px);
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}
```

---

## Touch Target Compliance

All interactive elements meet 44 × 44 px minimum:

| Element | Implementation |
|---|---|
| Icon-only buttons (close, delete, expand) | `min-h-[44px] min-w-[44px] flex items-center justify-center` |
| Chips | `min-h-[44px] px-4` |
| Tab bar items | Existing — already 44 px |
| Drag handle area | Wrapper div `h-[44px] flex items-center justify-center` around the 4 px visual handle |
| Back button | `min-h-[44px] min-w-[44px]` |
| Period rows in NewReportSheet | `min-h-[44px]` |

---

## Accessibility

- All icon-only buttons have `aria-label` in Ukrainian.
- `BottomSheet` traps focus when open (`focus-trap` via `tabIndex` management or a lightweight utility).
- `BottomSheet` restores focus to the trigger element on close.
- `aria-expanded` on report card toggle buttons.
- `aria-disabled` on disabled chips and CTA buttons.
- `role="status"` on skeleton screens with `aria-label="Завантаження..."`.
- `role="alert"` on `ErrorBanner` for screen reader announcement.
- Colour contrast: all new text meets WCAG AA (4.5:1 for body, 3:1 for large/UI).

---

## File Change Summary

| File | Change Type |
|---|---|
| `src/components/ui/bottom-sheet.tsx` | **New** |
| `src/components/ui/chip.tsx` | **New** |
| `src/components/ui/skeleton.tsx` | **New** |
| `src/components/ui/error-banner.tsx` | **New** |
| `src/components/ui/empty-state.tsx` | **New** |
| `src/components/ui/confirm-sheet.tsx` | **New** |
| `src/components/ui/progress-bar.tsx` | **New** |
| `src/app/globals.css` | **Modify** — add shimmer keyframe, sheet animation classes |
| `src/app/miniapp/reports/page.tsx` | **Modify** — full redesign per Req 1–3 |
| `src/app/miniapp/dashboard/page.tsx` | **Modify** — chip flow, LogEntrySheet, skeleton, empty states per Req 4–5 |
| `src/app/miniapp/page.tsx` | **Modify** — entry type distinction, skeleton, empty states per Req 6 |
| `src/app/miniapp/layout.tsx` | **Modify** — back button on sub-pages per Req 14 |
| `src/components/ui/edit-drawer.tsx` | **Modify** — migrate to BottomSheet, update backdrop per Req 7 |


---

## Subscription & Monetisation Design

### Tier Definitions (Updated `src/lib/stars/paywall.ts`)

The existing `SubscriptionTier` type (`"free" | "stars_basic" | "stars_pro"`) is kept as-is. The `TIER_INFO` constant and `FEATURE_TIERS` map are expanded.

**Updated `TIER_INFO`:**

```ts
export const TIER_INFO: Record<SubscriptionTier, TierInfo> = {
  free: {
    tier: "free",
    name: "Безкоштовний",
    priceStars: 0,
    description: "Для знайомства з Memo",
    icon: "⭐",
    limits: {
      entries: 100,
      widgets: 3,
      reports: 5,
      historyDays: 30,
    },
    features: [
      { label: "До 100 записів",            included: true  },
      { label: "3 активних віджети",         included: true  },
      { label: "5 ретроспектив",             included: true  },
      { label: "Стрічка за 30 днів",         included: true  },
      { label: "Шифрування записів",         included: true  },
      { label: "Пін-код захист",             included: true  },
      { label: "AI ретроспективи",           included: false },
      { label: "AI рекомендації",            included: false },
      { label: "Голосові повідомлення",      included: false },
      { label: "Трекінг цілей",              included: false },
      { label: "Кастомні віджети (AI)",      included: false },
      { label: "Повна історія",              included: false },
      { label: "Експорт даних",              included: false },
      { label: "Пріоритетна обробка",        included: false },
    ],
  },
  stars_basic: {
    tier: "stars_basic",
    name: "Basic",
    priceStars: 250,
    description: "Для щоденного трекінгу",
    icon: "🌟",
    limits: {
      entries: 2000,
      widgets: 15,
      reports: 50,
      historyDays: 365,
    },
    features: [
      { label: "До 2 000 записів",           included: true  },
      { label: "15 активних віджетів",       included: true  },
      { label: "50 ретроспектив",            included: true  },
      { label: "Стрічка за 1 рік",           included: true  },
      { label: "Шифрування записів",         included: true  },
      { label: "Пін-код захист",             included: true  },
      { label: "AI ретроспективи",           included: true  },
      { label: "AI рекомендації",            included: true  },
      { label: "Голосові повідомлення",      included: true  },
      { label: "Трекінг цілей",              included: true  },
      { label: "Кастомні віджети (AI)",      included: true  },
      { label: "Повна історія",              included: false },
      { label: "Експорт даних",              included: false },
      { label: "Пріоритетна обробка",        included: false },
    ],
  },
  stars_pro: {
    tier: "stars_pro",
    name: "Pro",
    priceStars: 500,
    description: "Для максималістів",
    icon: "💎",
    limits: {
      entries: Infinity,
      widgets: Infinity,
      reports: Infinity,
      historyDays: Infinity,
    },
    features: [
      { label: "Необмежені записи",          included: true  },
      { label: "Необмежені віджети",         included: true  },
      { label: "Необмежені ретроспективи",   included: true  },
      { label: "Вся історія",                included: true  },
      { label: "Шифрування записів",         included: true  },
      { label: "Пін-код захист",             included: true  },
      { label: "AI ретроспективи",           included: true  },
      { label: "AI рекомендації",            included: true  },
      { label: "Голосові повідомлення",      included: true  },
      { label: "Трекінг цілей",              included: true  },
      { label: "Кастомні віджети (AI)",      included: true  },
      { label: "Повна історія",              included: true  },
      { label: "Експорт даних",              included: true  },
      { label: "Пріоритетна обробка",        included: true  },
    ],
  },
};
```

**Updated `FEATURE_TIERS` (feature-flag gates):**

```ts
export const FEATURE_TIERS: Record<string, SubscriptionTier> = {
  ai_reports:           "stars_basic",
  ai_recommendations:   "stars_basic",
  voice_logging:        "stars_basic",
  goal_tracking:        "stars_basic",
  custom_widgets:       "stars_basic",
  full_history:         "stars_pro",
  graph_full:           "stars_basic",
  data_export:          "stars_pro",
  priority_processing:  "stars_pro",
};
```

**Updated `TierInfo` interface:**

```ts
export interface TierInfo {
  tier: SubscriptionTier;
  name: string;
  priceStars: number;
  description: string;
  icon: string;
  limits: {
    entries: number;       // Infinity for unlimited
    widgets: number;
    reports: number;
    historyDays: number;
  };
  features: { label: string; included: boolean }[];
}
```

---

### Server-Side Limit Enforcement

Each limit-checked API route follows this pattern:

```ts
// In /api/entries POST, /api/widgets POST, /api/reports POST
import { getUserTier, TIER_INFO } from "@/lib/stars/paywall";

const tier = await getUserTier(userId);
const limits = TIER_INFO[tier].limits;

// Count current usage
const { count } = await supabase
  .from("entries")
  .select("id", { count: "exact", head: true })
  .eq("user_id", userId);

if (limits.entries !== Infinity && (count ?? 0) >= limits.entries) {
  return new Response(JSON.stringify({
    error: "limit_exceeded",
    feature: "entries",
    limit: limits.entries,
    current: count,
    required_tier: "stars_basic",
  }), { status: 402 });
}
```

History filter in `/api/entries GET`:

```ts
const historyDays = TIER_INFO[tier].limits.historyDays;
if (historyDays !== Infinity) {
  const cutoff = new Date(Date.now() - historyDays * 86_400_000).toISOString();
  query = query.gte("created_at", cutoff);
}
```

Expiry check (added to every limit-checked route):

```ts
// Treat expired subscriptions as free
const profile = await supabase.from("profiles")
  .select("subscription_tier, subscription_ends_at")
  .eq("id", userId).single();

const effectiveTier: SubscriptionTier =
  profile.subscription_ends_at &&
  new Date(profile.subscription_ends_at) < new Date()
    ? "free"
    : (profile.subscription_tier ?? "free");
```

---

### Paywall Modal (`src/components/ui/paywall-modal.tsx`)

New component. Uses `BottomSheet` internally.

**Props:**
```ts
interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  feature: string;           // e.g. "ai_reports", "entries", "widgets"
  current?: number;          // current usage count (for count limits)
  limit?: number;            // plan limit (for count limits)
  requiredTier: SubscriptionTier;
}
```

**Anatomy:**
```
BottomSheet
  └── div: flex flex-col items-center text-center gap-4 px-4 pt-2 pb-2
        └── Icon: feature-specific, size=48, text-amber-400 (or primary)
        └── h2: feature-specific title — Title (17px semibold)
        └── p: usage description — Body (15px) text-muted-foreground
        └── div: feature comparison row
              bg-muted/40 rounded-xl px-4 py-3
              └── p: "Basic: {basicLimit} · Pro: необмежено" — Caption muted
  └── div: px-4 pb-safe flex flex-col gap-3
        └── Button primary full-width min-h-[44px]:
              "Перейти на Basic — 250 ⭐" (or "Перейти на Pro — 500 ⭐")
        └── Button ghost full-width min-h-[44px]: "Не зараз"
```

**Feature-to-copy map:**
```ts
const PAYWALL_COPY: Record<string, { icon: string; title: string; subtitle: (c: number, l: number) => string }> = {
  entries:        { icon: "contract",        title: "Ліміт записів вичерпано",      subtitle: (c,l) => `У безкоштовному плані доступно ${l} записів. Ти використав ${c} з ${l}.` },
  widgets:        { icon: "dashboard",       title: "Ліміт віджетів вичерпано",     subtitle: (c,l) => `У безкоштовному плані доступно ${l} віджети. Ти використав ${c} з ${l}.` },
  reports:        { icon: "wb_incandescent", title: "Ліміт звітів вичерпано",       subtitle: (c,l) => `У безкоштовному плані доступно ${l} звітів. Ти використав ${c} з ${l}.` },
  ai_reports:     { icon: "wb_incandescent", title: "AI ретроспективи",             subtitle: () => "Генерація ретроспектив доступна з планом Basic." },
  custom_widgets: { icon: "dashboard",       title: "Кастомні AI-віджети",          subtitle: () => "Створення кастомних віджетів доступне з планом Basic." },
  goal_tracking:  { icon: "my_location",     title: "Трекінг цілей",                subtitle: () => "Відстеження цілей та прогрес-бари доступні з планом Basic." },
  voice_logging:  { icon: "mic",             title: "Голосові повідомлення",        subtitle: () => "Логування голосом доступне з планом Basic." },
  full_history:   { icon: "history",         title: "Повна історія",                subtitle: () => "Доступ до всієї історії записів доступний з планом Pro." },
  data_export:    { icon: "download",        title: "Експорт даних",                subtitle: () => "Експорт у JSON/CSV доступний з планом Pro." },
};
```

---

### Usage Counter Chip

Inline informational chip, not a full `Chip` component (smaller, non-interactive in the primary sense).

```tsx
// UsageCounterChip component
interface UsageCounterChipProps {
  current: number;
  limit: number;
  label: string;       // e.g. "записів", "віджетів", "звітів"
  onTap: () => void;   // opens PaywallModal
}

// Renders when current / limit >= 0.7 (70% threshold)
// Appearance: bg-amber-400/10 border border-amber-400/30 text-amber-300
//             rounded-full px-3 min-h-[32px] flex items-center gap-1.5
//             text-[11px] font-medium
// Icon: "warning" size=14 text-amber-400
// Text: "{current} / {limit} {label}"
```

---

### Locked Feature Indicators

**Lock overlay on action buttons:**
```tsx
// Wrap the + button in a relative container
<div className="relative">
  <button className="h-10 w-10 rounded-full bg-primary ...">
    <Icon name="add" size={20} />
  </button>
  {isLocked && (
    <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center
                    justify-center rounded-full bg-amber-400">
      <Icon name="lock" size={10} className="text-slate-950" />
    </div>
  )}
</div>
```

**Locked goal progress bar (Feed_Page):**
```tsx
{isFreeTier && entryType === 'goal' && (
  <div className="mt-2 relative">
    {/* Blurred placeholder bar */}
    <div className="h-1.5 w-full rounded-full bg-muted/60 blur-[2px]" />
    <div className="absolute inset-0 flex items-center justify-center gap-1">
      <Icon name="lock" size={12} className="text-muted-foreground/60" />
      <span className="text-[11px] text-muted-foreground/60">Доступно з Basic</span>
    </div>
  </div>
)}
```

---

### Enhanced Onboarding

**Updated slide array (6 slides):**

```ts
const SLIDES = [
  {
    emoji: '📓',
    title: 'Твій особистий щоденник',
    body: 'Просто пиши або говори — Memo сам розбере що зберегти. Їжа, тренування, витрати, думки.',
    bg: 'from-indigo-950 to-slate-950',
    accent: 'text-indigo-400',
  },
  {
    emoji: '🤖',
    title: 'AI, що тебе розуміє',
    body: 'Memo аналізує твої записи, рахує калорії та макроси, трекає активність і відповідає на питання про твоє минуле.',
    bg: 'from-violet-950 to-slate-950',
    accent: 'text-violet-400',
  },
  {
    emoji: '📊',
    title: 'Дашборд і графіки',
    body: 'Всі твої метрики в одному місці. Бачиш прогрес, патерни і тренди — без зайвих зусиль.',
    bg: 'from-blue-950 to-slate-950',
    accent: 'text-blue-400',
  },
  {
    emoji: '💡',
    title: 'Розумні рекомендації',
    body: 'Memo помічає якщо ти мало спиш, п\'єш забагато алкоголю або не вистачає білка — і підказує що змінити.',
    bg: 'from-amber-950 to-slate-950',
    accent: 'text-amber-400',
  },
  {
    emoji: '🔐',
    title: 'Твої дані захищені',
    body: 'Всі записи шифруються на твоєму пристрої перед збереженням. Навіть ми не можемо їх прочитати. Твоя приватність — наш пріоритет.',
    bg: 'from-emerald-950 to-slate-950',
    accent: 'text-emerald-400',
    showPrivacyBadge: true,   // renders lock icon + "Зашифровано" in bottom-left
  },
  {
    emoji: '⭐',
    title: 'Обери свій план',
    body: 'Базові функції безкоштовні назавжди. Перейди на Basic або Pro щоб розблокувати AI-аналітику, необмежені записи та більше.',
    bg: 'from-yellow-950 to-slate-950',
    accent: 'text-yellow-400',
    isFinal: true,
  },
];
```

**Privacy badge (Slide 5):**
```tsx
{slide.showPrivacyBadge && (
  <div className="absolute bottom-32 left-6 flex items-center gap-1.5">
    <Icon name="lock" size={16} className="text-emerald-400/60" />
    <span className="text-[11px] text-emerald-400/60 font-medium">Зашифровано</span>
  </div>
)}
```

**Final slide CTA:** `"Почати безкоштовно →"` (plain text, no emoji prefix).

---

### Onboarding Paywall (Full-Screen Overlay)

Shown after the user taps the final slide CTA or "Пропустити". Replaces the onboarding overlay without dismissing it first (z-index stacking).

**State flow:**
```
OnboardingOverlay (z-[100])
  └── [user taps final CTA or Skip]
        └── setShowPaywall(true)
              └── OnboardingPaywall (z-[101]) slides up over the onboarding
                    └── [user taps "Продовжити безкоштовно →"]
                          └── finish() → localStorage.memo_onboarding_done = '1'
                                       → setShowOnboarding(false)
                    └── [user taps "Перейти на Basic — 250 ⭐"]
                          └── handleSubscribe('stars_basic')
                                → on success: CELEBRATION + confetti burst → finish()
                                → on cancel/fail: stay on paywall
```

**Anatomy:**
```
div: fixed inset-0 z-[101] flex flex-col
     bg-gradient-to-b from-yellow-950 to-slate-950
     px-5 pt-safe-top pb-safe-bottom
     animate-slideUp (300ms ease-out from translateY(100%))

  └── h1: "Обери свій план" — 28px bold white text-center mt-8
  └── p: "Підтримай Memo та отримай більше" — 15px white/60 text-center mb-6

  └── div: flex flex-col gap-3 flex-1 overflow-y-auto
        └── PlanCard (Free)
        └── PlanCard (Basic) — highlighted, "Рекомендовано" badge
        └── PlanCard (Pro)

  └── div: flex flex-col gap-3 mt-4
        └── Button: "Перейти на Basic — 250 ⭐"
              bg-gradient-to-r from-yellow-400 to-amber-400 text-slate-950
              full-width min-h-[44px] rounded-2xl font-semibold
              shadow-lg shadow-yellow-400/20
        └── button: "Продовжити безкоштовно →"
              text-[13px] text-white/40 min-h-[44px] w-full text-center
```

**Compact PlanCard (Onboarding Paywall):**
```
div: rounded-2xl border px-4 py-3
     Free: border-border/30 bg-white/5
     Basic: border-yellow-400/40 bg-yellow-400/5  (+ "Рекомендовано" badge top-right)
     Pro: border-border/30 bg-white/5

  └── div: flex items-center justify-between
        └── div: flex items-center gap-2
              └── span: emoji icon (text-xl)
              └── div
                    └── p: name — 15px semibold white
                    └── p: price — 13px white/60 ("Безкоштовно" / "250 ⭐ / міс" / "500 ⭐ / міс")
        └── [Basic only] span: "Рекомендовано" — 10px bg-yellow-400/20 text-yellow-300
                                                   rounded-full px-2 py-0.5
  └── div: flex flex-wrap gap-x-3 gap-y-0.5 mt-2
        └── [3 key features as "✓ label" — 11px white/50]
```

**Confetti burst on successful payment:**
```tsx
// Simple emoji burst — 8 star emojis animate outward from center
// CSS: @keyframes confetti-burst { 0% { transform: scale(0) translateY(0); opacity: 1; }
//                                  100% { transform: scale(1) translateY(-80px); opacity: 0; } }
// Each star has a different translateX offset (-60px to +60px) and animation-delay (0–200ms)
```

---

### Subscriptions Page Redesign (`src/app/miniapp/subscriptions/page.tsx`)

**Layout:**
```
ScrollArea (full height, pb = tab-bar-h)
  └── Header (px-4 pt-6 pb-2)
        └── BackButton (arrow_back, 44×44)
        └── div
              └── h1: "Підписка" — iOS_Large_Title
              └── p: "Підтримай Memo та отримай більше можливостей" — Caption muted

  └── CurrentPlanBanner (px-4 mb-4)
        bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3
        └── span: tier emoji (text-2xl)
        └── div
              └── p: "Поточний план: {name}" — 15px semibold
              └── p: expiry or "Постійний доступ" — 13px muted
        └── [if ends_at within 7 days] Badge: "Закінчується через N днів" — amber

  └── SuccessBanner / ErrorBanner (if applicable)

  └── UsageSection (px-4 mb-4) — only for non-Pro users
        iOS_Section_Header: "ВИКОРИСТАННЯ"
        └── UsageRow × 3: "Записи", "Віджети", "Звіти"
              Each row: label (Body) + "N / limit" (Caption muted) + mini progress bar

  └── PlanCards (px-4 flex flex-col gap-3)
        └── PlanCard (Free)
        └── PlanCard (Basic) — "Найпопулярніший" badge
        └── PlanCard (Pro)

  └── Footer (px-4 pt-4 pb-8 text-center)
        Caption muted: "Оплата через Telegram Stars · Підписка на 30 днів ·
                        Поновлення вручну · Без прихованих платежів"
```

**Full PlanCard (Subscriptions Page):**
```
div: rounded-2xl border p-4
     current: border-primary/40 bg-primary/5
     other: border-border/50 bg-card
     Basic: relative (for "Найпопулярніший" badge)

  └── [Basic only] span: "Найпопулярніший" — absolute top-3 right-3
                          10px bg-primary/20 text-primary rounded-full px-2 py-0.5

  └── div: flex items-center justify-between mb-3
        └── div: flex items-center gap-2
              └── span: emoji (text-2xl)
              └── div
                    └── p: name — Title (17px semibold)
                    └── p: description — Caption muted
        └── div: text-right (if paid tier)
              └── p: "{N} ⭐" — 18px bold
              └── p: "/ місяць" — 10px muted

  └── Separator (opacity-50 mb-3)

  └── ul: space-y-1.5 mb-4
        └── li × 14: flex items-center gap-2 text-[13px]
              └── span: "✓" text-green-500 OR "✗" text-muted-foreground/40
              └── span: feature label — text-foreground/80 (included) OR text-muted-foreground/40 (excluded)

  └── CTA button (if upgrade) OR status label (if current)
```

**UsageRow:**
```tsx
// Mini progress bar inline
<div className="flex items-center justify-between py-2">
  <span className="text-[15px]">{label}</span>
  <div className="flex items-center gap-2">
    <span className="text-[13px] text-muted-foreground">{current} / {limit === Infinity ? '∞' : limit}</span>
    <div className="w-16 h-1 rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full bg-primary"
           style={{ width: `${Math.min((current / limit) * 100, 100)}%` }} />
    </div>
  </div>
</div>
```

---

### Renewal Banner

Shown in the layout when subscription has expired. Positioned as a fixed banner above the tab bar.

```tsx
// In MiniAppContent, after auth is ready:
// Check: profile.subscription_ends_at < now() && profile.subscription_tier !== 'free'
// AND localStorage.memo_renewal_banner_shown_date !== today's date string

{showRenewalBanner && (
  <div className="fixed bottom-[calc(var(--tab-bar-h)+8px)] left-4 right-4 z-40
                  bg-amber-400/10 border border-amber-400/30 rounded-2xl
                  px-4 py-3 flex items-center gap-3">
    <Icon name="warning" size={18} className="text-amber-400 shrink-0" />
    <p className="text-[13px] text-amber-300 flex-1">
      Твоя підписка {tierName} закінчилась. Поновити?
    </p>
    <button onClick={handleRenew}
            className="text-[13px] font-semibold text-amber-400 min-h-[44px] px-2">
      Поновити
    </button>
    <button onClick={dismissRenewalBanner}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center">
      <Icon name="close" size={16} className="text-amber-400/60" />
    </button>
  </div>
)}
```

---

### File Change Summary (Subscription additions)

| File | Change Type |
|---|---|
| `src/lib/stars/paywall.ts` | **Modify** — expand `TierInfo`, `TIER_INFO`, `FEATURE_TIERS`, add limit enforcement helpers |
| `src/components/ui/paywall-modal.tsx` | **New** — Paywall_Modal bottom sheet |
| `src/app/miniapp/subscriptions/page.tsx` | **Modify** — full redesign with usage section, full feature list, renewal warning |
| `src/app/miniapp/layout.tsx` | **Modify** — 6-slide onboarding, OnboardingPaywall overlay, renewal banner |
| `src/app/miniapp/onboarding/page.tsx` | **Modify** — 6 slides, privacy badge, OnboardingPaywall trigger |
| `src/app/api/entries/route.ts` | **Modify** — add limit enforcement (count + history filter) |
| `src/app/api/widgets/route.ts` | **Modify** — add limit enforcement (widget count) |
| `src/app/api/reports/route.ts` | **Modify** — add limit enforcement (report count) + feature gate |
| `src/app/miniapp/reports/page.tsx` | **Modify** — lock overlay on + button, PaywallModal on 402 |
| `src/app/miniapp/dashboard/page.tsx` | **Modify** — lock overlay on + button, PaywallModal on 402, usage counter |
| `src/app/miniapp/page.tsx` | **Modify** — locked goal bars for free tier, usage counter, PaywallModal on 402 |
| `src/app/miniapp/graph/page.tsx` | **Modify** — locked overlay for free tier |
| `supabase/migrations/20240001000013_tier_limits.sql` | **New** — DB function `get_user_usage_counts(user_id)` |
