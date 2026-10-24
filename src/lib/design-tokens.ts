/**
 * ── Memo Design Tokens ──────────────────────────────────────────────────────
 *
 * Single source of truth for all non-Tailwind design constants.
 * All CSS custom-property names map to the tokens in globals.css / tailwind.config.ts.
 *
 * Usage:
 *   import { tokens } from '@/lib/design-tokens';
 *   <div style={{ zIndex: tokens.zIndex.modal }} />
 */

// ── Z-Index Layers ────────────────────────────────────────────────────────────
export const zIndex = {
  /** Base content */
  base: 0,
  /** Sticky elements (tab bar, sticky headers) */
  sticky: 10,
  /** Floating action buttons, context menus */
  floating: 20,
  /** Drawers, bottom sheets */
  drawer: 30,
  /** Modals, dialogs */
  modal: 40,
  /** Toasts, notifications */
  toast: 50,
  /** Splash screen / passcode overlay */
  overlay: 60,
} as const;

// ── Spacing Scale (4px grid) ──────────────────────────────────────────────────
export const spacing = {
  /** 4px */
  xs: '0.25rem',
  /** 8px */
  sm: '0.5rem',
  /** 12px */
  md: '0.75rem',
  /** 16px */
  base: '1rem',
  /** 20px */
  lg: '1.25rem',
  /** 24px */
  xl: '1.5rem',
  /** 32px */
  '2xl': '2rem',
  /** 48px */
  '3xl': '3rem',
} as const;

// ── Typography Scale ──────────────────────────────────────────────────────────
export const fontSize = {
  /** 10px — badge labels, timestamps, micro text */
  micro: '0.625rem',
  /** 11px — helper text, secondary meta */
  caption: '0.6875rem',
  /** 12px — secondary body, collapsed previews */
  xs: '0.75rem',
  /** 13px — body compact */
  sm: '0.8125rem',
  /** 14px — default body */
  base: '0.875rem',
  /** 15px — primary body, cards */
  md: '0.9375rem',
  /** 16px — form inputs (REQUIRED to prevent iOS zoom) */
  input: '1rem',
  /** 17px — section titles */
  title: '1.0625rem',
  /** 20px — page headers */
  h3: '1.25rem',
  /** 24px — large headings */
  h2: '1.5rem',
  /** 28px — display headings */
  h1: '1.75rem',
} as const;

// ── Touch Target Minimums ─────────────────────────────────────────────────────
export const touchTarget = {
  /** 44px — iOS HIG minimum */
  min: '2.75rem',
  /** 36px — compact (only where space is truly constrained) */
  compact: '2.25rem',
} as const;

// ── Border Radius ─────────────────────────────────────────────────────────────
export const radius = {
  sm: 'calc(var(--radius) - 4px)',
  md: 'calc(var(--radius) - 2px)',
  DEFAULT: 'var(--radius)',
  lg: 'var(--radius)',
  xl: 'calc(var(--radius) + 4px)',
  '2xl': 'calc(var(--radius) + 8px)',
  full: '9999px',
} as const;

// ── Animation Presets ─────────────────────────────────────────────────────────
export const motion = {
  /** Standard enter/exit */
  easeOut: [0.22, 1, 0.36, 1] as [number, number, number, number],
  /** Spring-feel for structural UI */
  spring: { type: 'spring' as const, stiffness: 300, damping: 28 },
  /** Flick/momentum */
  springSnappy: { type: 'spring' as const, stiffness: 380, damping: 22 },
  /** Duration tokens */
  duration: {
    fast: 0.15,
    normal: 0.25,
    slow: 0.4,
  },
} as const;

// ── Semantic Color Roles ──────────────────────────────────────────────────────
export const colorRole = {
  bg: 'bg-background',
  text: 'text-foreground',
  textMuted: 'text-muted-foreground',
  card: 'bg-card',
  primary: 'bg-primary text-primary-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
  warning: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
  success: 'bg-green-500/15 border-green-500/40 text-green-400',
} as const;

export const tokens = {
  zIndex,
  spacing,
  fontSize,
  touchTarget,
  radius,
  motion,
  colorRole,
} as const;
