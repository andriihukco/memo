import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {};

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
