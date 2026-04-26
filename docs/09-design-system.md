# Design System — Memo

Memo uses a custom dark theme built on top of **shadcn/ui** + **Tailwind CSS**, optimized for Telegram Mini App (mobile-first, dark-only, iOS-feel).

---

## Design Principles

1. **Dark-first** — The app lives inside Telegram which is predominantly dark. No light mode.
2. **iOS-native feel** — SF Pro font stack, 44px touch targets, momentum scrolling, spring animations.
3. **Glassmorphism accents** — Subtle frosted glass for overlays and tab bar.
4. **Motion as feedback** — Every interaction has a micro-animation (Framer Motion).
5. **Telegram-native** — Respects safe area insets, uses Telegram's color palette as reference.
6. **Accessibility** — 44px minimum touch targets, sufficient contrast ratios, focus rings.

---

## Color Tokens

### CSS Custom Properties (HSL)

```css
:root {
  /* Backgrounds */
  --background:        222 47% 6%;    /* #0B0F19 — Deep navy */
  --card:              217 33% 12%;   /* #151B2B — Elevated surface */
  --popover:           217 33% 12%;   /* #151B2B — Modal/drawer */
  --secondary:         217 33% 17%;   /* #1E293B — Secondary surface */
  --muted:             217 33% 17%;   /* #1E293B — Muted background */
  --input:             217 33% 17%;   /* #1E293B — Input background */

  /* Text */
  --foreground:        210 40% 98%;   /* #F8FAFC — Primary text */
  --muted-foreground:  215 20% 55%;   /* #94A3B8 — Secondary text */

  /* Brand */
  --primary:           217 91% 60%;   /* #3B82F6 — Vibrant blue */
  --primary-foreground: 222 47% 6%;   /* Dark text on primary */
  --accent:            217 91% 60%;   /* Same as primary */

  /* Semantic */
  --destructive:       0 72% 51%;     /* #DC2626 — Error red */
  --border:            217 33% 20%;   /* Subtle borders */
  --ring:              217 91% 60%;   /* Focus ring */

  /* Custom */
  --surface-elevated:  217 33% 14%;   /* #1A2234 — Cards, drawers */
  --surface-hover:     217 33% 20%;   /* #243347 — Hover states */
  --radius:            0.875rem;      /* 14px border radius */
}
```

### Semantic Color Usage

| Token | Usage |
|-------|-------|
| `background` | Page background |
| `card` | Entry cards, settings rows |
| `popover` | Bottom sheets, modals |
| `primary` | CTAs, active states, links |
| `muted` | Skeleton loaders, disabled states |
| `muted-foreground` | Timestamps, labels, hints |
| `destructive` | Delete actions, error states |
| `border` | Card borders, separators |

### Category Colors (Tailwind)

```typescript
const CATEGORY_COLORS = {
  thoughts:      'bg-indigo-100 text-indigo-700',
  ideas:         'bg-amber-100 text-amber-700',
  feelings:      'bg-pink-100 text-pink-700',
  expenses:      'bg-emerald-100 text-emerald-700',
  calories:      'bg-orange-100 text-orange-700',
  workout:       'bg-blue-100 text-blue-700',
  goals:         'bg-sky-100 text-sky-700',
  sleep:         'bg-fuchsia-100 text-fuchsia-700',
  health:        'bg-teal-100 text-teal-700',
  dreams:        'bg-violet-100 text-violet-700',
  books:         'bg-yellow-100 text-yellow-700',
  work:          'bg-slate-100 text-slate-700',
  relationships: 'bg-rose-100 text-rose-700',
  travel:        'bg-cyan-100 text-cyan-700',
  gratitude:     'bg-lime-100 text-lime-700',
  music:         'bg-purple-100 text-purple-700',
  social:        'bg-pink-100 text-pink-700',
};
```

### Graph Node Colors (Dark-optimized)

```typescript
const GRAPH_COLORS = {
  thoughts:      '#818cf8',  // indigo-400
  ideas:         '#fbbf24',  // amber-400
  feelings:      '#f472b6',  // pink-400
  expenses:      '#34d399',  // emerald-400
  calories:      '#fb923c',  // orange-400
  workout:       '#60a5fa',  // blue-400
  dreams:        '#a78bfa',  // violet-400
  relationships: '#fb7185',  // rose-400
  health:        '#2dd4bf',  // teal-400
  sleep:         '#c084fc',  // fuchsia-400
};
```

### Widget Icon Colors (Apple-inspired)

18 solid colors for widget icon circles:
`blue`, `indigo`, `violet`, `purple`, `pink`, `rose`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `emerald`, `teal`, `cyan`, `sky`, `slate`, `gray`

---

## Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display',
             'Helvetica Neue', 'Segoe UI', Roboto, sans-serif;
```

iOS SF Pro is used on Apple devices. Falls back to system UI fonts on Android/desktop.

### Type Scale

| Usage | Size | Weight | Line Height |
|-------|------|--------|-------------|
| Page title | 28px | 700 | tight |
| Section title | 19px | 700 | tight |
| Card title | 17px | 600 | tight |
| Body | 15px | 400 | relaxed (1.6) |
| Secondary | 14px | 400 | normal |
| Label | 13px | 500 | normal |
| Caption | 12px | 400 | normal |
| Micro | 11px | 500 | normal |
| Badge | 10px | 500 | normal |
| Nano | 9px | 700 | normal |

### Font Features
```css
font-feature-settings: "cv02", "cv03", "cv04", "cv11";
-webkit-font-smoothing: antialiased;
text-rendering: optimizeLegibility;
```

---

## Spacing

Based on Tailwind's 4px grid:

| Token | Value | Usage |
|-------|-------|-------|
| `gap-1` | 4px | Tight icon spacing |
| `gap-2` | 8px | Badge gaps, small elements |
| `gap-3` | 12px | Row item spacing |
| `gap-4` | 16px | Section spacing |
| `gap-6` | 24px | Major section gaps |
| `px-4` | 16px | Page horizontal padding |
| `py-3.5` | 14px | Row vertical padding |
| `pt-5` | 20px | Page top padding |
| `pb-6` | 24px | Page bottom padding |

---

## Border Radius

```css
--radius: 0.875rem;  /* 14px — default for cards */
```

| Component | Radius |
|-----------|--------|
| Cards | `rounded-xl` (12px) |
| Large cards | `rounded-2xl` (16px) |
| Buttons | `rounded-full` or `rounded-xl` |
| Badges | `rounded-full` |
| Inputs | `rounded-2xl` (16px) |
| Bottom sheets | `rounded-t-2xl` (top corners only) |
| Tab bar | `rounded-full` (pill shape) |
| Widget icon circles | `rounded-2xl` or `rounded-3xl` |

---

## Shadows & Elevation

```css
/* Tab bar */
box-shadow: 0 -1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.4);

/* Bottom sheet */
box-shadow: 0 -4px 24px rgba(0,0,0,0.3);

/* Widget cards */
box-shadow: 0 2px 8px rgba(0,0,0,0.2);
```

---

## Motion & Animation

All animations use **Framer Motion** with spring physics.

### Standard Spring
```typescript
{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }
```

### Gentle Spring (overlays)
```typescript
{ type: 'spring', stiffness: 300, damping: 30 }
```

### Page Enter
```typescript
initial={{ opacity: 0, y: 12 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
```

### Bottom Sheet Enter
```typescript
initial={{ y: '100%', opacity: 0 }}
animate={{ y: 0, opacity: 1 }}
exit={{ y: '100%', opacity: 0 }}
transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
```

### Staggered List Items
```typescript
transition={{ duration: 0.35, delay: 0.1 + index * 0.07 }}
```

### Skeleton Shimmer
```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

---

## Glassmorphism

```css
.glass {
  background: hsl(217 33% 12% / 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid hsl(217 33% 25% / 0.3);
}
```

Used for: tab bar, overlays, onboarding slides.

---

## Touch & Interaction

### Minimum Touch Target
```css
button, a, [role="button"] {
  min-height: 44px;
  min-width: 44px;
}
```

### Tap Highlight
```css
html { -webkit-tap-highlight-color: transparent; }
```

### Momentum Scrolling
```css
body { -webkit-overflow-scrolling: touch; }
```

### Swipe Gestures
- Swipe left on entry card → reveal delete button (threshold: 72px, commit: 200px)
- Long press → enter multi-select mode (500ms timer)
- Pinch-to-zoom on graph → D3 zoom behavior

---

## Safe Area Insets

```css
.pb-safe { padding-bottom: env(safe-area-inset-bottom, 0px); }
.pt-safe { padding-top: env(safe-area-inset-top, 0px); }
```

The layout reads `window.Telegram.WebApp.safeAreaInset` and `contentSafeAreaInset` and applies them as CSS variables:
```typescript
document.documentElement.style.setProperty('--top-inset', `${safeAreaInset.top}px`);
document.documentElement.style.setProperty('--bottom-inset', `${safeAreaInset.bottom}px`);
```

---

## Icons

Two icon systems are used:

### Material Symbols (primary)
Used via `<Icon name="..." />` component. Renders Material Symbols Rounded via Google Fonts.

```typescript
// src/components/ui/icon.tsx
<span className="material-symbols-rounded" style={{ fontSize: size }}>
  {name}
</span>
```

### Lucide React (secondary)
Used directly for specific icons (X close button, etc.).

### Icon Mapping (Metric → Material Symbol)
```typescript
const METRIC_ICON_MAP = {
  flame:      'local_fire_department',
  wallet:     'account_balance_wallet',
  dumbbell:   'fitness_center',
  moon:       'bedtime',
  droplets:   'water_drop',
  'book-open':'menu_book',
  utensils:   'restaurant',
  heart:      'favorite',
  target:     'my_location',
  // ...
};
```

---

## Onboarding Gradient Backgrounds

Each onboarding slide has a unique gradient:
```typescript
const SLIDE_GRADIENTS = [
  'from-indigo-950 to-slate-950',   // Diary
  'from-violet-950 to-slate-950',   // AI
  'from-blue-950 to-slate-950',     // Dashboard
  'from-amber-950 to-slate-950',    // Recommendations
  'from-emerald-950 to-slate-950',  // Privacy
  'from-yellow-950 to-slate-950',   // Stars (paywall)
];
```

---

## Subscription Tier Visual Identity

| Tier | Icon | Color Accent |
|------|------|-------------|
| Spark (free) | ✨ | White/neutral |
| Nova (basic) | 🌟 | Yellow-400 (`#facc15`) |
| Supernova (pro) | 💫 | Yellow-400 + glow |

The Nova tier uses `border-yellow-400/50 bg-yellow-950/40` for its card.
The "Recommended" badge uses `bg-yellow-400 text-slate-950`.
