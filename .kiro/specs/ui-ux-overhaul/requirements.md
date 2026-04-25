# Requirements Document

## Introduction

This document specifies the requirements for a comprehensive UI/UX overhaul of the Memo Telegram Mini App (Next.js 14 + Tailwind CSS). The overhaul covers six areas: icon system migration to Google Material Symbols Rounded, a redesigned pill-style bottom navigation bar, a true chronological timeline feed, enhanced settings with category management controls, the promotion of the Retrospective page to a first-class "Insights" tab, and a full interaction sound design system using the `snd-lib` library (SND02 "piano" kit by default). All changes must meet WCAG AA colour-contrast requirements and maintain full keyboard/screen-reader accessibility.

## Glossary

- **App**: The Memo Telegram Mini App running inside Telegram WebApp.
- **Tab_Bar**: The bottom navigation component rendered in `src/app/miniapp/layout.tsx`.
- **Feed_Page**: The main/home page at `src/app/miniapp/page.tsx` (route `/miniapp`).
- **Widgets_Page**: The page at `src/app/miniapp/dashboard/page.tsx` (route `/miniapp/dashboard`), currently labelled "Дашборд".
- **Graph_Page**: The page at `src/app/miniapp/graph/page.tsx` (route `/miniapp/graph`).
- **Insights_Page**: The page at `src/app/miniapp/reports/page.tsx` (route `/miniapp/reports`), currently labelled "Звіти / Ретроспектива".
- **Settings_Page**: The page at `src/app/miniapp/settings/page.tsx` (route `/miniapp/settings`).
- **Material_Symbols**: The Google Material Symbols Rounded icon font/library.
- **Pill_Tab_Bar**: A floating, rounded-pill-shaped bottom navigation bar with a dark background.
- **Timeline**: A vertically scrolling list of entries grouped by date, with date-header separators and a connecting vertical line.
- **Category**: A user-defined or system-defined label attached to one or more entries, stored in the `categories` table.
- **Uncategorized**: A locked system category that receives entries when their original category is removed or merged away. It cannot be renamed, deleted, or used as a merge source.
- **Entry**: A single user journal record stored in the `entries` table.
- **WCAG_AA**: Web Content Accessibility Guidelines 2.1 Level AA — minimum 4.5:1 contrast ratio for normal text, 3:1 for large text and UI components.
- **snd-lib**: The open-source JavaScript UI sound library from [snd.dev](https://snd.dev), installed via `npm install snd-lib`. Provides named sound constants (`Snd.SOUNDS.*`) and kit switching (`Snd.KITS.SND01/02/03`).
- **Sound_Kit**: One of three available snd-lib audio kits — SND01 "sine" (simple sine waves), SND02 "piano" (Steinway grand piano, default), SND03 "industrial" (factory machine sounds).
- **Sound_Event**: A named interaction moment mapped to a `Snd.SOUNDS.*` constant — e.g., TAP, BUTTON, TOGGLE_ON, TOGGLE_OFF, SLIDE, SELECT, OPEN, CLOSE, PROCESSING, TYPE, NOTIFICATION, CAUTION, CELEBRATION, ALERT.

---

## Requirements

### Requirement 1: Icon System Migration to Google Material Symbols Rounded

**User Story:** As a user, I want all icons in the app to look visually consistent, so that the interface feels polished and cohesive.

#### Acceptance Criteria

1. THE App SHALL load the Google Material Symbols Rounded icon font via a single shared import (e.g., a CSS `@import` or a `<link>` tag in the root layout), so that no page fetches the font independently.
2. WHEN any icon is rendered in the App, THE App SHALL use a Material Symbols Rounded glyph in place of the corresponding Lucide React icon, preserving the same semantic meaning and label.
3. THE App SHALL replace every Lucide React icon import across all files in `src/app/miniapp/` and `src/components/ui/` with the equivalent Material Symbols Rounded glyph.
4. WHERE a direct Material Symbols equivalent does not exist for a Lucide icon, THE App SHALL use the closest semantically matching Material Symbols Rounded glyph and document the mapping in a comment.
5. THE App SHALL expose a shared `<Icon name="..." size={n} className="..." />` wrapper component so that all icon usages go through a single abstraction.
6. WHEN an icon is used as an interactive control (button, link), THE App SHALL provide an `aria-label` attribute with a descriptive Ukrainian-language string, meeting WCAG_AA requirements.
7. THE App SHALL maintain all existing icon labels (tab bar labels, button tooltips) unchanged after migration.

---

### Requirement 2: Pill-Style Bottom Navigation Bar

**User Story:** As a user, I want a modern floating pill-shaped tab bar, so that navigation feels native and visually distinct from the content.

#### Acceptance Criteria

1. THE Tab_Bar SHALL render as a horizontally centred, floating pill with rounded corners (`border-radius` ≥ 28 px), a dark semi-transparent background, and a subtle shadow, positioned above the device safe-area bottom inset.
2. THE Tab_Bar SHALL contain exactly four tabs in this order: Стрічка (Feed), Віджети (Widgets), Графік (Graph), Інсайти (Insights).
3. WHEN a tab is active, THE Tab_Bar SHALL visually distinguish the active tab using a filled/highlighted pill segment or icon colour change that meets WCAG_AA contrast (≥ 3:1 against the pill background).
4. THE Tab_Bar SHALL NOT include a fifth "Профіль" tab; the Settings page SHALL remain accessible via a settings icon button rendered in the header of the Feed_Page or another appropriate in-page location.
5. THE Tab_Bar SHALL use Material Symbols Rounded icons for each tab: `home` (Стрічка), `widgets` (Віджети), `show_chart` (Графік), `lightbulb` (Інсайти).
6. WHEN the user taps a tab, THE Tab_Bar SHALL navigate to the corresponding route without a full page reload, preserving scroll position of the previously active tab.
7. THE Tab_Bar SHALL respect the Telegram WebApp `safeAreaInset.bottom` value so that the pill does not overlap the device home indicator.
8. WHEN rendered on a screen narrower than 360 px, THE Tab_Bar SHALL remain fully visible and tappable with a minimum touch target of 44 × 44 px per tab.
9. THE Tab_Bar SHALL provide `role="navigation"` and `aria-label="Головна навігація"` for screen-reader accessibility.

---

### Requirement 3: Feed Page as Chronological Timeline

**User Story:** As a user, I want the Feed page to look like a true chronological timeline, so that I can easily scan my entries by date and understand the flow of my day.

#### Acceptance Criteria

1. THE Feed_Page SHALL group entries by calendar date (UTC+3 local time) and render a date-header separator between each group, displaying the full date in Ukrainian locale (e.g., "14 липня 2025").
2. WHEN entries from the same date are rendered, THE Feed_Page SHALL display a continuous vertical line connecting the date-header dot to the last entry in that group, creating a visual timeline spine.
3. THE Feed_Page SHALL render each entry card with a left-aligned dot or node on the timeline spine, visually anchoring the card to its position in time.
4. WHEN the Feed_Page title is displayed, THE Feed_Page SHALL show "Стрічка" as the page heading.
5. THE Feed_Page SHALL apply colour tweaks to entry cards so that category badge colours meet WCAG_AA contrast (≥ 4.5:1 for text, ≥ 3:1 for badge borders) against the card background.
6. WHEN the Feed_Page is in normal (non-select) mode, THE Feed_Page SHALL display a settings icon button in the page header that navigates to the Settings_Page.
7. THE Feed_Page SHALL preserve all existing functionality: swipe-to-delete, long-press multi-select, category filter bar, thread grouping, and entry editing via EditDrawer.
8. IF no entries exist for the current filter, THEN THE Feed_Page SHALL display an empty-state message centred on the screen with a descriptive Ukrainian-language string.

---

### Requirement 4: Widgets Page Rename and UI Refresh

**User Story:** As a user, I want the Dashboard page to be renamed "Widgets" and have a modern, mindful UI, so that the page feels intentional and easy to use.

#### Acceptance Criteria

1. THE Widgets_Page SHALL display "Віджети" as its page heading and tab label everywhere in the App (tab bar, page title, any breadcrumbs or back-navigation labels).
2. THE Widgets_Page SHALL render metric widget cards with sufficient padding, rounded corners (≥ 12 px), and a subtle elevation (box-shadow) that meets the existing design system's `shadow-card` token.
3. WHEN a metric widget card is rendered, THE Widgets_Page SHALL display the metric icon, value, unit, and label with a minimum font size of 14 px for the value and 12 px for the label, meeting WCAG_AA contrast.
4. THE Widgets_Page SHALL preserve all existing functionality: date-range filter, goals tab, metric drill-down drawer, metric edit sheet, and custom widget creation.
5. WHEN the Widgets_Page is empty (no metrics for the selected range), THE Widgets_Page SHALL display a mindful empty-state illustration or icon with a short Ukrainian-language motivational message.
6. THE Widgets_Page SHALL use Material Symbols Rounded icons for all metric icons, falling back to the `tag` glyph for unknown metric keys.

---

### Requirement 5: Settings Page — Category Management Controls

**User Story:** As a user, I want to rename, remove, and merge my categories from the Settings page, so that I can keep my category list clean and organised without losing any entries.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a "Категорії" section listing all user-created and built-in categories fetched from `/api/categories`.
2. WHEN a non-locked category row is tapped, THE Settings_Page SHALL open an inline or bottom-sheet editor that allows the user to rename the category label (Ukrainian display name).
3. WHEN the user confirms a category rename, THE Settings_Page SHALL call `PATCH /api/categories` with the updated `label_ua` and reflect the new name immediately in the list without a full page reload.
4. WHEN a non-locked category row displays a remove action and the user confirms removal, THE Settings_Page SHALL call `DELETE /api/categories` for that category and all entries previously assigned to it SHALL be reassigned to the Uncategorized category via a server-side operation.
5. THE Settings_Page SHALL provide a merge action for non-locked categories that allows the user to select a target category; WHEN confirmed, THE Settings_Page SHALL call `POST /api/categories/merge` with `{ source, target }` and all entries from the source category SHALL be reassigned to the target category, after which the source category SHALL be deleted.
6. THE Uncategorized category SHALL be visually marked as locked (e.g., a lock icon) and THE Settings_Page SHALL NOT render rename, remove, or merge-source actions for it.
7. WHEN the Uncategorized category row is rendered, THE Settings_Page SHALL display a tooltip or subtitle explaining that it is a system category that cannot be modified.
8. IF a category removal or merge operation fails, THEN THE Settings_Page SHALL display an inline error message in Ukrainian and leave the category list unchanged.
9. THE Settings_Page SHALL require a confirmation step (bottom sheet or inline confirm) before executing any destructive category operation (remove or merge).
10. THE Settings_Page SHALL preserve all existing functionality: passcode setup, lock timer, and subscription link.
11. THE Settings_Page SHALL display a "Звук" (Sound) section with a toggle to enable or disable interaction sounds globally. WHEN the toggle is OFF, THE App SHALL not play any snd-lib sounds. WHEN the toggle is ON, THE App SHALL play sounds according to Requirement 8.
12. THE Settings_Page SHALL display a sound kit selector (SND01 "Sine", SND02 "Piano", SND03 "Industrial") that is only visible WHEN the sound toggle is ON. The default kit SHALL be SND02 "Piano". WHEN the user changes the kit, THE App SHALL immediately reload the snd-lib instance with the selected kit and persist the choice to `localStorage`.

---

### Requirement 6: Insights Tab (Retrospective Promotion)

**User Story:** As a user, I want the Retrospective page to be the primary "Insights" tab, so that reflective content is easy to find and feels like a core feature.

#### Acceptance Criteria

1. THE Insights_Page SHALL be accessible via the `/miniapp/reports` route and SHALL be labelled "Інсайти" in the Tab_Bar and as the page heading.
2. THE Tab_Bar SHALL place the Insights tab as the fourth (rightmost) tab, replacing the previous "Звіти" label with "Інсайти".
3. THE Insights_Page SHALL display the page heading "Інсайти" and a subtitle "Ретроспектива та аналіз" below it.
4. THE Insights_Page SHALL preserve all existing retrospective functionality: generating reports for preset and custom date ranges, viewing expanded report cards with retro sections, and deleting reports.
5. WHEN the Insights_Page is empty (no reports), THE Insights_Page SHALL display an empty-state with the lightbulb Material Symbols Rounded icon and a Ukrainian-language prompt to generate the first retrospective.
6. THE Insights_Page SHALL use Material Symbols Rounded icons in place of all Lucide icons currently used on the page (e.g., `FileText` → `description`, `Plus` → `add`, `Trash2` → `delete`, `ChevronDown` → `expand_more`).

---

### Requirement 7: WCAG AA Accessibility Compliance

**User Story:** As a user with visual or motor impairments, I want the app to meet accessibility standards, so that I can use it comfortably with assistive technologies.

#### Acceptance Criteria

1. THE App SHALL ensure all text elements have a colour-contrast ratio of at least 4.5:1 against their background (WCAG_AA normal text standard).
2. THE App SHALL ensure all large text (≥ 18 px regular or ≥ 14 px bold) and UI component boundaries (buttons, inputs, badges) have a colour-contrast ratio of at least 3:1 against their background.
3. WHEN an interactive element (button, link, tab) is focused via keyboard, THE App SHALL display a visible focus ring that meets WCAG_AA contrast requirements.
4. THE App SHALL provide `aria-label` or visible text labels for all icon-only interactive controls.
5. THE App SHALL ensure all form inputs have associated `<label>` elements or `aria-label` attributes.
6. THE Tab_Bar SHALL use `role="navigation"` and each tab link SHALL use `aria-current="page"` when active.
7. THE App SHALL not rely solely on colour to convey information; active states, errors, and category distinctions SHALL also use shape, text, or icon differences.

---

### Requirement 8: Interaction Sound Design (snd-lib)

**User Story:** As a user, I want the app to play subtle, tasteful sounds on interactions, so that the interface feels alive and responsive beyond just visuals.

#### Acceptance Criteria

1. THE App SHALL install `snd-lib` (npm package `snd-lib`) and initialise a single shared `Snd` instance in a React context (`SoundContext`) available to all pages and components.
2. THE App SHALL default to SND02 "piano" kit on first launch. The selected kit SHALL be persisted in `localStorage` under the key `memo_sound_kit` and restored on subsequent loads.
3. WHEN the user has sound enabled, THE App SHALL play the following Sound_Events mapped to the corresponding `Snd.SOUNDS.*` constants:

   | Interaction | `Snd.SOUNDS` constant |
   |---|---|
   | Tap / generic touch on non-interactive surface | `TAP` (random 1–5) |
   | Button press (primary action) | `BUTTON` |
   | Disabled button press | `DISABLED` |
   | Toggle switch ON | `TOGGLE_ON` |
   | Toggle switch OFF | `TOGGLE_OFF` |
   | Tab bar navigation tap | `SLIDE` (random 1–5) |
   | Category filter chip select | `SELECT` |
   | Bottom sheet / modal open | `OPEN` |
   | Bottom sheet / modal close | `CLOSE` |
   | Loading / processing spinner start | `PROCESSING` (looped) |
   | Text input keystroke | `TYPE` (random 1–5) |
   | In-app notification / toast appear | `NOTIFICATION` |
   | Error / caution state | `CAUTION` |
   | Entry saved / goal achieved / report generated | `CELEBRATION` |
   | Passcode lock alert (looped until dismissed) | `ALERT` (looped) |

4. THE App SHALL expose a `useSound()` hook that returns `{ play(sound: string): void, enabled: boolean, kit: string }` so any component can trigger a sound without importing snd-lib directly.
5. WHEN `enabled` is `false` (sound toggled off in Settings), THE `play()` function SHALL be a no-op and no audio SHALL be emitted.
6. THE App SHALL initialise the snd-lib audio context on the first pointer interaction inside the app (as required by browser autoplay policy), not on page load.
7. WHEN the user changes the sound kit in Settings, THE App SHALL call `snd.load(Snd.KITS.SND0X)` with the newly selected kit and persist the choice; subsequent `play()` calls SHALL use the new kit without requiring a page reload.
8. THE App SHALL NOT play sounds during server-side rendering; all snd-lib initialisation SHALL be guarded by `typeof window !== 'undefined'`.
9. WHEN the `PROCESSING` or `ALERT` sound is looped, THE App SHALL stop the loop as soon as the triggering condition resolves (loading complete, passcode dismissed).
