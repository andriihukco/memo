export type WikiCategory = 'design' | 'frontend' | 'backend' | 'marketing';

export interface WikiEntry {
  title: string;
  body: string;
  /** Repo-relative paths that hold the source of truth. */
  refs: string[];
}

/** Knowledge base for the /design page. Keep each entry short and point to the source file. */
export const WIKI: Record<WikiCategory, { label: string; intro: string; entries: WikiEntry[] }> = {
  design: {
    label: 'Design',
    intro: 'Tokens, components and platform rules shared by web, Android and iOS.',
    entries: [
      {
        title: 'Color tokens',
        body: 'Semantic HSL variables on :root, with a dark override. Components use Tailwind names (bg-primary, text-muted-foreground), never raw hex.',
        refs: ['src/app/globals.css', 'docs/design-system/01-tokens-and-theming.md'],
      },
      {
        title: 'Touch targets',
        body: 'iOS HIG: 44pt minimum. Material: 48dp minimum. Web: 44px (WCAG 2.5.5 AAA). Icon-only buttons need an accessible name.',
        refs: ['docs/design-system/02-a11y-wcag.md', 'src/components/design/primitives/platform.tsx'],
      },
      {
        title: 'Platform parity',
        body: 'Every flow exists on web, Android and iOS, or is listed as a documented gap. Check all three each time a screen changes.',
        refs: ['CLAUDE.md', 'mobile/AGENTS.md'],
      },
      {
        title: 'Motion',
        body: 'Spring motion for structural UI and feedback. Keep durations short and respect reduced motion.',
        refs: ['src/components/ui/empty-state.tsx'],
      },
    ],
  },
  frontend: {
    label: 'Frontend',
    intro: 'Web (Next.js App Router, Telegram Mini App shell) and native (Expo Router, React Native).',
    entries: [
      {
        title: 'Routes',
        body: 'Web Mini App lives under /miniapp with three tabs (Journal, Insights, You). Old routes redirect in next.config.mjs.',
        refs: ['src/app/miniapp/layout.tsx', 'next.config.mjs'],
      },
      {
        title: 'Shell and tab bar',
        body: 'AppShell wraps every Mini App page. TabBar holds the compose action in the centre.',
        refs: ['src/components/shell/app-shell.tsx', 'src/components/shell/tab-bar.tsx'],
      },
      {
        title: 'Component layers',
        body: 'ui/ holds shadcn primitives (Radix). patterns/ holds shared compositions (ListRow, ErrorState). features/ holds product screens.',
        refs: ['src/components/ui', 'src/components/patterns', 'src/components/features'],
      },
      {
        title: 'Native app',
        body: 'Expo SDK with Expo Router. Tabs match web: Journal, Insights (Overview, Reports, Graph) and You. Holding + on Journal records voice (development build only).',
        refs: ['mobile/app/(tabs)/_layout.tsx', 'mobile/src/components/ui.tsx'],
      },
      {
        title: 'Testing',
        body: 'Vitest with Testing Library (jsdom). Run with npm test. Mobile tests are excluded from the web runner.',
        refs: ['vitest.config.ts', 'src/__tests__'],
      },
    ],
  },
  backend: {
    label: 'Backend',
    intro: 'API routes, Supabase storage, AI pipeline, auth and billing.',
    entries: [
      {
        title: 'API surface',
        body: 'Route handlers for entries, categories, graph, reports, profile (export, delete, settings), billing (Stars invoice), Telegram webhook and cron jobs.',
        refs: ['docs/06-api-reference.md', 'src/app/api'],
      },
      {
        title: 'Auth',
        body: 'Telegram login is the production path. The dev sign-in route is localhost-only and uses a seeded test user.',
        refs: ['src/app/api/auth/telegram/route.ts', 'src/app/api/auth/dev/route.ts', 'docs/07-auth-and-security.md'],
      },
      {
        title: 'Data',
        body: 'Supabase Postgres. Entries are encrypted on the client before they reach the server (docs/07).',
        refs: ['docs/03-database-schema.md', 'src/lib/supabase', 'src/lib/crypto.ts'],
      },
      {
        title: 'AI pipeline',
        body: 'Classification, embeddings and insights run through Google Generative AI. Calls are rate-limited with Upstash.',
        refs: ['docs/04-ai-pipeline.md', 'src/lib/classifier.ts', 'src/lib/rate-limit.ts'],
      },
      {
        title: 'Billing',
        body: 'Trial, paid plan and Telegram Stars invoices. Usage is shown as a chip and a warning banner.',
        refs: ['docs/08-subscription-system.md', 'src/lib/billing', 'src/app/api/stars/invoice/route.ts'],
      },
    ],
  },
  marketing: {
    label: 'Marketing',
    intro: 'Positioning, voice and the copy rules the product follows.',
    entries: [
      {
        title: 'Positioning',
        body: 'Memo is a private AI diary inside Telegram. It turns thoughts into categories, goals and insights.',
        refs: ['docs/01-project-overview.md', 'src/app/layout.tsx'],
      },
      {
        title: 'Tone of voice',
        body: 'Warm, smart, concise, honest, playful. Sound like a person, cite the user\'s own data, ask one good question, and match the user\'s energy.',
        refs: ['docs/11-tone-of-voice.md'],
      },
      {
        title: 'Privacy message',
        body: 'Say what is encrypted and what leaves the device. Use the same wording on web, Android and iOS.',
        refs: ['docs/07-auth-and-security.md', 'src/app/miniapp/you/privacy/page.tsx'],
      },
      {
        title: 'Plans and pricing copy',
        body: 'Show what the plan includes and what changes after the trial. No dark patterns around the paywall.',
        refs: ['docs/08-subscription-system.md', 'src/app/miniapp/you/plan/page.tsx'],
      },
    ],
  },
};
