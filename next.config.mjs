import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a second dev server run from the same folder without sharing .next (set MEMO_DIST_DIR).
  distDir: process.env.MEMO_DIST_DIR || ".next",
  // Old 5-tab routes → 3-tab shell. Temporary so bot deep links can move again; Next keeps the incoming query.
  async redirects() {
    return [
      ['/miniapp/dashboard', '/miniapp/insights?view=overview'],
      ['/miniapp/reports', '/miniapp/insights?view=reports'],
      ['/miniapp/settings', '/miniapp/you'],
      ['/miniapp/subscriptions', '/miniapp/you/plan'],
      ['/miniapp/categories', '/miniapp/you/categories'],
      ['/miniapp/onboarding', '/miniapp'],
    ].map(([source, destination]) => ({ source, destination, permanent: false }));
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry organisation and project — set these in your CI/CD environment
  // or in .env.local for local source-map uploads.
  // org: process.env.SENTRY_ORG,
  // project: process.env.SENTRY_PROJECT,

  // Only upload source maps when SENTRY_DSN is set (avoids noise in local dev)
  silent: !process.env.SENTRY_DSN,

  // Upload source maps to Sentry during build so stack traces are readable.
  // Requires SENTRY_AUTH_TOKEN env var in CI/Vercel.
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size.
  disableLogger: true,

  // Hides source maps from the browser bundle (they are uploaded to Sentry only).
  hideSourceMaps: true,

  // Automatically instrument Next.js data fetching methods and API routes.
  autoInstrumentServerFunctions: true,
});
