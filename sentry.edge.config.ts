// This file configures the Sentry SDK for the Edge runtime.
// It is loaded automatically by @sentry/nextjs for middleware and edge API routes.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Only initialise when a DSN is provided — makes Sentry a no-op in local dev
// and in environments where SENTRY_DSN is not set.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Capture 10% of transactions for performance monitoring.
    tracesSampleRate: 0.1,

    // Disable debug output in production
    debug: false,
  });
}
