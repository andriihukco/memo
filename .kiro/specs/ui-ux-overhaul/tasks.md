# Implementation Plan: UI/UX Overhaul

## Overview

Incremental implementation of the Memo Mini App UI/UX overhaul. Tasks are ordered so each step builds on the previous one: shared infrastructure first (icon system, sound system), then navigation, then individual pages, then API routes, then sound wiring, and finally property-based tests. No step leaves orphaned code — every new file is integrated before moving on.

## Tasks

- [x] 1. Install snd-lib and add Material Symbols Rounded font
  - Run `npm install snd-lib` to add the sound library as a dependency
  - Add a `<link>` tag for the Google Material Symbols Rounded variable font (with `display=swap` and axes `FILL,wght,GRAD,opsz`) inside the `<head>` of `src/app/layout.tsx`
  - Verify the font link loads before any page-level scripts
  - _Requirements: 1.1, 8.1_

- [x] 2. Create the `<Icon>` wrapper component
  - [x] 2.1 Create `src/components/ui/icon.tsx` with the `IconProps` interface and `Icon` function as specified in the design document
    - Implement `name`, `size` (default 24), `className`, `filled` (default false), and `aria-label` props
    - Set `fontVariationSettings` to control `FILL`, `wght`, `GRAD`, `opsz` axes
    - Set `aria-hidden={true}` when no `aria-label` is provided; set `aria-label` when provided
    - Include the full Lucide → Material Symbols mapping table as a JSDoc comment
    - _Requirements: 1.5, 1.6, 7.4_

  - [ ]* 2.2 Write property test for Icon component rendering
    - **Property 2: Icon component renders the icon name as text content**
    - **Validates: Requirements 1.5**

- [x] 3. Create the SoundContext and useSound hook
  - [x] 3.1 Create `src/lib/sound/sound-context.tsx` with `SoundContextValue` interface and `SoundProvider` component
    - Define `SOUND_MAP` constant mapping all 15 sound event names to `Snd.SOUNDS.*` keys
    - Read `memo_sound_enabled` and `memo_sound_kit` from `localStorage` on mount (guarded by `typeof window !== 'undefined'`)
    - Default to `enabled = true`, `kit = 'SND02'` when no stored values exist
    - Dynamically import `snd-lib` (`import('snd-lib')`) on the first `pointerdown` event on `document` to comply with browser autoplay policy
    - Implement `play(sound)` that calls `snd.play(Snd.SOUNDS[SOUND_MAP[sound]])` only when `enabled = true` and the Snd instance is loaded
    - Implement `setEnabled` and `setKit` that persist to `localStorage` and update context state
    - Guard all snd-lib code with `typeof window !== 'undefined'` for SSR safety
    - _Requirements: 8.1, 8.2, 8.5, 8.6, 8.7, 8.8_

  - [x] 3.2 Create `src/lib/sound/use-sound.ts` exporting the `useSound()` hook
    - Return the full `SoundContextValue` from `useContext(SoundContext)`
    - _Requirements: 8.4_

  - [ ]* 3.3 Write property test: play() is a no-op when disabled
    - **Property 13: play() is a no-op when sound is disabled**
    - **Validates: Requirements 8.5**

  - [ ]* 3.4 Write property test: play() calls the correct Snd.SOUNDS constant
    - **Property 14: play() calls the correct Snd.SOUNDS constant**
    - **Validates: Requirements 8.3**

  - [ ]* 3.5 Write property test: kit selection persists to localStorage
    - **Property 12: Sound kit selection persists to localStorage**
    - **Validates: Requirements 8.2, 8.7**

  - [ ]* 3.6 Write property test: looped sounds stop when condition resolves
    - **Property 15: Looped sounds stop when condition resolves**
    - **Validates: Requirements 8.9**

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Redesign the tab bar as a pill navigation (4 tabs)
  - [x] 5.1 Update `src/app/miniapp/layout.tsx` — replace the existing 5-tab `TabBar` with a new `PillTabBar` component
    - Define the four-tab array: `{ label: 'Стрічка', href: '/miniapp', icon: 'home' }`, `{ label: 'Віджети', href: '/miniapp/dashboard', icon: 'widgets' }`, `{ label: 'Графік', href: '/miniapp/graph', icon: 'show_chart' }`, `{ label: 'Інсайти', href: '/miniapp/reports', icon: 'lightbulb' }`
    - Style the pill container: `position: fixed`, `bottom: safeAreaInset.bottom + 12px`, `left: 50%`, `transform: translateX(-50%)`, `border-radius: 9999px`, background `rgba(15,20,35,0.92)`, `backdrop-filter: blur(20px)`, `box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)`, `width: min(calc(100vw - 32px), 320px)`
    - Each tab: `flex: 1`, `min-width: 44px`, `min-height: 44px`
    - Active tab: use `<Icon filled={true} />` + `text-white`; inactive: `<Icon filled={false} />` + `text-white/40`
    - Active indicator: small pill segment behind active icon with `background: rgba(255,255,255,0.12)`, `border-radius: 9999px`
    - Add `role="navigation"` and `aria-label="Головна навігація"` to the `<nav>` element
    - Add `aria-current="page"` to the active tab link
    - Wrap `MiniAppContent` with `SoundProvider` (import from `@/lib/sound/sound-context`)
    - Remove the old `ScrollText`, `LayoutDashboard`, `Network`, `FileText`, `Settings` Lucide imports from this file
    - Recalculate `tabBarH` based on the new pill height (~56px) plus bottom inset
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9, 7.6_

  - [ ]* 5.2 Write property test: active tab has distinct visual class
    - **Property 3: Active tab has distinct visual class**
    - **Validates: Requirements 2.3**

  - [ ]* 5.3 Write property test: all tabs have minimum 44×44 px touch targets
    - **Property 4: All tabs have minimum 44×44 px touch targets**
    - **Validates: Requirements 2.8**

- [x] 6. Refactor the Feed page as a chronological timeline
  - [x] 6.1 Add `groupByDate` function to `src/app/miniapp/page.tsx`
    - Define `TZ_OFFSET_MS = 3 * 60 * 60 * 1000`
    - Implement `groupByDate(items: (Entry | ThreadGroup)[]): DateGroup[]` that partitions items by UTC+3 calendar date
    - Each `DateGroup` has `dateKey: string` (e.g. `"2025-07-14"`), `dateLabel: string` (uk-UA locale, e.g. `"14 липня 2025"`), and `items: (Entry | ThreadGroup)[]`
    - _Requirements: 3.1_

  - [x] 6.2 Render the timeline spine and date-header separators in `FeedPage`
    - Replace the flat `groupByThread(entries)` render loop with a two-level loop: outer over `DateGroup[]`, inner over `group.items`
    - Render a date-header row before each group: a small filled dot on the left + the `dateLabel` text
    - Render a continuous vertical line from the date-header dot down through all entries in the group (CSS `border-left` or an absolutely positioned `<div>`)
    - Each entry card gets a left-aligned dot/node anchoring it to the spine
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 6.3 Add settings button and update page heading in `FeedPage`
    - Change the page heading from `"Стрічка"` (already correct) to ensure it reads `"Стрічка"`
    - In non-select mode, render a settings icon button (`<Icon name="settings" />`) in the page header that navigates to `/miniapp/settings` (use `router.push` or `<Link>`)
    - Replace the `LockButton` import with the `<Icon>` component where applicable; replace `Trash2`, `MessageCircle`, `Bot`, `ChevronDown` Lucide imports with `<Icon>` equivalents (`delete`, `chat_bubble`, `smart_toy`, `expand_more`)
    - _Requirements: 2.4, 3.4, 3.6, 3.7, 1.2, 1.3_

  - [ ]* 6.4 Write property test: groupByDate preserves all entries
    - **Property 5: Date grouping preserves all entries**
    - **Validates: Requirements 3.1**

  - [ ]* 6.5 Write property test: groupByDate groups by UTC+3 date
    - **Property 6: Date grouping — all entries in a group share the same UTC+3 calendar date**
    - **Validates: Requirements 3.1**

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update the Widgets page (dashboard)
  - [x] 8.1 Update `src/app/miniapp/dashboard/page.tsx` — rename heading and replace Lucide icons
    - Change the page heading from `"Дашборд"` to `"Віджети"`
    - Replace all Lucide icon imports (`Flame`, `Wallet`, `Dumbbell`, `Lightbulb`, `Brain`, `TrendingUp`, `TrendingDown`, `Minus`, `ChevronDown`, `ChevronRight`, `Droplets`, `Moon`, `BookOpen`, `Scale`, `Smile`, `Zap`, `Wind`, `MapPin`, `Utensils`, `Tag`, `Heart`, `Activity`, `X`, `Calendar`, `Trash2`, `Plus`, `Coffee`, `Leaf`, `Pill`, `Award`, `Star`, `Target`, `Clock`) with `<Icon>` using the mapping from the design document
    - Update `MetricIcon` to use `<Icon name={...} />` instead of the Lucide `ICON_MAP`; fall back to `<Icon name="tag" />` for unknown keys
    - Update the empty-state to use `<Icon name="widgets" size={32} />` with a Ukrainian motivational message
    - Ensure metric widget cards have `rounded-xl` corners and `shadow-card` box-shadow
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 1.2, 1.3_

  - [ ]* 8.2 Write property test: MetricCard renders all four required fields
    - **Property 8: MetricCard renders all four required fields**
    - **Validates: Requirements 4.3**

- [x] 9. Update the Insights page (reports)
  - [x] 9.1 Update `src/app/miniapp/reports/page.tsx` — rename to Інсайти and replace Lucide icons
    - Change the page heading from `"Ретроспектива"` to `"Інсайти"`
    - Add a subtitle `"Ретроспектива та аналіз"` below the heading
    - Replace `FileText` → `<Icon name="description" />`, `Plus` → `<Icon name="add" />`, `Trash2` → `<Icon name="delete" />`, `ChevronDown` → `<Icon name="expand_more" />`
    - Update the empty-state: replace `<FileText size={32} />` with `<Icon name="lightbulb" size={32} />` and update the prompt text to `"Натисни + щоб згенерувати першу ретроспективу"`
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6, 1.2, 1.3_

- [x] 10. Add category management API routes
  - [x] 10.1 Add `PATCH` handler to `src/app/api/categories/route.ts`
    - Implement `export async function PATCH(req: Request)` using the same `edge` runtime, `getUserJwt`, and `makeSupabase` helpers already in the file
    - Parse `{ name, label_ua }` from the request body; return `400` if `name` is missing or equals `'uncategorized'`
    - Execute `UPDATE categories SET label_ua = $label_ua WHERE user_id = $uid AND name = $name`
    - Return `{ ok: true }` on success or `{ error: string }` on failure
    - _Requirements: 5.3_

  - [x] 10.2 Create `src/app/api/categories/[id]/route.ts` — DELETE handler
    - Use `export const runtime = "edge"` and the same JWT/Supabase pattern
    - Extract `id` (category name slug) from `params`; return `400` if `id === 'uncategorized'`
    - Step 1: `UPDATE entries SET category = 'uncategorized' WHERE user_id = $uid AND category = $id`
    - Step 2: `DELETE FROM categories WHERE user_id = $uid AND name = $id AND name != 'uncategorized'`
    - Return `{ ok: true, reassigned: number }` where `reassigned` is the count from step 1
    - _Requirements: 5.4_

  - [x] 10.3 Create `src/app/api/categories/merge/route.ts` — POST handler
    - Use `export const runtime = "edge"` and the same JWT/Supabase pattern
    - Parse `{ source, target }` from the request body; return `400` if `source === 'uncategorized'` or either field is missing
    - Step 1: `UPDATE entries SET category = $target WHERE user_id = $uid AND category = $source`
    - Step 2: `DELETE FROM categories WHERE user_id = $uid AND name = $source AND name != 'uncategorized'`
    - Return `{ ok: true, reassigned: number }`
    - _Requirements: 5.5_

  - [ ]* 10.4 Write property test: category deletion reassigns all entries to Uncategorized
    - **Property 9: Category deletion reassigns all entries to Uncategorized**
    - **Validates: Requirements 5.4**

- [x] 11. Update the Settings page — Categories section and Sound section
  - [x] 11.1 Add the Categories section to `src/app/miniapp/settings/page.tsx`
    - Fetch categories from `/api/categories` using the `accessToken` from `useAuth()`
    - Render a "Категорії" section listing all categories; for each non-locked category show rename and remove action buttons; for the `uncategorized` category show only a lock icon and a subtitle explaining it is a system category
    - Implement inline rename: tapping a category row opens a bottom sheet with a text input pre-filled with `label_ua`; on confirm call `PATCH /api/categories` and update the list optimistically; on error show an inline Ukrainian error message and roll back
    - Implement remove: tapping the remove button shows a confirmation bottom sheet; on confirm call `DELETE /api/categories/[name]`; on error show an inline error and leave the list unchanged
    - Implement merge: tapping the merge button opens a target-selector bottom sheet listing all other non-locked categories; on confirm call `POST /api/categories/merge`; on error show an inline error
    - Replace all Lucide icon imports in this file (`Check`, `ChevronRight`, `Lock`, `LockOpen`, `RectangleEllipsis`, `ClockFading`) with `<Icon>` equivalents (`check`, `chevron_right`, `lock`, `lock_open`, `password`, `timer`)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 1.2, 1.3_

  - [x] 11.2 Add the Sound section to `src/app/miniapp/settings/page.tsx`
    - Import `useSound` from `@/lib/sound/use-sound`
    - Render a "Звук" section with a toggle switch that calls `setEnabled(v)` from `useSound()`; when toggled off, no sounds play
    - When the toggle is ON, render a kit selector showing three options: SND01 "Sine", SND02 "Piano" (default, marked), SND03 "Industrial"; tapping a kit calls `setKit(kit)` which triggers `snd.load(Snd.KITS.SND0X)` and persists to `localStorage`
    - _Requirements: 5.11, 5.12, 8.2, 8.7_

  - [ ]* 11.3 Write property test: Uncategorized row has no destructive buttons
    - **Property 10: Uncategorized category row has no destructive action buttons**
    - **Validates: Requirements 5.6_**

  - [ ]* 11.4 Write property test: destructive category actions require confirmation
    - **Property 11: Destructive category actions require confirmation**
    - **Validates: Requirements 5.9**

- [x] 12. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Wire useSound() calls into interactive elements
  - [x] 13.1 Wire sound into the tab bar navigation in `src/app/miniapp/layout.tsx`
    - Call `play('SLIDE')` inside the `onClick` handler of each `PillTabBar` tab link
    - _Requirements: 8.3_

  - [x] 13.2 Wire sound into Feed page interactions in `src/app/miniapp/page.tsx`
    - Call `play('BUTTON')` when the settings icon button is tapped
    - Call `play('OPEN')` when `EditDrawer` opens (entry tap)
    - Call `play('CLOSE')` when `EditDrawer` closes
    - Call `play('OPEN')` when the delete confirmation dialog opens
    - Call `play('CLOSE')` when the delete confirmation dialog is cancelled
    - Call `play('CAUTION')` when a delete is confirmed
    - Call `play('SELECT')` when a category filter chip is tapped
    - Call `play('TOGGLE_ON')` / `play('TOGGLE_OFF')` when entering/exiting select mode
    - _Requirements: 8.3_

  - [x] 13.3 Wire sound into Widgets page in `src/app/miniapp/dashboard/page.tsx`
    - Call `play('OPEN')` when `CreateWidgetSheet`, `MetricEditSheet`, `DrillDownDrawer`, or `CalendarSheet` opens
    - Call `play('CLOSE')` when any of those sheets closes
    - Call `play('BUTTON')` on the primary action buttons (create widget, save metric edit)
    - Call `play('CELEBRATION')` after a widget is successfully created (step `'done'`)
    - Call `play('TYPE')` on text input keystrokes in `CreateWidgetSheet`
    - _Requirements: 8.3_

  - [x] 13.4 Wire sound into Insights page in `src/app/miniapp/reports/page.tsx`
    - Call `play('OPEN')` when `NewReportDrawer` opens
    - Call `play('CLOSE')` when `NewReportDrawer` closes
    - Call `play('PROCESSING')` when `generating` becomes `true`; stop the loop when `generating` becomes `false`
    - Call `play('CELEBRATION')` when a report is successfully generated
    - Call `play('CAUTION')` when `genError` is set
    - Call `play('BUTTON')` on the "Згенерувати ретроспективу" button
    - _Requirements: 8.3, 8.9_

  - [x] 13.5 Wire sound into Settings page in `src/app/miniapp/settings/page.tsx`
    - Call `play('TOGGLE_ON')` / `play('TOGGLE_OFF')` when the sound toggle is switched
    - Call `play('SELECT')` when a sound kit is selected
    - Call `play('OPEN')` when any category management bottom sheet opens
    - Call `play('CLOSE')` when any category management bottom sheet closes
    - Call `play('BUTTON')` on confirm actions (rename, remove, merge)
    - Call `play('CAUTION')` when a category operation error occurs
    - _Requirements: 8.3_

  - [x] 13.6 Wire sound into text inputs across the app
    - In `EditDrawer` (`src/components/ui/edit-drawer.tsx`): call `play('TYPE')` on `onChange` of the content `<textarea>` and the custom category `<input>`
    - In `CreateWidgetSheet` (dashboard): call `play('TYPE')` on `onChange` of the prompt `<input>` and answer `<input>` fields
    - _Requirements: 8.3_

- [x] 14. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Write property-based tests for all 15 correctness properties
  - [x] 15.1 Create test file `src/__tests__/ui-ux-overhaul.test.ts` and set up fast-check imports
    - Import `fc` from `fast-check` and any rendering utilities needed
    - Tag each test with `// Feature: ui-ux-overhaul, Property N: <property text>`
    - _Requirements: all_

  - [ ]* 15.2 Write property test: no Lucide imports in migrated files
    - **Property 1: No Lucide imports in migrated files**
    - Use `fc.constantFrom` over the list of migrated files under `src/app/miniapp/` and `src/components/ui/`
    - Assert each file's source text does not match `/from ['"]lucide-react['"]/`
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 15.3 Write property test: category badge contrast ratio ≥ 4.5:1
    - **Property 7: Category badge contrast ratio ≥ 4.5:1**
    - Use `fc.constantFrom(...COLOR_PALETTE)` from `edit-drawer.tsx`
    - Compute WCAG contrast between the text color hex and the effective background (translucent badge over card surface `#151B2B`)
    - Assert contrast ≥ 4.5
    - **Validates: Requirements 3.5, 7.1**

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical boundaries
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases
- The `snd-lib` dynamic import must always be inside a `pointerdown` handler or equivalent user-gesture callback — never at module load time
- The `uncategorized` constraint is enforced both server-side (API routes return 400) and client-side (no action buttons rendered) for defence in depth
- All icon replacements use the Lucide → Material Symbols mapping table documented in `src/components/ui/icon.tsx`
