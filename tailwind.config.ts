import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
        chart: Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, `hsl(var(--chart-${n}))`])),
        cat: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, `hsl(var(--cat-${i + 1}))`])),
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Landing scenes. Fixed palettes: the day band is always paper-light, the night band always dark.
        day: {
          top: "hsl(204 80% 88%)",
          bottom: "hsl(202 70% 95%)",
          card: "hsl(40 60% 99%)",
          ink: "hsl(28 30% 16%)",
          muted: "hsl(28 18% 38%)",
          sun: "hsl(38 95% 62%)",
          line: "hsl(36 40% 82%)",
        },
        night: {
          top: "hsl(232 60% 8%)",
          bottom: "hsl(262 42% 20%)",
          card: "hsl(232 40% 14% / 0.72)",
          ink: "hsl(220 30% 96%)",
          muted: "hsl(225 18% 72%)",
          moon: "hsl(45 90% 84%)",
          line: "hsl(230 30% 28%)",
          accent: "hsl(250 90% 78%)",
        },
        // Custom surface colors for dark theme
        surface: {
          DEFAULT: "hsl(var(--card))",
          elevated: "hsl(var(--surface-elevated))",
          hover: "hsl(var(--surface-hover))",
        },
      },
      boxShadow: {
        'glow': '0 0 20px hsl(var(--primary) / 0.15)',
        'glow-lg': '0 0 40px hsl(var(--primary) / 0.2)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 8px 30px rgba(0, 0, 0, 0.3)',
        'drawer': '0 -10px 40px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'shake': 'shake 0.4s ease-in-out',
        // Landing page. Motion is CSS only; every animation is switched off by motion-reduce.
        'lp-rise': 'lp-rise 0.8s cubic-bezier(0.16,1,0.3,1) both',
        'lp-drift': 'lp-drift 11s ease-in-out infinite',
        'lp-twinkle': 'lp-twinkle 4s ease-in-out infinite',
        'lp-bob': 'lp-bob 7s ease-in-out infinite',
        'lp-breathe': 'lp-breathe 6s ease-in-out infinite',
        'lp-draw': 'lp-draw 2.2s cubic-bezier(0.16,1,0.3,1) both',
        // Marketing site. Base curve from the landing skill (B7).
        'mk-in': 'mk-in 0.6s cubic-bezier(0.22,1,0.36,1) both',
      },
      keyframes: {
        // Uses the `translate` property, so a rotate() set with `transform` survives the fill.
        'lp-rise': {
          from: { opacity: '0', translate: '0 24px' },
          to: { opacity: '1', translate: '0 0' },
        },
        'lp-drift': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(18px)' },
        },
        'lp-twinkle': {
          '0%, 100%': { opacity: '0.2' },
          '50%': { opacity: '1' },
        },
        'lp-bob': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'lp-breathe': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.04)' },
        },
        'lp-draw': {
          from: { strokeDashoffset: '100' },
          to: { strokeDashoffset: '0' },
        },
        'mk-in': {
          from: { opacity: '0', translate: '0 16px' },
          to: { opacity: '1', translate: '0 0' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'base': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
