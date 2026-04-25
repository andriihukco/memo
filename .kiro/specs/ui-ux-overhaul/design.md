# Design Document: UI/UX Overhaul

## Overview

This document describes the technical design for the Memo Telegram Mini App UI/UX overhaul. The overhaul covers eight areas: icon system migration to Google Material Symbols Rounded, a redesigned pill-style floating bottom navigation bar, a chronological timeline feed, a Widgets page rename and refresh, Settings category management (rename/remove/merge), promotion of the Retrospective page to a first-class "Insights" tab, WCAG AA accessibility compliance, and a full interaction sound design system using `snd-lib`.

The app is a Next.js 14 App Router application with Tailwind CSS, Supabase for data, and runs inside Telegram as a Mini App. The existing dark theme (deep navy `#0B0F19` background, `#F8FAFC` foreground, `#3B82F6` primary) is preserved throughout.

### Research Summary

**Google Material Symbols Rounded** is available as a variable font via Google Fonts. The recommended import is a `<link>` tag in the `<head>` with `display=swap` and the `FILL`, `wght`, `GRAD`, `opsz` axes. The ligature-based rendering approach (placing the icon name as text content inside a `<span class="material-symbols-rounded">`) is the simplest integration path and requires no JavaScript. The font is ~150 KB for the full set; a subset can be requested via the `icon_names` parameter if bundle size becomes a concern.

**snd-lib** (`npm install snd-lib`) exposes a `Snd` class with `Snd.SOUNDS.*` constants and `Snd.KITS.SND01/02/03`. The library requires an AudioContext, which browsers block until a user gesture. The correct pattern is to call `snd.load(kit)` inside a `pointerdown` handler on the first interaction. The library is ESM-only and must be dynamically imported (`import('snd-lib')`) to avoid SSR errors.

**WCAG AA contrast** for the existing dark theme: the primary text `hsl(210 40% 98%)` on background `hsl(222 47% 6%)` yields ~18:1 (passes). The muted foreground `hsl(215 20% 55%)` on background yields ~4.6:1 (passes AA for normal text). Category badge text colors (e.g., `text-indigo-400` = `#818cf8`) on their translucent backgrounds (e.g., `bg-indigo-500/15` over the card surface `#151B2B`) need verification — the effective background is approximately `#1a1d2e`, giving a contrast of ~4.8:1 for indigo-400, which passes.

---

## Architecture

The overhaul introduces three new shared abstractions and three new API routes, while modifying six existing pages/components.

```
src/
├── app/
│   ├── layout.tsx                    ← Add Material Symbols <link>
│   ├── miniapp/
│   │   ├── layout.tsx                ← Pill tab bar (4 tabs, no Profile)
│   │   ├── page.tsx                  ← Timeline feed + settings button
│   │   ├── dashboard/page.tsx        ← Renamed "Віджети", Material Symbols icons
│   │   ├── reports/page.tsx          ← Renamed "Інсайти", Material Symbols icons
│   │   └── settings/page.tsx         ← Category management + Sound section
│   └── api/
│       └── categories/
│           ├── route.ts              ← Add PATCH handler
│           └── [id]/route.ts         ← New: DELETE handler
│           └── merge/route.ts        ← New: POST handler
├── components/
│   └── ui/
│       └── icon.tsx                  ← New: <Icon> wrapper component
└── lib/
    └── sound/
        ├── sound-context.tsx         ← New: SoundContext + SoundProvider
        └── use-sound.ts              ← New: useSound() hook
```

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│  MiniAppLayout (layout.tsx)                             │
│  ├── SoundProvider (wraps all pages)                    │
│  ├── AuthProvider                                       │
│  ├── PillTabBar (4 tabs)                                │
│  └── <main> (page content)                              │
│       ├── FeedPage (timeline)                           │
│       ├── WidgetsPage (dashboard)                       │
│       ├── GraphPage (unchanged)                         │
│       ├── InsightsPage (reports)                        │
│       └── SettingsPage (+ categories + sound)           │
└─────────────────────────────────────────────────────────┘

useSound() ──→ SoundContext ──→ snd-lib Snd instance
                                    ↓
                              AudioContext (lazy init on first pointer)
```

---

## Components and Interfaces

### 1. `<Icon>` Wrapper (`src/components/ui/icon.tsx`)

A thin wrapper around the Material Symbols Rounded ligature font. All icon usages in the app go through this component.

```tsx
interface IconProps {
  name: string;          // Material Symbols ligature name, e.g. "home", "widgets"
  size?: number;         // Font size in px, default 24
  className?: string;    // Additional Tailwind classes
  'aria-label'?: string; // Required when used as interactive control
  filled?: boolean;      // FILL axis: 0 (outline) or 1 (filled), default 0
}

export function Icon({ name, size = 24, className, filled = false, ...props }: IconProps) {
  return (
    <span
      className={cn('material-symbols-rounded select-none', className)}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-hidden={!props['aria-label']}
      {...props}
    >
      {name}
    </span>
  );
}
```

**Lucide → Material Symbols mapping** (documented in `icon.tsx`):

| Lucide | Material Symbols | Notes |
|---|---|---|
| `ScrollText` | `home` | Tab bar: Feed |
| `LayoutDashboard` | `widgets` | Tab bar: Widgets |
| `Network` | `show_chart` | Tab bar: Graph |
| `FileText` | `description` | Reports/Insights |
| `Settings` | `settings` | Settings button |
| `Plus` | `add` | Add button |
| `Trash2` | `delete` | Delete button |
| `ChevronDown` | `expand_more` | Expand/collapse |
| `ChevronRight` | `chevron_right` | Navigation arrow |
| `X` | `close` | Close button |
| `Check` | `check` | Checkmark |
| `Lock` | `lock` | Lock icon |
| `LockOpen` | `lock_open` | Unlock icon |
| `MessageCircle` | `chat_bubble` | Thread indicator |
| `Bot` | `smart_toy` | AI/bot indicator |
| `Brain` | `neurology` | Brain metric |
| `Lightbulb` | `lightbulb` | Tab bar: Insights |
| `TrendingUp` | `trending_up` | Trend up |
| `TrendingDown` | `trending_down` | Trend down |
| `Minus` | `remove` | Neutral trend |
| `Calendar` | `calendar_today` | Date picker |
| `Tag` | `tag` | Default category |
| `Flame` | `local_fire_department` | Calories/energy |
| `Wallet` | `account_balance_wallet` | Expenses |
| `Dumbbell` | `fitness_center` | Workout |
| `Droplets` | `water_drop` | Water/hydration |
| `Moon` | `bedtime` | Sleep |
| `BookOpen` | `menu_book` | Books/reading |
| `Scale` | `scale` | Weight |
| `Smile` | `sentiment_satisfied` | Mood |
| `Zap` | `bolt` | Energy |
| `Wind` | `air` | Wind/breathing |
| `MapPin` | `location_on` | Location/travel |
| `Utensils` | `restaurant` | Food |
| `Heart` | `favorite` | Health/heart |
| `Activity` | `monitor_heart` | Activity |
| `Coffee` | `coffee` | Coffee |
| `Leaf` | `eco` | Nature/eco |
| `Pill` | `medication` | Medication |
| `Award` | `emoji_events` | Award/achievement |
| `Star` | `star` | Star/rating |
| `Target` | `my_location` | Target/goal |
| `Clock` | `schedule` | Time |
| `RectangleEllipsis` | `password` | Passcode |
| `ClockFading` | `timer` | Lock timer |

### 2. `SoundContext` (`src/lib/sound/sound-context.tsx`)

```tsx
interface SoundContextValue {
  play: (sound: string) => void;
  enabled: boolean;
  kit: string;
  setEnabled: (v: boolean) => void;
  setKit: (kit: string) => void;
}

// Sound event → Snd.SOUNDS constant mapping
const SOUND_MAP: Record<string, string> = {
  TAP:          'TAP',
  BUTTON:       'BUTTON',
  DISABLED:     'DISABLED',
  TOGGLE_ON:    'TOGGLE_ON',
  TOGGLE_OFF:   'TOGGLE_OFF',
  SLIDE:        'SLIDE',
  SELECT:       'SELECT',
  OPEN:         'OPEN',
  CLOSE:        'CLOSE',
  PROCESSING:   'PROCESSING',
  TYPE:         'TYPE',
  NOTIFICATION: 'NOTIFICATION',
  CAUTION:      'CAUTION',
  CELEBRATION:  'CELEBRATION',
  ALERT:        'ALERT',
};
```

The provider:
1. Reads `localStorage.getItem('memo_sound_enabled')` and `localStorage.getItem('memo_sound_kit')` on mount (guarded by `typeof window !== 'undefined'`).
2. Defaults `enabled = true`, `kit = 'SND02'` if no stored values.
3. Dynamically imports `snd-lib` on the first `pointerdown` event on `document` (autoplay policy compliance).
4. Exposes `play(sound)` which calls `snd.play(Snd.SOUNDS[sound])` when enabled.
5. Persists changes to `localStorage` when `setEnabled` or `setKit` is called.

### 3. `useSound()` Hook (`src/lib/sound/use-sound.ts`)

```tsx
export function useSound(): SoundContextValue {
  return useContext(SoundContext);
}
```

### 4. Pill Tab Bar (updated `src/app/miniapp/layout.tsx`)

Four tabs only. The Profile/Settings tab is removed from the bar; Settings is accessible via a button in the Feed page header.

```tsx
const tabs = [
  { label: 'Стрічка',  href: '/miniapp',           icon: 'home' },
  { label: 'Віджети',  href: '/miniapp/dashboard',  icon: 'widgets' },
  { label: 'Графік',   href: '/miniapp/graph',       icon: 'show_chart' },
  { label: 'Інсайти',  href: '/miniapp/reports',     icon: 'lightbulb' },
];
```

The pill container:
- `position: fixed`, `bottom: safeAreaInset.bottom + 12px`, horizontally centred with `left: 50%`, `transform: translateX(-50%)`
- `border-radius: 9999px` (fully rounded pill)
- Background: `rgba(15, 20, 35, 0.92)` with `backdrop-filter: blur(20px)`
- `box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)`
- Width: `min(calc(100vw - 32px), 320px)`
- Each tab: `min-width: 44px`, `min-height: 44px`, `flex: 1`
- Active tab: filled icon (`filled={true}`) + `text-white`; inactive: `text-white/40`
- Active indicator: small filled pill segment behind the active icon (background `rgba(255,255,255,0.12)`, `border-radius: 9999px`)

### 5. Category Management API Routes

**`PATCH /api/categories`** — rename a category:
```
Body: { name: string, label_ua: string }
Auth: Bearer JWT
Response: { ok: true } | { error: string }
```
Updates `label_ua` in the `categories` table for the given `name` and `user_id`.

**`DELETE /api/categories/[id]`** — remove a category:
```
Params: id = category name (slug)
Auth: Bearer JWT
Response: { ok: true, reassigned: number } | { error: string }
```
Server-side transaction:
1. `UPDATE entries SET category = 'uncategorized' WHERE user_id = $uid AND category = $name`
2. `DELETE FROM categories WHERE user_id = $uid AND name = $name AND name != 'uncategorized'`

**`POST /api/categories/merge`** — merge source into target:
```
Body: { source: string, target: string }
Auth: Bearer JWT
Response: { ok: true, reassigned: number } | { error: string }
```
Server-side transaction:
1. `UPDATE entries SET category = $target WHERE user_id = $uid AND category = $source`
2. `DELETE FROM categories WHERE user_id = $uid AND name = $source AND name != 'uncategorized'`

All three routes use the same `edge` runtime and JWT pattern as the existing `categories/route.ts`.

---

## Data Models

### Category (existing Supabase table, no schema changes)

```sql
categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  name        text NOT NULL,           -- slug key, e.g. "thoughts"
  label_ua    text NOT NULL,           -- display name, e.g. "Думки"
  color       text NOT NULL,           -- Tailwind class string
  icon        text,                    -- icon name (Lucide slug → Material Symbols name after migration)
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
)
```

The `name = 'uncategorized'` row is the locked system category. The API routes enforce this constraint server-side by checking `name != 'uncategorized'` before any destructive operation.

### Sound Preferences (localStorage)

```
memo_sound_enabled: "true" | "false"   (default: "true")
memo_sound_kit:     "SND01" | "SND02" | "SND03"  (default: "SND02")
```

### Timeline Date Groups (client-side, no persistence)

```tsx
interface DateGroup {
  dateKey: string;    // "2025-07-14" (UTC+3 local date)
  dateLabel: string;  // "14 липня 2025" (uk-UA locale)
  items: (Entry | ThreadGroup)[];
}
```

The `groupByDate` function partitions the entry list by UTC+3 calendar date. The UTC+3 offset (`TZ_OFFSET_MS = 3 * 60 * 60 * 1000`) is already used in `dashboard/page.tsx` and will be reused.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The feature involves pure functions (date grouping, color contrast calculation, sound event mapping, icon rendering) that are well-suited to property-based testing. The project already has `fast-check` installed (`"fast-check": "^4.6.0"` in `package.json`), so properties will be implemented using fast-check.

### Property 1: No Lucide imports in migrated files

*For any* TypeScript/TSX file under `src/app/miniapp/` or `src/components/ui/`, the file's source text should not contain an import from `'lucide-react'`.

**Validates: Requirements 1.2, 1.3**

### Property 2: Icon component renders the icon name as text content

*For any* non-empty string `name` that is a valid Material Symbols ligature name, rendering `<Icon name={name} />` should produce a DOM element whose text content equals `name` and whose className includes `'material-symbols-rounded'`.

**Validates: Requirements 1.5**

### Property 3: Active tab has distinct visual class

*For any* tab in the four-tab list, when the current pathname equals that tab's `href`, the rendered tab element should have a CSS class or inline style that differs from the inactive state (specifically: the icon should have `filled={true}` and the text should have full opacity).

**Validates: Requirements 2.3**

### Property 4: All tabs have minimum 44×44 px touch targets

*For any* tab rendered in the PillTabBar, the element's computed `minHeight` and `minWidth` should each be at least 44 px.

**Validates: Requirements 2.8**

### Property 5: Date grouping preserves all entries

*For any* non-empty array of entries with arbitrary `created_at` timestamps, the `groupByDate` function should produce groups whose total entry count equals the original array length (no entries lost or duplicated).

**Validates: Requirements 3.1**

### Property 6: Date grouping — all entries in a group share the same UTC+3 calendar date

*For any* array of entries, every group produced by `groupByDate` should contain only entries whose UTC+3 calendar date equals the group's `dateKey`.

**Validates: Requirements 3.1**

### Property 7: Category badge contrast ratio ≥ 4.5:1

*For any* color entry in `COLOR_PALETTE`, the WCAG contrast ratio between the text color hex and the effective background color (the translucent badge background composited over the card surface `#151B2B`) should be at least 4.5:1.

**Validates: Requirements 3.5, 7.1**

### Property 8: MetricCard renders all four required fields

*For any* `AggregatedMetric` object with valid `key`, `label`, `value`, `unit`, and `icon` fields, the rendered `MetricCard` should contain the label text, the value as a string, the unit text, and an icon element.

**Validates: Requirements 4.3**

### Property 9: Category deletion reassigns all entries to Uncategorized

*For any* category name (not 'uncategorized') that has N entries assigned to it, after calling `DELETE /api/categories/[name]`, all N entries should have `category = 'uncategorized'` and the category should no longer exist in the categories table.

**Validates: Requirements 5.4**

### Property 10: Uncategorized category row has no destructive action buttons

*For any* category list containing a category with `name = 'uncategorized'`, the rendered settings row for that category should not contain rename, remove, or merge-source action elements.

**Validates: Requirements 5.6**

### Property 11: Destructive category actions require confirmation

*For any* destructive category action (remove or merge), the action handler should not call the API endpoint until the user has confirmed via the confirmation step.

**Validates: Requirements 5.9**

### Property 12: Sound kit selection persists to localStorage

*For any* kit value in `['SND01', 'SND02', 'SND03']`, after calling `setKit(kit)`, reading `localStorage.getItem('memo_sound_kit')` should return that kit value.

**Validates: Requirements 8.2, 8.7**

### Property 13: play() is a no-op when sound is disabled

*For any* sound event name in the SOUND_MAP, when `enabled = false`, calling `play(event)` should not invoke the snd instance's play method.

**Validates: Requirements 8.5**

### Property 14: play() calls the correct Snd.SOUNDS constant

*For any* sound event name in the SOUND_MAP, when `enabled = true`, calling `play(event)` should invoke the snd instance with `Snd.SOUNDS[SOUND_MAP[event]]`.

**Validates: Requirements 8.3**

### Property 15: Looped sounds stop when condition resolves

*For any* looped sound (PROCESSING, ALERT), after the triggering condition resolves (e.g., `stopLoop()` is called), subsequent ticks should not emit audio.

**Validates: Requirements 8.9**

---

## Error Handling

### Category Management Errors

- **Network failure** during rename/remove/merge: The Settings page catches the error, displays an inline Ukrainian error message (e.g., "Не вдалося перейменувати категорію. Спробуйте ще раз."), and leaves the category list unchanged (optimistic update is rolled back).
- **Attempt to modify Uncategorized**: The API routes return `400 { error: "Cannot modify system category" }`. The UI never sends such requests (the lock icon and disabled state prevent it), but the server enforces it as a safety net.
- **Concurrent modification**: If two tabs modify the same category simultaneously, the last write wins (Supabase upsert semantics). No special handling needed for a single-user app.

### Sound System Errors

- **AudioContext blocked by autoplay policy**: The `snd.load()` call is deferred to the first `pointerdown` event. If the user never interacts, no audio is attempted.
- **snd-lib dynamic import failure**: Wrapped in a try/catch. If the import fails, `play()` silently becomes a no-op. The sound toggle in Settings remains functional (it just won't produce audio).
- **SSR**: All snd-lib code is guarded by `typeof window !== 'undefined'`. The `SoundProvider` renders children normally on the server; the Snd instance is only created client-side.

### Icon Font Loading Errors

- If the Google Fonts CDN is unavailable, the `<span>` elements render as text (the icon name string). This is acceptable degradation — the app remains functional, just without icons. A CSS fallback can hide the text: `.material-symbols-rounded { font-size: 0 }` with a `@font-face` fallback, but this is out of scope for this overhaul.

---

## Testing Strategy

### Unit Tests (example-based)

Focus on specific behaviors and edge cases:

- `<Icon>` renders correct `aria-hidden` when no `aria-label` is provided
- `<Icon>` renders correct `aria-label` when provided
- `groupByDate([])` returns `[]`
- `groupByDate` with entries all on the same date returns one group
- `SoundProvider` renders without errors in a Node.js environment (SSR safety)
- `useSound().play('BUTTON')` is a no-op when `enabled = false`
- Settings page renders lock icon for Uncategorized category
- Settings page does not render rename/remove buttons for Uncategorized
- `PATCH /api/categories` returns 400 when `name = 'uncategorized'`
- `DELETE /api/categories/[id]` returns 400 when `id = 'uncategorized'`
- `POST /api/categories/merge` returns 400 when `source = 'uncategorized'`

### Property-Based Tests (fast-check)

Each property test runs a minimum of 100 iterations. Tests are tagged with the feature and property number.

**Tag format:** `// Feature: ui-ux-overhaul, Property N: <property text>`

```
Property 1  — No Lucide imports in migrated files
              Arbitraries: fc.constantFrom(...fileList)
              Assert: file source does not match /from ['"]lucide-react['"]/

Property 2  — Icon renders name as text content
              Arbitraries: fc.string({ minLength: 1 }) filtered to valid ligature names
              Assert: rendered span textContent === name, className includes 'material-symbols-rounded'

Property 3  — Active tab has distinct visual class
              Arbitraries: fc.constantFrom(...tabs.map(t => t.href))
              Assert: tab with matching href has filled icon and full-opacity text

Property 4  — Touch targets ≥ 44×44 px
              Arbitraries: fc.constantFrom(...tabs)
              Assert: minHeight >= 44, minWidth >= 44

Property 5  — groupByDate preserves entry count
              Arbitraries: fc.array(fc.record({ id: fc.uuid(), created_at: fc.date().map(d => d.toISOString()), ... }))
              Assert: sum of group sizes === input length

Property 6  — groupByDate groups by UTC+3 date
              Arbitraries: same as Property 5
              Assert: for each group, all entries share the same UTC+3 date string

Property 7  — Badge contrast ≥ 4.5:1
              Arbitraries: fc.constantFrom(...COLOR_PALETTE)
              Assert: wcagContrast(textHex, compositeBackground) >= 4.5

Property 8  — MetricCard renders all fields
              Arbitraries: fc.record({ key: fc.string(), label: fc.string(), value: fc.float(), unit: fc.string(), icon: fc.string() })
              Assert: rendered output contains label, value.toString(), unit

Property 9  — Category deletion reassigns entries (integration, mocked Supabase)
              Arbitraries: fc.array(fc.record({ id: fc.uuid(), category: fc.string() }), { minLength: 1 })
              Assert: after delete, all entries have category = 'uncategorized'

Property 10 — Uncategorized row has no destructive buttons
              Arbitraries: fc.array(fc.record({ name: fc.string(), label_ua: fc.string() })) with 'uncategorized' always present
              Assert: rendered row for 'uncategorized' has no delete/rename/merge buttons

Property 11 — Destructive actions require confirmation
              Arbitraries: fc.constantFrom('remove', 'merge')
              Assert: API not called before confirmation dialog is confirmed

Property 12 — Kit selection persists to localStorage
              Arbitraries: fc.constantFrom('SND01', 'SND02', 'SND03')
              Assert: localStorage.getItem('memo_sound_kit') === selected kit

Property 13 — play() is no-op when disabled
              Arbitraries: fc.constantFrom(...Object.keys(SOUND_MAP))
              Assert: snd.play mock not called when enabled = false

Property 14 — play() calls correct constant
              Arbitraries: fc.constantFrom(...Object.keys(SOUND_MAP))
              Assert: snd.play called with Snd.SOUNDS[SOUND_MAP[event]]

Property 15 — Looped sounds stop on resolve
              Arbitraries: fc.constantFrom('PROCESSING', 'ALERT')
              Assert: after stopLoop(), snd.play not called on subsequent ticks
```

### Integration Tests

- Full category rename flow: render Settings → tap category → rename → confirm → verify API called and list updated
- Full category delete flow: render Settings → tap category → delete → confirm → verify API called and error state on failure
- Full category merge flow: render Settings → tap category → merge → select target → confirm → verify API called
- Sound kit change: render Settings → enable sound → change kit → verify `snd.load()` called with new kit
- Tab bar navigation: render layout → tap each tab → verify pathname changes without full reload
- Feed page timeline: render with mixed-date entries → verify date headers appear between groups

### Accessibility Tests

- Tab bar has `role="navigation"` and `aria-label="Головна навігація"`
- Active tab has `aria-current="page"`
- All icon-only buttons have `aria-label`
- All form inputs have `aria-label` or associated `<label>`
- Focus ring is visible on keyboard navigation (visual regression)
