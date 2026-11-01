# Memo: UI Project Start Sheet

Date: 2026-10-31
Figma kit: https://www.figma.com/design/brE3AopaYbNrg9iEnWXbhR (pages 00–06)
Sources: `src/app/globals.css`, `tailwind.config.ts`, `src/components/**`, `src/app/miniapp/**`, `mobile/app/**`, `mobile/src/components/ui.tsx`, `mobile/src/lib/category-meta.ts`, `mobile/app.json`, `docs/superpowers/specs/2026-10-24-ui-revamp-design.md`.

Status legend: **Code** = implemented and read from source. **Spec** = written in the revamp spec, not verified in code. **Design** = proposed in Figma only, not in code.

---

## 1. Platforms at a glance

| Platform | Stack | Shell | Status in code | Figma page |
|---|---|---|---|---|
| Web / Telegram Mini App | Next.js 14 (App Router), Tailwind 3.4, shadcn/ui (Radix), lucide-react | Bottom tab bar, max width 448px (`max-w-md`), routes under `/miniapp` | Code (Mini App); root `/` is a placeholder ("Open Memo in Telegram.") | 03 Web |
| iOS | Expo SDK 58, React Native 0.88, expo-router, expo-symbols (SF Symbols), expo-glass-effect | Floating glass tab bar, Tabs: Feed, Widgets, Graph, Insights | Code (bundle id `app.memo.mobile`) | 04 iOS |
| Android | Same Expo project, Android adaptive icon configured | Same tabs as iOS | **Design only.** `symbol.tsx` renders SF Symbols with no Android fallback. Not verified on a device. | 05 Android |

---

## 2. Color tokens

Figma collection **Color** has three modes: `Light`, `Dark` (both from `globals.css`) and `Native (Expo)` (from `ui.tsx`). Variables are not aliases of a primitive palette. Values are copied from code, so update both when a token changes.

### 2.1 Semantic tokens (web)

| Token | Light (hex) | Dark (hex) | Native / Expo (hex) | Notes |
|---|---|---|---|---|
| background | #FFFFFF | #09090B | #090B12 | Native differs from web by a few values |
| foreground | #09090B | #FAFAFA | #F4F5F8 | |
| card | #FFFFFF | #131316 | #131722 | |
| primary | #3948D0 | #7885F7 | **#4C8DFF** | **Accent differs by platform** (see §8) |
| primary-foreground | #FFFFFF | #09090B | #FFFFFF | |
| secondary | #F4F4F5 | #27272A | #222838 | |
| muted-foreground | #5D5D65 | #A4A4AD | #6F7A90 | Native fails 4.5:1 on card (4.14:1) |
| destructive | #C52020 | #F15F5F | #F87171 | |
| success | #126E34 | #26D968 | (dark value) | Not in mobile code |
| warning | #954C04 | #F6A823 | #FACC15 | |
| border | #E4E4E7 | #27272A | #222838 | Decorative only |
| input | #888891 | #62626A | #222838 | Control edge, must be ≥3:1 |
| ring | #3948D0 | #7885F7 | #4C8DFF | |
| surface-elevated | #F7F7F8 | #18181B | #131722 | |
| surface-hover | #ECECEE | #2C2C30 | (dark value) | |

Full list (42 variables incl. `chart/1–5` and `cat/1–12`) is in the Figma file, page 01.

### 2.2 Category hues (`cat/1`–`cat/12`)

Stable hue per category name (`categoryHue()` in `src/lib/categories.ts`, a hash mod 12). Shown as a 12% tint plus a solid dot.

| Token | Light | Dark |
|---|---|---|
| cat/1 | #3948D0 | #7885F7 |
| cat/2 | #0F7FB3 | #3EBAF4 |
| cat/3 | #0F8A7B | #26D9C4 |
| cat/4 | #1D8B46 | #26D968 |
| cat/5 | #5C871D | #95D435 |
| cat/6 | #C2940A | #FAD12E |
| cat/7 | #DA620B | #FA8938 |
| cat/8 | #DB2424 | #F15F5F |
| cat/9 | #D0257A | #EF6CAD |
| cat/10 | #AA37BE | #D378E2 |
| cat/11 | #713BCE | #AE86F4 |
| cat/12 | #65758B | #94A3B8 |

**Two category color systems exist.** `COLOR_PALETTE` in `src/lib/categories.ts` holds Tailwind classes (`bg-red-500/15`…) that users pick from. The `cat-N` tokens are the default. Pick one for new work.

### 2.3 Mobile-only category colors

`mobile/src/lib/category-meta.ts` uses Apple system colors (`#FF9F0A` reminder, `#0A84FF` to-do, `#FF375F` feeling, `#BF5AF2` thought, `#8E8E93` note). These do not match `cat-N` on web.

---

## 3. Typography

Font stack in code (`globals.css` body): `-apple-system, BlinkMacSystemFont, "SF Pro", Roboto, "Segoe UI", sans-serif`. The Figma kit uses **Inter** as a stand-in. Swap to SF Pro Text/Display for Apple and Roboto for Android when the kit is final.

### 3.1 Web ramp (Tailwind classes actually used)

| Figma style | Size / line | Weight | Tailwind (intent) |
|---|---|---|---|
| Web/Large Title | 30 / 36 | Bold | `text-3xl font-bold tracking-tight` |
| Web/Title | 20 / 28 | Semi Bold | `text-xl font-semibold` |
| Web/Headline | 16 / 24 | Semi Bold | `text-base font-semibold` |
| Web/Body | 16 / 24 | Regular | `text-base` |
| Web/Subhead | 14 / 20 | Regular | `text-sm` |
| Web/Footnote | 12 / 16 | Regular | `text-xs text-muted-foreground` |
| Web/Micro | 11 / 14 | Medium | `text-[11px]` (non-standard, see §8) |

### 3.2 iOS ramp (Apple HIG Dynamic Type, 17pt body)

| Figma style | Size / line | Weight | Used in code |
|---|---|---|---|
| iOS/Large Title | 34 / 41 | Bold | `ui.tsx` Title (34) |
| iOS/Title 1 | 28 / 34 | Bold | mobile sizes 28 |
| iOS/Title 2 | 22 / 28 | Bold | mobile sizes 22 |
| iOS/Title 3 | 20 / 25 | Semi Bold | mobile sizes 20 |
| iOS/Headline | 17 / 22 | Semi Bold | Row/Button labels |
| iOS/Body | 17 / 22 | Regular | `ui.tsx` Row (17) |
| iOS/Callout | 16 / 21 | Regular | |
| iOS/Subhead | 15 / 20 | Regular | mobile sizes 15 |
| iOS/Footnote | 13 / 18 | Regular | `ui.tsx` section header (13) |
| iOS/Caption 1 | 12 / 16 | Regular | mobile sizes 12 |
| iOS/Caption 2 | 11 / 13 | Regular | mobile sizes 11 |

### 3.3 Android ramp (Material 3 scale, used in Figma only)

| Figma style | Size / line | Weight |
|---|---|---|
| Android/Headline Large | 32 / 40 | Regular |
| Android/Title Large | 22 / 28 | Regular |
| Android/Title Medium | 16 / 24 | Medium |
| Android/Body Large | 16 / 24 | Regular |
| Android/Body Medium | 14 / 20 | Regular |
| Android/Label Large | 14 / 20 | Medium |
| Android/Label Medium | 12 / 16 | Medium |

### 3.4 Measured font sizes in code

- Web: `text-[Npx]` arbitrary sizes appear at least 263 times in `src/app` and `src/components` (10px ×45, 11px ×36, 12px ×32, 13px ×54, 14px ×32, 15px ×35, 17px ×13, 22px ×10, 28px ×11, 18px ×5). Standard `text-xs…text-4xl` classes appear about 227 times.
- Mobile: 16 distinct sizes (11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 32, 34, 44).

---

## 4. Spacing, radius, elevation, touch

| Token (Figma, Layout) | Value | Source |
|---|---|---|
| space/2xs … space/3xl | 2, 4, 8, 12, 16, 20, 24, 32 px | Tailwind 4px grid |
| space/touch, touch/min | 44 px | `TOUCH` in `ui.tsx`; spec §Touch |
| radius/lg (`--radius`) | 12 px | `globals.css` (`0.75rem`). Spec and docs say 14px. Code wins. |
| radius/md, sm | 10 px, 8 px | `calc(var(--radius) − 2px / −4px)` |
| radius/xl, 2xl | 16 px, 20 px | `calc(var(--radius) + 4px / + 8px)` |
| size/tabbar | 64 px | `--tab-bar-h: 4rem` |

Elevation (Figma effect styles):

| Style | Shadow |
|---|---|
| Elevation/Card | 0 2 8, black 20% |
| Elevation/Tab bar | 0 8 32, black 40% |
| Elevation/Sheet | 0 −4 24, black 30% |
| Elevation/Drawer | 0 −10 40, black 40% (`shadow-drawer`) |

Touch: 44 px minimum on every interactive control (Apple HIG). Web `Button` in `src/components/ui/button.tsx` is `h-9` (36 px) for default and icon sizes, so it is below the 44 px target. The revamp spec moves sizes into button variants.

---

## 5. Components (Figma page 02)

| Component | Variants | Web code | Mobile code |
|---|---|---|---|
| Button | Style × State (Primary, Secondary, Destructive, Ghost × Default, Disabled) | `src/components/ui/button.tsx` (shadcn) | `PrimaryButton` in `ui.tsx` |
| Input | State (Default, Focus, Error) | `ui/input.tsx` | `TextInput` inline |
| Chip | Selected (Off, On) | (feed filter) | `Chip` in `ui.tsx` |
| Row | Kind (Default, Destructive) | `page-header` + settings rows | `Row` in `ui.tsx` |
| Tab bar item | Active (Off, On) | `shell/tab-bar.tsx` | `glass-tab-bar.tsx` |
| Category badge | Hue (cat/1, 3, 7, 8) | `patterns/category-badge.tsx` | `Dot` + label |

Other code components not yet in Figma: `empty-state`, `error-state`, `bottom-sheet` (vaul), `confirm-sheet`, `undo-toast` (sonner), `paywall-modal`, `usage-counter-chip`, `lock-screen`, `pin-pad`, `onboarding`.

Governance (spec): shadcn is the only web component foundation. Only 4 of 24 `ui/` files are shadcn today; the rest are hand-made. Material Symbols are being replaced by lucide.

---

## 6. Pages and routes

### 6.1 Web (`src/app`)

| Route | Screen | Figma frame |
|---|---|---|
| `/` | Placeholder: "Open Memo in Telegram." | not designed |
| `/miniapp` | Journal (feed + compose) | Web / Journal Light, Dark |
| `/miniapp/entry/[id]` | Entry detail | Web / Entry |
| `/miniapp/insights` | Insights | Web / Insights |
| `/miniapp/insights/reports/[id]` | Report detail | Web / Report |
| `/miniapp/you` | You (settings hub) | Web / You |
| `/miniapp/you/categories` | Categories | Web / Categories |
| `/miniapp/you/plan` | Plan & usage | Web / Plan & usage |
| `/miniapp/you/privacy` | Privacy | Web / Privacy |
| (drawer) | Compose | Web / Compose sheet |

Not routed on web: Graph. `src/components/features/graph/graph-view.tsx` exists but nothing imports it.

### 6.2 Mobile (`mobile/app`)

| Route | Screen | Figma frame |
|---|---|---|
| `_layout` gate | Onboarding, then Passcode lock | iOS / Onboarding, iOS / Passcode |
| `(tabs)/index` | Feed | iOS / Feed, Android / Feed |
| `(tabs)/widgets` | Widgets | iOS / Widgets |
| `(tabs)/graph` | Graph | iOS / Graph |
| `(tabs)/insights` | Insights | iOS / Insights, Android / Insights |
| `entry/[id]` | Entry | iOS / Entry, Android / Entry |
| `compose` | Compose sheet | iOS / Compose, Android / Compose |
| `menu` | Menu | iOS / Menu, Android / Menu |
| `you/categories` | Categories | iOS / Categories, Android / Categories |
| `passcode` | Passcode (enable, change, disable) | iOS / Passcode |
| `sign-in` | Sign in | not designed |
| `insights/new`, `insights/report/[id]`, `widgets/new` | Sub-screens | not designed |

---

## 7. User flows (Figma page 06)

| # | Flow | Steps |
|---|---|---|
| F1 | First launch | Onboarding → Set passcode → Feed |
| F2 | Create entry | Feed (+) → Compose (text or voice; auto category) → Save → Feed |
| F3 | Open, delete, undo | Feed → Entry → Delete → "Deleted · Undo" toast |
| F4 | Insights to trial | Insights → Generate report → Report → Trial offer (after first report, not at onboarding) |
| F5 | You | You / Menu → Plan & usage, Categories, Privacy |
| F6 | Passcode lock | App start (locked) → Enter passcode → Feed |

Known flow gaps (from spec, not all fixed in code):
- Users cannot create an entry inside the Mini App (spec: compose is new).
- Undo runs after the server delete on some screens (spec says it must run before).
- Onboarding exists in three copies and is about 11 screens.
- Graph is a paywall dead end for free users.

---

## 8. Platform differences and drift (verified from code)

| # | Finding | Evidence | Impact | Recommendation |
|---|---|---|---|---|
| 1 | Accent color differs: native `#4C8DFF` vs web `#3948D0` (light) / `#7885F7` (dark) | `ui.tsx` vs `globals.css` | Brand inconsistency between iOS and web | Pick one brand accent and generate both from it |
| 2 | Native primary button text fails contrast: white on `#4C8DFF` = **3.2:1** | Computed | Fails WCAG AA for 17pt semibold text | Darken native tint or use dark text |
| 3 | Native muted text on card: `#6F7A90` on `#131722` = **4.14:1** | Computed | Fails AA for body text | Lighten to ≥4.5:1 |
| 4 | Two category color systems (`cat-N` tokens vs Tailwind `COLOR_PALETTE`) plus Apple colors on mobile | `categories.ts`, `category-meta.ts` | Same category looks different per platform | One hue set in `globals.css` shared by all platforms |
| 5 | Docs describe a different theme than the code | `docs/design-system/01-tokens-and-theming.md` shows `#0B0F19`/`#3B82F6` and a `.light` class; `globals.css` uses zinc and `#3948D0` with `:root` as light | Docs are stale | Update the doc from this sheet |
| 6 | Radius: docs 14px, code 12px | `globals.css` | Visual mismatch | Use 12px (code) and update docs |
| 7 | ~263 arbitrary `text-[Npx]` sizes on web | grep | Fights the type scale; spec wants a minimum of 12px | Map to the Web ramp (§3.1) |
| 8 | Android has no icon fallback | `mobile/src/components/symbol.tsx` | Android build would show no icons | Add a lucide or vector-icon fallback before any Android release |
| 9 | Web root is a placeholder | `src/app/page.tsx` | No standalone web entry | Decide whether web-only is in scope (spec: web-first) |
| 10 | Telegram-only assumptions: `TelegramThemeBridge`, BackButton, haptics | `shell/telegram-theme-bridge.tsx`, `back.tsx` | Must degrade to browser fallback | Keep fallbacks; test without Telegram |

---

## 9. Platform mapping (what changes per platform)

| Concern | Web / Telegram | iOS | Android (design target) |
|---|---|---|---|
| Navigation | Bottom tab bar, `Link` routes | Expo Tabs with glass pill and + FAB | Bottom navigation bar with active indicator and extended FAB |
| Back | `useBack()` (Telegram BackButton when present, else chevron) | Stack back, swipe | System back / predictive back (`predictiveBackGestureEnabled: false` today) |
| Sheets | vaul drawer (spec) | Modal sheet | Bottom sheet |
| Toasts | sonner | in-app toast | snackbar |
| Icons | lucide-react (Material Symbols being removed) | SF Symbols via expo-symbols | Needs a fallback (see §8.8) |
| Type | system stack, Inter in Figma | SF Pro (HIG ramp) | Roboto (M3 ramp) |
| Safe area | `env(safe-area-inset-*)`, `--tab-bar-h` | `react-native-safe-area-context` | Edge-to-edge |
| Haptics | `navigator.vibrate` fallback | `expo-haptics` | `expo-haptics` (not verified) |
| Theme | next-themes (System / Light / Dark) | `userInterfaceStyle: dark` | Light and dark (design only) |
| Voice | MediaRecorder | `expo-speech-recognition` | Not verified |

---

## 10. Open decisions (need your answer)

1. **Brand accent.** Keep indigo `#3948D0` / `#7885F7` from web, or move native to `#4C8DFF`? Recommendation: indigo everywhere; it passes contrast on both themes.
2. **Font.** Use SF Pro on Apple and Roboto on Android (system stack), with Inter only in Figma? Recommendation: yes, and set Figma text styles to SF Pro / Roboto once the fonts are available in the team library.
3. **Android scope.** Is Android a release target now, or design-only? Recommendation: design-only until the icon fallback (§8.8) is done.
4. **Category colors.** Use `cat-N` tokens everywhere (recommended) or keep the user palette?
5. **Figma as source.** Should Figma drive token changes (Figma → code) or code stay the source (code → Figma)? Recommendation: code stays the source; re-sync this kit after each token change.

---

## 11. Verification done for this sheet

- Figma kit built in file `brE3AopaYbNrg9iEnWXbhR`: 42 colour variables × 3 modes, 18 layout variables, 25 text styles, 4 effect styles, 6 component sets, 10 web screens, 10 iOS screens, 7 Android screens, 6 flow boards.
- Contrast ratios computed with the WCAG relative-luminance formula from the hex values above.
- Token hex values converted from `globals.css` HSL with the same formula, not copied from the docs.
- Not verified: rendered app on device, Telegram runtime, SF Pro and Roboto availability in the Figma team library.
