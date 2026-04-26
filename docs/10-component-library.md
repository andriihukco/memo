# Component Library — Memo

Atomic design system built on **shadcn/ui** + **Radix UI** + **Tailwind CSS** + **Framer Motion**.

All components are in `src/components/ui/`.

---

## Atomic Design Hierarchy

```
Atoms          → Button, Badge, Icon, Separator, Skeleton, ProgressBar
Molecules      → Card, Chip, ErrorBanner, EmptyState, UsageCounterChip
Organisms      → BottomSheet, EditDrawer, ConfirmSheet, PasscodeScreen, PaywallModal
Templates      → Layout (miniapp/layout.tsx), page-level components
Pages          → Feed, Dashboard, Graph, Reports, Settings, Subscriptions
```

---

## Atoms

### `Button`
```tsx
<Button variant="default" | "secondary" | "outline" | "ghost" | "destructive" size="default" | "sm" | "lg" | "icon">
  Label
</Button>
```
Built on `@radix-ui/react-slot` with `class-variance-authority`. Minimum 44px height enforced globally.

---

### `Badge`
```tsx
<Badge variant="default" | "secondary" | "outline" | "destructive" className={getCategoryColor(category)}>
  Калорії
</Badge>
```
Used for category labels on entry cards. Color comes from `getCategoryColor(category)` which returns Tailwind class strings.

---

### `Icon`
```tsx
<Icon name="local_fire_department" size={16} className="text-primary" />
```
Renders Material Symbols Rounded. The `name` prop is a Material Symbols icon name.

**Common icons used:**
| Icon Name | Usage |
|-----------|-------|
| `delete` | Delete actions |
| `edit` | Edit actions |
| `chevron_right` | Navigation arrows |
| `check` | Selection, success |
| `lock` | Passcode, security |
| `smart_toy` | Bot avatar |
| `support_agent` | Support link |
| `label` | Categories |
| `bedtime` | Sleep metric |
| `fitness_center` | Workout metric |
| `restaurant` | Food metric |
| `water_drop` | Water metric |

---

### `Separator`
```tsx
<Separator className="opacity-20 mx-4" />
```
Thin horizontal rule. Used between settings rows and card sections.

---

### `Skeleton`
```tsx
<SkeletonEntryCard />
<SkeletonReportCard />
<SkeletonMetricCard />
```
Shimmer loading placeholders. Uses `skeleton-shimmer` CSS animation.

---

### `ProgressBar`
```tsx
<ProgressBar value={75} completed={false} />
```
Used for goal progress display on entry cards and dashboard.

---

## Molecules

### `Card` / `CardContent`
```tsx
<Card>
  <CardContent className="p-0">
    {/* rows */}
  </CardContent>
</Card>
```
Base container for settings sections, metric cards, subscription cards.

---

### `Chip`
```tsx
<Chip label="Калорії" active={true} onClick={...} />
```
Pill-shaped filter chip. Used in category filter bars.

---

### `ErrorBanner`
```tsx
<ErrorBanner message="Щось пішло не так" onDismiss={() => setError(null)} />
```
Dismissible error notification. Appears inline above the relevant content.

---

### `EmptyState`
```tsx
<EmptyState
  icon="edit_note"
  title="Немає записів"
  subtitle="Напиши боту свій перший запис"
/>
```
Centered empty state with icon, title, and subtitle. Used when lists are empty.

---

### `UsageCounterChip`
```tsx
<UsageCounterChip current={45} limit={100} label="записів" />
```
Shows current usage vs tier limit. Turns amber when >80% used.

---

## Organisms

### `BottomSheet`
```tsx
<BottomSheet open={open} onClose={onClose} className="px-4 pb-6">
  {children}
</BottomSheet>
```
Slide-up sheet with backdrop. Manages `data-sheets-open` body attribute to hide the tab bar when open. Uses Framer Motion spring animation.

**Props:**
- `open: boolean`
- `onClose: () => void`
- `className?: string`
- `style?: CSSProperties`

---

### `EditDrawer`
```tsx
<EditDrawer
  entry={{ id, content, category }}
  onSave={async (id, content, category) => {...}}
  onDelete={async (id) => {...}}
  onClose={() => setEditOpen(false)}
  accessToken={accessToken}
/>
```
Full-screen slide-up drawer for editing diary entries. Features:
- Category picker (horizontal scroll of chips)
- Multi-line text area
- Save / Delete / Cancel actions
- Haptic feedback on save/delete

---

### `ConfirmSheet`
```tsx
<ConfirmSheet
  open={pendingDelete}
  onClose={() => setPendingDelete(false)}
  onConfirm={handleConfirmDelete}
  title="Видалити запис?"
  subtitle="Цю дію не можна скасувати."
  confirmLabel="Видалити"
/>
```
Two-button confirmation bottom sheet. Used for destructive actions.

---

### `PasscodeScreen`
```tsx
<PasscodeScreen
  mode="enter" | "set" | "confirm"
  title="Введіть код"
  subtitle="4-значний код доступу"
  expectedHash={storedHash}
  onSuccess={(pin) => {...}}
  onCancel={() => setStep('idle')}
  stepCurrent={1}
  stepTotal={2}
  mismatch={false}
/>
```
Full-screen PIN entry with:
- 4-dot progress indicator
- Numeric keypad (3×4 grid + backspace)
- Shake animation on wrong PIN
- Step indicator for multi-step flows
- Haptic feedback

---

### `PaywallModal`
```tsx
<PaywallModal
  open={paywallOpen}
  onClose={() => setPaywallOpen(false)}
  feature="entries"
  current={95}
  limit={100}
  requiredTier="stars_basic"
/>
```
Bottom sheet paywall with:
- Feature-specific copy (emoji, title, subtitle)
- Plan selector tabs (Nova / Supernova)
- Billing period switcher (monthly / quarterly / annual)
- Feature list for selected plan
- Inline payment via `window.Telegram.WebApp.openInvoice()`

**Feature copy keys:** `ai_reports`, `ai_recommendations`, `voice_logging`, `goal_tracking`, `custom_widgets`, `ai_widgets`, `entries`, `widgets`, `reports`, `date_range`

---

### `SplashScreen`
```tsx
<SplashScreen />
```
Full-screen loading state shown while auth is initializing. Displays the Memo logo with a fade-in animation.

---

### `IosActionSheet`
```tsx
<IosActionSheet
  open={open}
  onClose={onClose}
  actions={[
    { label: 'Редагувати', icon: 'edit', onClick: handleEdit },
    { label: 'Видалити', icon: 'delete', destructive: true, onClick: handleDelete },
  ]}
/>
```
iOS-style action sheet with backdrop. Used for context menus.

---

### `LockButton`
```tsx
<LockButton onClick={handleLock} />
```
Floating lock button in the top-right corner of the mini app. Triggers immediate passcode lock.

---

### `Confetti`
```tsx
<Confetti active={confetti} />
```
Star burst animation triggered on successful payment. 8 stars burst outward from center.

---

## Templates

### Mini App Layout (`src/app/miniapp/layout.tsx`)

The root layout for all mini app pages. Responsibilities:
1. Initialize Telegram WebApp (`ready()`, `expand()`)
2. Read safe area insets → CSS variables
3. Authenticate via `/api/auth/telegram`
4. Show `SplashScreen` while loading
5. Show `PasscodeScreen` when locked
6. Show onboarding slides on first visit
7. Render tab bar
8. Wrap children in `AuthProvider`, `SoundProvider`, `ReportGenerationProvider`

**Tab Bar:**
```
┌─────────────────────────────────────────────────────┐
│  📋 Стрічка  📊 Дашборд  🕸 Граф  💡 Звіти  ⚙️ Налаш │
└─────────────────────────────────────────────────────┘
```
Floating pill-shaped dark bar with glassmorphism. Hides when `data-sheets-open > 0`.

---

## Page Components

### Feed Page (`/miniapp`)
Key sub-components:
- `SwipeableCard` — entry card with swipe-to-delete gesture
- `ThreadCard` — grouped conversation thread
- `SwipeableThreadCard` — thread card with swipe-to-delete
- `CategoryFilterBar` — horizontal scroll category filter
- `EntryContent` — expandable text with "show more"

### Dashboard Page (`/miniapp/dashboard`)
Key sub-components:
- `CreateWidgetSheet` — 3-step widget creation flow
- `MetricIcon` — icon resolver for metric keys
- `AggregatedMetric` — computed metric with sum/avg/last aggregation

### Graph Page (`/miniapp/graph`)
Key sub-components:
- `NodeDetailPanel` — bottom sheet showing node content + linked entries
- `DateFilterSheet` — date range picker with paywall for extended ranges
- D3 force simulation (not a React component — imperative SVG manipulation)

### Reports Page (`/miniapp/reports`)
Key sub-components:
- `NewReportSheet` — period picker for report generation
- `ReportDetail` — full report view with stats overlay
- `ActivityHeatmap` — daily entry count as colored squares
- `CategoryBreakdown` — horizontal bar chart
- `MetricHighlights` — 2×2 grid of big numbers
- `MoodSparkline` — daily mood bar chart
- `VolumeChart` — entries per day bar chart
- `HourlyChart` — activity by hour
- `WeekdayPattern` — activity by day of week
- `StreakCard` — current streak, longest streak, consistency %
- `MarkdownText` — custom markdown renderer (bold, italic, lists, headings)

---

## Reusable Patterns

### Category Color Helper
```typescript
// src/components/ui/edit-drawer.tsx
export function getCategoryColor(category: string): string {
  return BUILTIN_CATEGORIES[category]?.color ?? 'bg-slate-100 text-slate-700';
}

export function getCategoryLabel(category: string, fallback?: string): string {
  return BUILTIN_CATEGORIES[category]?.label_ua ?? fallback ?? category;
}
```

### Sheet Body Attribute (Tab Bar Hiding)
```typescript
function useSheetBodyAttr(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = parseInt(document.body.getAttribute('data-sheets-open') ?? '0', 10);
    document.body.setAttribute('data-sheets-open', String(prev + 1));
    return () => {
      const cur = parseInt(document.body.getAttribute('data-sheets-open') ?? '1', 10);
      const next = Math.max(0, cur - 1);
      if (next === 0) document.body.removeAttribute('data-sheets-open');
      else document.body.setAttribute('data-sheets-open', String(next));
    };
  }, [open]);
}
```

### Staggered Animation Pattern
```typescript
{items.map((item, i) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay: 0.1 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
  >
    <ItemComponent item={item} />
  </motion.div>
))}
```
