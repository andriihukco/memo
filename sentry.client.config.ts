// This file configures the Sentry SDK for the browser (client-side).
// It is loaded automatically by @sentry/nextjs when the app runs in the browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Only initialise when a DSN is provided — makes Sentry a no-op in local dev
// and in environments where NEXT_PUBLIC_SENTRY_DSN is not set.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Capture 10% of transactions for performance monitoring.
    // Adjust this value in production to balance cost vs. coverage.
    tracesSampleRate: 0.1,

    // Replay 1% of sessions, 100% of sessions with errors.
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,

    // Disable debug output in production
    debug: false,
  });
}
