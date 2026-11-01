# Memo — project rules

Memo has two front ends: the Next.js Telegram Mini App (`src/`, web) and the Expo app (`mobile/`, iOS and Android). The rules below apply to every change. `mobile/AGENTS.md` adds Expo-specific rules and wins for anything inside `mobile/`.

## 1. Platform parity check (every change)

Before you finish any task that touches a screen, flow, component, copy or a token, check all three platforms and fix what is missing, or add it:

| Platform | Where it lives |
|---|---|
| Web | `src/app/miniapp/**`, `src/components/**` |
| iOS | `mobile/app/**`, `mobile/src/**` (same Expo code) |
| Android | `mobile/app/**`, `mobile/src/**` (same Expo code, Android branch) |

Checklist:

1. **Flow exists on every platform.** Same screens, same order, same empty/error/loading states. If a platform lacks it, add it or record the gap in `src/components/design/design-page.tsx` (Organisms or Platform parity table).
2. **Touch targets:** 44px web, 44pt iOS, 48dp Android (`min-h-11` / `min-h-12`).
3. **Inputs:** 16px text (stops iOS zoom).
4. **Navigation:** web Back control, iOS edge swipe, Android system back. Each screen must have a way back on all three.
5. **Safe areas:** `env(safe-area-inset-*)` on web, insets in Expo.
6. **Copy and i18n:** keys exist in `src/lib/i18n` and `mobile/src/i18n` (en and uk). `src/__tests__/i18n-parity.test.ts` checks web.
7. **Hover:** only under `(hover: hover) and (pointer: fine)` on web.

Report the check in the final message: what matched, what you fixed, what is still a gap and why.

## 2. Design page is the reference

- `/design` (`src/app/design/page.tsx`) is the design wiki: foundations, atoms, molecules, organisms, platform parity, references and the wiki (Design, Frontend, Backend, Marketing).
- Components are documented in `src/components/design/` using atomic folders: `primitives/`, `foundations/`, `atoms/`, `molecules/`, `wiki/`.
- When you add or change a shared component in `src/components/ui` or `src/components/patterns`, add or update its demo and props there.
- Wiki facts must point to a real source file or doc. Do not write from memory.

## 3. Design direction

- Follow the shadcn/ui and Apple HIG / Material 3 rules in the `uiux-principal` skill. Use shadcn/ui primitives first; do not add another component library.
- Semantic tokens only (`bg-primary`, `text-muted-foreground`). No raw hex in components.

## 4. Verify before done

- Web: `npx tsc --noEmit`, `npm test`. Browser check at `/design` and any changed route.
- Mobile: `cd mobile && npx tsc --noEmit && npx expo lint`. Run `npx expo-doctor` if dependencies change.
