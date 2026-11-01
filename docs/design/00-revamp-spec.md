# Memo Design Revamp: Phase 1 Spec

Date: 2026-11-01
Status: Approved defaults (phasing, supersession, 3 tabs + centre compose, staging-first DB, cited tool evidence)
Supersedes: [docs/superpowers/specs/2026-10-24-ui-revamp-design.md](../superpowers/specs/2026-10-24-ui-revamp-design.md)
Reference audit: [docs/design-system/05-project-start-sheet.md](../design-system/05-project-start-sheet.md)

## 1. Scope by phase

| Phase | Deliverable | Status |
|---|---|---|
| 1 | Design system (tokens, motion, glass), shell on web, iOS and Android, existing features re-skinned | This spec. Code not started. |
| 2 | Voice memos, notes, location check-ins, mood ratings, reminders (data model, RLS, sync on all 3 platforms) | Needs Phase 1 tokens |
| 3 | 10–20 evidence-based tools, each with citations stored in Supabase | Needs Phase 2 data model |

Each phase ships on its own. Nothing in Phase 2 or 3 changes the Phase 1 shell.

## 2. Design direction

- **Look:** content first, one accent, glass surfaces for chrome only (tab bar, sheets, floating compose). Content cards stay opaque so text keeps contrast.
- **Motion:** spring physics (reanimated on native, framer-motion on web). Durations 180–320 ms. Shared-element morph from a card into its detail view. Reduce Motion (iOS) and Remove Animations (Android) turn motion off; the web uses `prefers-reduced-motion`.
- **Glass:** iOS uses `expo-glass-effect`. Android and web use a blur or translucent fallback (`backdrop-filter` on web). Glass must still pass 4.5:1 for text placed on it.
- **Themes:** light, dark and system, as in the 2026-10-24 spec. Colour values come from a single source (section 3).
- **Reference screenshots:** patterns only. Layout ideas taken: KPI tile row, template cards, a Voice / Photo / + compose action group, a mood chip row, and a bottom glass sheet. No brand, layout or copy is copied.

## 3. Tokens

Source of truth for colour in the native app: [mobile/src/theme/palettes.ts](../../mobile/src/theme/palettes.ts). Web: [src/app/globals.css](../../src/app/globals.css). Both sets must match. A parity test is a Phase 1 task.

Current native values (dark / light):

| Token | Dark | Light |
|---|---|---|
| bg | #090B12 | #F2F3F7 |
| card | #131722 | #FFFFFF |
| label | #F4F5F8 | #0B0D14 |
| secondary | #B4BBCB | #4A5268 |
| muted | #7D889F | #5B6478 |
| separator | #222838 | #D9DDE7 |
| tint | #4C8DFF | #1D4ED8 |
| destructive | #F87171 | #B91C1C |
| gold | #FACC15 | #92400E |

Contrast is already tested on both platforms:
- Native: [mobile/src/theme/__tests__/palettes.test.ts](../../mobile/src/theme/__tests__/palettes.test.ts) (text tokens, filled button, light and dark keys match).
- Web: [src/__tests__/contrast.test.ts](../../src/__tests__/contrast.test.ts) (`:root` and `.dark`).

Shared role map: [docs/design/tokens/color-map.json](tokens/color-map.json) links each role to its web variable and native key. [src/__tests__/token-map.test.ts](../../src/__tests__/token-map.test.ts) checks that both sides exist. It does not check values.

**Value drift: resolved 2026-11-01. The web palette is the single palette.** Native values in `palettes.ts` now match the web values. The table below is the drift as measured before the change:

| Role | Light web / native | Dark web / native |
|---|---|---|
| background | #FFFFFF / #F2F3F7 | #09090B / #090B12 |
| text | #09090B / #0B0D14 | #FAFAFA / #F4F5F8 |
| surface | #FFFFFF / #FFFFFF | #131316 / #131722 |
| text-muted | #5D5D65 / #5B6478 | #A4A4AD / #7D889F |
| separator | #E4E4E7 / #D9DDE7 | #27272A / #222838 |
| accent | #3948D0 / #1D4ED8 | #7885F7 / #4C8DFF |
| destructive | #C52020 / #B91C1C | #F15F5F / #F87171 |
| warning | #954D04 / #92400E | #F6A823 / #FACC15 |

Only `surface` matches. The web and native palettes are two different designs. Unifying them changes the look of one platform, so it needs a decision: which palette wins, or a new one for both.

Known gap: `muted` on `card` was 4.14:1 in the start sheet, below 4.5:1. The existing palette test checks it, so the new `muted` value must pass.

## 4. Platform parity (CLAUDE.md §1)

| Check | Web | iOS | Android | Gap today |
|---|---|---|---|---|
| Same screens and order | Yes | Yes | Design only | Android not verified on device |
| Touch target 44 / 44pt / 48dp | `min-h-11` | `TOUCH = 44` | Not verified | `TOUCH` unused in `(tabs)/index.tsx` |
| 16px inputs | Check | Check | Check | Not audited |
| Back on every screen | Yes | Edge swipe | System back | Not audited |
| i18n keys (en, uk) | `src/lib/i18n` | `mobile/src/i18n` | same | Not audited |

## 5. Checks run for this spec

- `mobile`: `npx tsc --noEmit` passes (exit 0).
- `mobile`: `npx expo lint` fails with 7 errors and 1 warning, all in committed baseline files (`glass-tab-bar.tsx` ×4, `onboarding.tsx`, `entry-store.tsx`, unused `TOUCH` in `(tabs)/index.tsx`). These are `react-hooks/immutability` and `set-state-in-effect` rule hits. They are fixed in Phase 1, not here.
- Web: not run (no web files changed in this step).

## 6. Decisions and open items

- Mood and location are health-adjacent. Phase 2 needs per-user RLS, a delete and export path, and no analytics events carrying them (PostHog is in the stack).
- Tool citations (Phase 3) are checked against the source before they are stored. Anything not checked is marked unverified.
- Staging Supabase first; no production migrations without explicit approval.
