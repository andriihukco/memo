# UI Revamp: shadcn-only, two themes, 2026 mobile flows

Date: 2026-10-24
Status: Draft, pending user review

## Goal

Rebuild the Memo Mini App UI to a design-led, award-level standard:

- shadcn/ui is the only component foundation.
- Exactly two palettes, light and dark. They follow the system by default, with a manual override.
- Flows follow 2026 iOS (HIG) and Android (Material 3) conventions.
- Users can write entries inside the app.

All existing features, the backend, the bot and the 11-language i18n stay.

## Decisions Already Made

- **Platforms.** One design for the Telegram Mini App and the standalone web app. The app draws its own chrome. Telegram APIs (BackButton, haptics, theme, header colours, vertical-swipe lock) are used only when present. The Telegram MainButton is not used.
- **Themes.** Light / Dark / System. The default is System. Inside Telegram, "System" means Telegram's `colorScheme`.
- **Compose.** In-app text and voice entry, using the same AI pipeline as the bot.
- **Navigation.** Three tabs (Journal · Insights · You) with a raised center ＋ (Compose).
- **Look.** Calm and editorial: zinc neutrals, one accent, content first.
- **Onboarding.** No paywall. The trial is offered after the first report.
- **Out of scope:**
  - Moving routes from `/miniapp` to `/app` (that belongs to the web-auth spec).
  - Changing bot behaviour.
  - New analytics.

## Audit Findings This Spec Fixes

These come from the read-only audit of 2026-10-24.

**Design system**
- There is no `components.json`. Only 4 of the 24 `src/components/ui` files are shadcn.
- There are 5 hand-made sheet implementations, built on framer-motion.
- Icons come from a Material Symbols font, which breaks the lucide rule.
- About 300 arbitrary Tailwind values, mostly `text-[Npx]`. Hex colours are inlined in the tab bar, reports and graph.
- `design-tokens.ts`, `ios-action-sheet.tsx`, `chip.tsx`, `tabs.tsx` and `lock-button.tsx` are unused. So are the `@telegram-apps/telegram-ui` and `snd-lib` packages.

**Theme**
- Dark values live in `:root` with a `.light` override, which is the inverse of the shadcn convention.
- No UI lets the user switch themes.
- Light-mode users see the dark theme flash on load.
- Many components are hardcoded dark.
- Telegram `themeParams` are ignored.

**Accessibility**
- Contrast fails:
  - White on primary in light mode: 3.63.
  - Destructive text: 3.6–4.1 in both themes.
  - The focus ring: 1.8–2.2.
  - `muted-foreground/40–70`, used 22 times: 1.7–3.2.
- 85 text sizes are under 12px.
- No sheet has dialog semantics or a focus trap.
- 13 clickable divs.
- framer-motion ignores reduced motion.

**Flows**
- Users cannot create an entry in the app.
- Undo runs after the server delete has already happened. Delete behaves differently on each screen.
- Categories cannot be reached from anywhere.
- Onboarding is about 11 screens and ends in a paywall. It exists in 3 copies.
- The Graph tab is a paywall dead end for free users.
- Report detail is not a route.
- There is no offline state, and the auth error has no Retry.
- About 160 strings are hardcoded in Ukrainian or English.
- Dates are hardcoded to `uk-UA` and UTC+3.
- There is no plural support.

## Architecture

### 1. Foundation

**Setup**
- Add `components.json`: new-york style, zinc base colour, CSS variables, aliases `@/components`, `@/components/ui`, `@/lib/utils`. Use the shadcn CLI version that supports Tailwind 3 (`shadcn@2.1.x`). Tailwind stays on v3.4.
- Add `tailwindcss-animate`, `next-themes`, `vaul`, `sonner`, and the Radix packages the components need.

**Components to add (official shadcn source):** button, card, badge, drawer, dialog, alert-dialog, sonner, tabs, toggle, toggle-group, switch, select, input, textarea, label, form, progress, skeleton, alert, avatar, calendar, popover, command, input-otp, dropdown-menu, context-menu, separator, scroll-area, chart.

Customisation happens through variants and tokens only. App behaviour such as haptics lives in thin wrappers outside `components/ui`.

**Removals**
- Material Symbols becomes lucide. Delete `icon.tsx` and the font link.
- Remove Comfortaa and Mulish.
- Delete the unused components, `design-tokens.ts`, and the `@telegram-apps/telegram-ui` and `snd-lib` packages.
- Remove `framer-motion` after Phase 1. Sheets move to vaul, toasts to Sonner, and transitions to CSS plus the View Transitions API, with a no-op fallback.
- Remove the global `button { min-height: 44px }` rule. Sizes come from the button variants instead (default 44px tall, icon 44×44).
- Remove the global `* { transition }` rule.

**Themes**
- `next-themes` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, and the `.dark` class.
- A small `TelegramThemeBridge` handles three things:
  - When the user's choice is System and Telegram is present, it resolves to `Telegram.WebApp.colorScheme` and listens to `themeChanged`.
  - It calls `setHeaderColor` and `setBackgroundColor` with the current `--background`.
  - It updates `<meta name="theme-color">` for each theme.
- Rewrite `src/lib/theme-provider.tsx` on top of next-themes. There is no flash, because next-themes injects an inline script.
- Persist the theme choice to `profile.settings.theme` so it follows the user across devices, with `localStorage` as a cache.

**Tokens (`globals.css`, HSL, `:root` = light, `.dark` = dark)**
- Neutrals: shadcn zinc.
- Accent `--primary`: a deep indigo-blue. Required: text on it ≥ 4.5:1, and the accent used as text on the background ≥ 4.5:1, in both themes. Starting points are about `234 62% 52%` for light and `234 89% 72%` for dark (with dark foreground text); tune them until the ratios pass.
- `--destructive` must reach ≥ 4.5:1 as text in both themes. The same applies to the new `--success` and `--warning` tokens and their `-foreground` pairs.
- `--border` is for decorative dividers. `--input` is for control edges and must reach ≥ 3:1. `--ring` is opaque `--primary` (≥ 3:1).
- `--chart-1…5` are tuned for each theme.
- `--cat-1…12` are category hues. Categories show them only as tints (`hsl(var(--cat-n) / 0.12)` background, solid dot or icon). `getCategoryColor` maps a category to an index. The D3 graph reads the same variables.
- `--radius: 0.75rem`.
- No glass, glow or gradients. The one exception is the tab bar: `bg-background/80 backdrop-blur`.
- **Lint rule:** ban `text-[`, `bg-[#`, `#hex` in TSX, `muted-foreground/` with an opacity, and `style={{ color|background }}`. Enforce it with an ESLint `no-restricted-syntax` regex, or a vitest that greps `src/app` and `src/components`. Exempt: `confetti.tsx`, `splash-screen.tsx`, and chart and graph code that reads CSS variables.

**Typography**
- Font: the system stack (`-apple-system, BlinkMacSystemFont, "SF Pro", Roboto, "Segoe UI", sans-serif`).
- Type ramp as Tailwind classes, with no arbitrary sizes. The minimum is `text-xs` (12px).

| Role | Classes |
|---|---|
| Large title | `text-3xl font-bold tracking-tight` |
| Title | `text-xl font-semibold` |
| Headline | `text-base font-semibold` |
| Body | `text-base` |
| Subhead | `text-sm` |
| Footnote | `text-xs text-muted-foreground` |

**Motion**
- Durations: 150ms for micro-interactions, 250ms for sheets (vaul). Everything is disabled under `prefers-reduced-motion`, and smooth scrolling is turned off under it too.

### 2. App shell (`src/app/miniapp/layout.tsx`, split up)

`layout.tsx` is 1,334 lines. Split it into:

- `src/components/shell/tab-bar.tsx`: Journal · ＋ · Insights · You.
  - Lucide icons, an active state that does not rely on colour alone (filled icon plus a label weight change), and `aria-current="page"`.
  - Safe-area bottom inset.
  - It stays visible when sheets open.
  - ＋ opens Compose.
- `src/components/shell/page-header.tsx`: a large title that collapses to an inline small title once the user scrolls past it (IntersectionObserver).
  - Props: `title`, `back?`, `actions?`, `children?` (for a segmented control or search).
  - Top safe-area aware.
  - Exactly one `<h1>` per screen.
- `src/components/shell/back.tsx`: a `useBack()` hook. Inside Telegram it shows `Telegram.WebApp.BackButton` wired to `router.back()`. Otherwise it renders a chevron in PageHeader. Browser history drives back, so swipe-back and Android predictive back work.
- `src/components/shell/boot.tsx`:
  - The splash shows until auth resolves, with no minimum. It stays at most 400ms if auth is instant, to avoid a flash.
  - The auth error screen has a localised message and a Retry button.
  - Then onboarding (first run), then the passcode lock if enabled.
- `src/components/shell/offline-banner.tsx`: listens to `navigator.onLine` and shows an Alert-style bar. Mutations are disabled while offline, with an explanation.
- `src/lib/telegram.ts`: one typed accessor for `window.Telegram.WebApp`. It replaces the unused `use-telegram-adapter.ts` and the scattered globals. While a Drawer is open it calls `disableVerticalSwipes`, and it restores them on close.

**Routes**

| Route | Screen |
|---|---|
| `/miniapp` | Journal |
| `/miniapp/entry/[id]` | Entry |
| `/miniapp/insights` | Insights (segment in `?view=overview\|reports\|graph`, default overview) |
| `/miniapp/insights/reports/[id]` | Report detail |
| `/miniapp/you` | You |
| `/miniapp/you/plan` | Plan & usage |
| `/miniapp/you/categories` | Categories |
| `/miniapp/you/privacy` | Privacy |

- The old routes `/miniapp/dashboard`, `/graph`, `/reports`, `/settings`, `/subscriptions` and `/categories` redirect to the new ones in `next.config.mjs`. That keeps bot deep links working.
- Delete `/miniapp/onboarding`, the orphaned duplicate.

### 3. Shared patterns (`src/components/patterns/`)

| Need | One pattern |
|---|---|
| Any bottom sheet | shadcn `Drawer`, with detents through vaul `snapPoints` where useful. It always has a `DrawerTitle` (visually hidden if needed), and inner scroll does not fight the drag. |
| Irreversible confirm | `AlertDialog`: account deletion, and passcode reset if the passcode is forgotten. |
| Reversible destroy (entries, widgets, categories, graph nodes) | No confirm. Optimistic removal, then a Sonner toast "Deleted · Undo". The server call fires after 5s, or immediately if the page is hidden. Helper: `src/lib/deferred-action.ts` (`schedule(key, commit, rollback)`, `undo(key)`, `flush()` on `visibilitychange` and `pagehide`). |
| Feedback | Sonner only, at the top on mobile. Toasts with a `role="status"` live region. |
| Multi-select | A visible "Select" item in the header ⋯ menu, plus long-press. A bottom action bar shows the count. Selection shows a checkbox, not only a border colour. |
| Row secondary actions | `ContextMenu` on long-press / right-click, mirrored by the ⋯ `DropdownMenu` on the detail screen. No action exists only as a gesture. |
| Segmented control | `Tabs` (for views) or `ToggleGroup` (for values). |
| Lists / settings | `ListGroup` (inset grouped Card) + `ListRow`. Props: `icon`, `label`, `value?`, `href?` / `onClick?`, `trailing?` (Switch, Badge, chevron), `destructive?`. Rendered as a `<button>` or `<Link>`, never a clickable div. |
| Empty state | `EmptyState`: icon, title, one sentence, one primary action. Built from Card and Button. |
| Loading | shadcn `Skeleton` in the shape of the real content. |
| Error | `Alert variant="destructive"` with what happened, what to do, and a Retry button. |
| Paywall | `PaywallDrawer`, the only upgrade surface (§4.6). |

### 4. Screens and flows

#### 4.1 Journal (`/miniapp`)

**Header**
- PageHeader titled "Journal".
- Actions: Search (expands an `Input` below the title, filtering client-side over loaded entries plus a server `q` parameter) and a ⋯ menu (Select, Filter by category).
- The filter opens a Drawer with category toggles.
- The active filter shows as a dismissible Badge row under the header.

**List**
- Grouped by local day, with sticky headers "Today", "Yesterday", or a weekday plus date via `Intl.DateTimeFormat(locale, { timeZone })`.
- Each row shows the time, a 3-line text clamp, a category tint badge, and up to 3 metric pills.
- Rows for entries still processing show a "Processing…" skeleton line.
- A thread renders as one row with a stacked edge and a "3 messages" footnote; tapping it opens the entry screen in thread mode.
- Infinite scroll keeps the existing cursor API.

**Gestures**
- Tap a row to open `/miniapp/entry/[id]`.
- Swipe left to reveal Delete. A full swipe deletes.
- Long-press opens the ContextMenu (Edit, Copy text, Select, Delete).
- Pull to refresh, through a small custom hook on touch events. It is disabled when the list is not at the top.

**States**
- Skeleton list while loading.
- Error Alert with Retry.
- Empty: "Write your first entry" → Compose.
- Filtered empty: "No entries in {category}" → Clear filter.
- End of list: footnote.

**Bugs fixed**
- The filter now matches comma-separated categories.
- Dates use the user's locale and timezone (`profile.settings.timezone`, falling back to `Intl.DateTimeFormat().resolvedOptions().timeZone`).
- Goal progress uses real values from the existing aggregate helper.
- Undo goes through `deferred-action`.

#### 4.2 Entry (`/miniapp/entry/[id]`)

- PageHeader with back, and a ⋯ menu (Edit, Copy, Delete).
- Body: the full text, category (editable with a Select), metrics (editable Inputs), time, and source (bot / app / voice).
- Memo's reply, if one exists, sits in a muted Card titled "Memo".
- Thread mode lists the messages in order.
- Edit is inline:
  - The Save button appears only when the entry has changed.
  - Leaving with unsaved changes asks "Discard changes?" in a Drawer.
- Delete pops back to Journal and shows the Undo toast.
- This screen replaces `edit-drawer.tsx`. Its icon and colour data move to `src/lib/categories.ts`.

#### 4.3 Compose (the center ＋)

**The sheet**
- A Drawer with snap points `[0.6, 1]` that opens at 1.
- A Textarea that grows with its text and is autofocused. The placeholder is the localised "What's on your mind?", and there is a visible label for screen readers.
- Footer: a mic button and a Send button. Send is disabled while the text is empty or the app is offline.
- Voice is tap to start and tap to stop. It shows the elapsed time and a level meter (an `AnalyserNode`). Cancel discards. It reuses `components/features/voice/voice-recorder.tsx`, rebuilt on the new tokens. If the microphone permission is denied, an inline Alert explains how to enable it.

**Draft**
- The draft is saved to `localStorage` (key `memo:draft`) on every change and cleared after a successful send.
- Dismissing with text keeps the draft. The ＋ then shows a dot to say a draft exists.

**After Send**
1. The Drawer closes. If the user is not on Journal, the app navigates there.
2. An optimistic row with the "Processing…" state appears at the top.
3. When the server returns, the row is replaced with the real entry.
4. On failure, the row shows "Couldn't save" with Retry, and the draft is restored.

**Backend**
- `src/lib/ingest.ts`: `ingestEntry({ userId, text, source: 'bot'|'app'|'voice', locale, replyToEntryId? })`.
  - It returns `{ entries, reply, kind: 'entry'|'question'|'action'|'smalltalk' }`.
  - It is extracted from `src/lib/bot/handlers/text.ts`: classify, category upsert, encrypt, insert, embed, smart reply, memory extraction. It has no grammY dependency.
  - The bot handler becomes a thin adapter that calls `ingestEntry` and sends the reply. Behaviour stays identical, and the existing bot tests must pass unchanged.
- `POST /api/entries/compose`
  - Body: `{ text: string(1..4000), replyToEntryId? }`.
  - Runs auth, origin check, rate limit and the tier entry limit, the same guards as `POST /api/entries`.
  - Returns the `ingestEntry` result.
  - When `kind` is `question` or `smalltalk`, nothing is stored and the Drawer shows Memo's answer inline instead of closing.
- `POST /api/entries/compose/voice`
  - multipart `audio` (≤ 60s, ≤ 2MB).
  - Transcribes with the same Gemini path as `src/lib/bot/handlers/voice.ts` (extracted to `src/lib/transcribe.ts`), then calls `ingestEntry` with `source: 'voice'`.
- Both routes have vitest coverage: validation, auth, limit reached (402 with a paywall reason), the `question` path, and bot parity.

#### 4.4 Insights (`/miniapp/insights`)

**Header**
- PageHeader "Insights", with children: `Tabs` for Overview · Reports · Graph, and a period control.
- The period control is a `ToggleGroup` (Day · Week · Month) plus a Custom button that opens a Calendar in range mode inside a Drawer.
- Period and view are kept in the URL search params, so back/forward and deep links work.

**Overview** (from the dashboard)
- A grid of metric Cards using shadcn `Chart` (Recharts) with `--chart-*` tokens. They replace the hand-made bars.
- A "Goals" section on the same page shows Progress bars with the real current values. It is no longer a hidden title toggle.
- The "Add widget" button sits in the header only, with `create-widget-sheet.tsx` rebuilt on Drawer + Form. The duplicate dashed tile goes.
- Tapping a card drills down to that metric's entries, through a Drawer listing them.
- Long-press or ⋯ opens Edit / Remove (remove has Undo).
- The custom-widget "Log value" Drawer stays, rebuilt.
- The Ukrainian-only "Дякуємо!" overlay is replaced by a localised success toast. Confetti stays only for the first goal reached.

**Reports**
- A list of `ListRow`s showing the period, type and date. A row is a skeleton while it generates; generation keeps the global context.
- The header action "New report" opens a Drawer with presets.
- Paid presets show a plan Badge. Tapping one opens `PaywallDrawer` with reason `report_preset`.
- Load errors show an Alert with Retry.
- The detail route `/miniapp/insights/reports/[id]` has a ⋯ menu with Share (keeps `html-to-image` and `shareToStory`, with text fallback) and Delete with Undo.
- Report delete needs `DELETE /api/reports?id=`. If it does not exist, add it, using the same guards as the entry routes.
- After a free user's first report is generated, a one-time inline Card offers the trial ("Like this? Try Pro free for N days"). It is shown once, tracked in `profile.settings`.

**Graph**
- Keeps D3, colours from CSS variables, and re-reads them on theme change.
- Free users see a blurred, non-interactive render of their real graph, with one inline upgrade Card (→ `PaywallDrawer` reason `graph`). There is no full-screen overlay.
- Tapping a node opens a Drawer with the entry preview, Open entry, and Delete with Undo.
- The date-filter long-press gesture goes. The page uses the shared period control.
- Keyboard: nodes are not focusable. An "Entries in view" list button gives a non-visual alternative.

#### 4.5 You (`/miniapp/you`)

**Header**
- PageHeader "You". A profile Card shows the Avatar (Telegram photo or initials), name, handle if set, plan Badge, and streak.

**ListGroups**
1. **Plan & usage** → `/you/plan`. It shows a usage bar once usage passes 80%.
2. **Categories** → `/you/categories`.
3. **Appearance**: a `ToggleGroup` with Light · Dark · System.
4. **Language**: a Select with all 11 locales, each shown in its own name.
5. **Sound**: a Switch.
6. **Privacy** → `/you/privacy`: passcode on/off, change passcode via InputOTP in a Drawer with set and confirm steps, auto-lock as a Select, and export data (keeps the existing export routes).
7. **Invite friends**: share sheet and copy link.
8. **Help**: link to the support chat.
9. **About**: version, and "Replay intro".
10. **Delete account** (destructive row): an AlertDialog where the user types the localised word for "DELETE" to confirm.

**Plan** (`/you/plan`)
- Replaces `subscriptions/page.tsx`.
- Current plan Card and usage Progress bars.
- Plan comparison with a `ToggleGroup` for the billing period.
- The Stars purchase uses the existing `openInvoice` flow, plus a trial CTA if the user is eligible.
- Confetti on successful purchase.
- It uses `PaywallDrawer` content in page form, so it does not duplicate the paywall.

**Categories** (`/you/categories`)
- Moved from `/miniapp/categories` and fully localised.
- Rename via Drawer + Input, merge via Drawer + Command picker, delete with Undo.

#### 4.6 Paywall (`src/components/patterns/paywall-drawer.tsx`)

- **Props:** `open`, `onOpenChange`, `reason: 'entry_limit'|'report_preset'|'graph'|'widget_limit'|'trial'`.
- **Contents:**
  - A headline that depends on the reason (for example "You've used all 300 entries this month").
  - A 3-row benefit list.
  - The billing-period ToggleGroup.
  - One primary CTA ("Continue with ⭐ N"), plus "Start free trial" if eligible.
  - "Not now".
- **Where it opens:** a 402 limit response from the API, a locked preset, the Graph upgrade Card, and the trial offer after the first report. Every trigger passes the correct `trialUsed`.
- It replaces `paywall-modal.tsx`.
- The usage chips and banners on Journal and Overview are removed. Usage shows only in You → Plan, plus one Alert at the top of Journal once usage is ≥ 80%.

#### 4.7 Onboarding (`src/components/shell/onboarding.tsx`, single copy)

Three steps in one full-screen flow, with a progress indicator ("1 of 3"). Back and Next buttons are always visible; swiping is optional.

1. **Welcome.** Logo, a one-line value proposition, and the language Select (preselected from Telegram `language_code` or `navigator.language`).
2. **How it works.** One screen with three short rows: "Write or speak anything", "Memo sorts it", "See patterns in Insights".
3. **First entry.** The Compose textarea embedded inline, with an example placeholder. "Save my first entry" sends through `ingestEntry` and lands on Journal with the entry visible. "Skip" also lands on Journal.

- There is no passcode and no paywall step.
- "Replay intro" in You → About reuses this component.
- Completion is stored as `profile.settings.onboarded = true`, as today.

### 5. i18n

- **Strings.** Every user-facing string goes through `useI18n().t`. That includes aria-labels and the ~160 hardcoded strings the audit found (categories, dashboard, graph, feed, settings, edit-drawer, undo-toast, confirm-sheet, error-banner, passcode, and the layout auth error).
- **Plurals.** Add `tp(key, count, vars)` to `src/lib/i18n/context.tsx`. It uses `Intl.PluralRules(locale)`, with keys like `journal.entries.one`, `.few`, `.many`, `.other`.
- **Interpolation.** Make it replace all occurrences, not just the first.
- **Dates and numbers.** `src/lib/format.ts` provides `formatDay`, `formatTime`, `formatRelative` and `formatNumber`, all on `Intl` with the user's locale and timezone. The hardcoded `uk-UA` and UTC+3 go.
- **Process.** Phase 1 agents add keys to `en.json` and `uk.json`, namespaced by screen (`journal.*`, `compose.*`, `insights.*`, `you.*`, `paywall.*`, `onboarding.*`, `shell.*`). Phase 2 fills the other 9 locales.
- **Test.** A vitest checks that every key in `en.json` exists in all 11 catalogs and that no catalog has keys missing from `en`.

### 6. Accessibility acceptance (WCAG 2.2 AA)

- **Contrast.** Every token pair from §1 is measured by a vitest that parses `globals.css` and computes the ratios for both themes: text 4.5:1, large text and non-text 3:1.
- **Semantics.**
  - Every Drawer and Dialog has a title.
  - Focus is trapped and returned on close (Radix and vaul handle this).
  - There are no clickable divs; the lint test greps for `onClick` on `div` and `span`.
  - Icon-only buttons have localised `aria-label`s.
- **Size.**
  - Targets are at least 44×44 for primary controls and at least 24×24 everywhere.
  - Text is at least 12px.
- **Gestures.** Every gesture-only action has a visible alternative. Status messages are announced (Sonner and `role="status"`).
- **Motion.** Reduced motion is respected everywhere.
- **Reflow.** Layouts work at 320px width and 200% zoom.

## Build Plan Shape

The detailed plan comes from writing-plans after this spec is approved.

**Branch.** The revamp branch must start from a commit. This branch (`audit/p0-p1-fixes`) has 20 uncommitted files. Either commit them first, or start from `main`. This is decided before Phase 0.

**Phase 0: Foundation (one agent, serial).** Covers §1, §2 shell components, §3 patterns, `format.ts`, `tp`, `deferred-action.ts`, `telegram.ts`, the route skeletons and redirects, and the lint and contrast tests. It ends with the app compiling, all existing tests green, and both themes visible.

**Phase 1: Screens (six agents in parallel, each in its own worktree, separate file ownership).**

| Agent | Owns |
|---|---|
| A: Journal + Entry | `app/miniapp/page.tsx`, `app/miniapp/entry/**`, `lib/categories.ts` |
| B: Compose + ingest | `components/features/compose/**`, `components/features/voice/**`, `lib/ingest.ts`, `lib/transcribe.ts`, `app/api/entries/compose/**`, bot handler adapters, tests |
| C: Insights Overview + Reports | `app/miniapp/insights/page.tsx` (overview and reports views), `app/miniapp/insights/reports/**`, `components/features/dashboard/**`, `components/features/reports/**`, report delete API |
| D: Graph | `components/features/graph/**` (the Graph view rendered inside Insights) |
| E: You + Plan + Categories + Privacy + Paywall | `app/miniapp/you/**`, `components/patterns/paywall-drawer.tsx`, `components/features/you/**` |
| F: Onboarding + Boot + Passcode | `components/shell/onboarding.tsx`, `components/shell/boot.tsx`, `components/shell/passcode.tsx` |

- C owns `insights/page.tsx` and imports D's `GraphView` from a path that Phase 0 stubs.
- Each agent adds i18n keys only under its own namespace, in `en.json` and `uk.json`.

**Phase 2: Integration (lead plus one agent).**
- Merge the branches and resolve catalog merges.
- Fill the 9 remaining locales.
- Delete the old pages, components and `framer-motion`.
- Run `tsc --noEmit`, `next lint`, `vitest run` and `next build`.
- Browser-verify each screen at 390×844 and 320px in both themes, with keyboard pass, Telegram-absent mode and offline.

## Testing

- **Unit tests (vitest):**
  - `deferred-action`: commit after the timeout, undo, flush on hide.
  - `format`: locale and timezone.
  - `tp` plurals.
  - `getCategoryColor`.
  - `ingestEntry` with mocked classify, embed and Supabase.
  - The compose routes.
  - Contrast tokens.
  - Lint greps.
  - i18n key parity.
- **Existing tests stay green.** `ui-ux-overhaul.test.ts`, `usage-warning-banner.test.ts`, `graph-empty-state.test.ts` and `paywall.test.ts` assert old UI internals. They are updated to the new components where the behaviour is preserved, and deleted only where the behaviour is intentionally removed. Each deletion is listed in the PR.
- **Manual and browser checks** as in Phase 2.

## Risks

- **Bot regressions from the `ingestEntry` extraction.** Mitigated by keeping the existing bot tests unchanged and adding parity tests.
- **Recharts bundle size on the edge.** Charts are client components and are loaded lazily on the Overview view.
- **Merge conflicts in the i18n JSON catalogs.** Namespaced keys keep them line-local, and the lead resolves them in Phase 2.
- **Conversion impact from removing the onboarding paywall.** The post-first-report trial offer replaces it, and the existing PostHog events (`paywall_shown`, with a new `reason`) measure it.
