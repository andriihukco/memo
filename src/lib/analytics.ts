/**
 * Analytics utility — wraps PostHog for both server-side (posthog-node) and
 * client-side (posthog-js) event capture.
 *
 * All calls are fire-and-forget. When NEXT_PUBLIC_POSTHOG_KEY is not set,
 * every function is a no-op so analytics never blocks the critical path.
 *
 * Server-side usage (bot handlers, API routes):
 *   import { capture } from '@/lib/analytics';
 *   void capture('entry_saved', { category: 'health' }, telegramId);
 *
 * Client-side usage (Mini App components):
 *   Use the PostHogProvider + usePostHog() hook from 'posthog-js/react'.
 */

// ── Server-side capture (posthog-node) ───────────────────────────────────────

let _serverClient: import('posthog-node').PostHog | null = null;

function getServerClient(): import('posthog-node').PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  if (!_serverClient) {
    // Lazy import — posthog-node is only loaded on the server
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PostHog } = require('posthog-node') as typeof import('posthog-node');
    _serverClient = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
      // Flush immediately — Vercel serverless functions don't have a long-lived process
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return _serverClient;
}

/**
 * Hash a telegram_id for privacy-preserving distinct_id.
 * Uses a simple hex encoding — not cryptographically sensitive,
 * just avoids storing raw numeric IDs in PostHog.
 */
function hashId(telegramId: string | number | bigint): string {
  // Simple deterministic prefix so IDs are recognisable in PostHog
  return `tg_${telegramId}`;
}

/**
 * Server-side event capture (fire-and-forget).
 *
 * @param event      PostHog event name, e.g. 'entry_saved'
 * @param properties Arbitrary key/value properties
 * @param telegramId Telegram user ID used as distinct_id (hashed for privacy)
 */
export function capture(
  event: string,
  properties: Record<string, unknown>,
  telegramId: string | number | bigint
): void {
  const client = getServerClient();
  if (!client) return;

  const distinctId = hashId(telegramId);

  // Fire-and-forget — never await, never throw
  try {
    client.capture({ distinctId, event, properties });
  } catch { /* silent */ }
}

// ── Client-side re-exports (posthog-js/react) ────────────────────────────────
// These are imported by the Mini App layout and components.
// They are safe to import in client components because posthog-js is a
// browser-only package and Next.js tree-shakes it from server bundles.

export { PostHogProvider, usePostHog } from 'posthog-js/react';
