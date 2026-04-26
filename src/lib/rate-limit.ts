/**
 * In-memory sliding-window rate limiter.
 *
 * Works in both Edge and Node.js runtimes — no external dependency required.
 * Each Vercel Edge invocation is isolated, so this is per-instance; for
 * production at scale swap the store for Upstash Redis. For the current
 * traffic level (Telegram webhook + mini app) this is sufficient.
 */

interface Window {
  count: number;
  resetAt: number; // unix ms
}

const store = new Map<string, Window>();

// Prune stale keys every 5 minutes to avoid unbounded memory growth
let lastPrune = Date.now();
function maybePrune() {
  const now = Date.now();
  if (now - lastPrune < 5 * 60 * 1000) return;
  lastPrune = now;
  for (const [key, win] of store) {
    if (win.resetAt < now) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // unix ms
}

/**
 * Check and increment the rate limit counter for `key`.
 *
 * @param key      Unique identifier (e.g. IP address, telegram_id)
 * @param limit    Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  maybePrune();

  const now = Date.now();
  let win = store.get(key);

  if (!win || win.resetAt <= now) {
    win = { count: 0, resetAt: now + windowMs };
    store.set(key, win);
  }

  win.count += 1;
  const allowed = win.count <= limit;
  const remaining = Math.max(0, limit - win.count);

  return { allowed, remaining, resetAt: win.resetAt };
}

/** Build a 429 response with Retry-After header. */
export function rateLimitResponse(resetAt: number): Response {
  const retryAfterSec = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({ error: "Too many requests. Please slow down." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
      },
    }
  );
}
