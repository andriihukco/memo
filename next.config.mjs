import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withSentryConfig(nextConfig, {
  // Suppress Sentry CLI output during builds
  silent: true,
  // Upload source maps to Sentry for readable stack traces
  // Requires SENTRY_AUTH_TOKEN and SENTRY_ORG / SENTRY_PROJECT env vars at build time
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Automatically instrument Next.js API routes and server components
  autoInstrumentServerFunctions: true,
  // Disable source map upload if auth token is not set (local dev)
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
});
