/**
 * Sliding-window rate limiter.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * are set, so limits hold across Vercel instances. Without them (local dev,
 * tests) it falls back to a per-instance in-memory store. If Redis errors at
 * runtime, the request is checked against the in-memory store instead of
 * failing open.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // unix ms
}

// ── In-memory fallback ────────────────────────────────────────────────────────

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

function limitInMemory(key: string, limit: number, windowMs: number): RateLimitResult {
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

// ── Upstash backend ───────────────────────────────────────────────────────────

let redis: Redis | null | undefined;
const upstashLimiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

function getUpstashLimiter(limit: number, windowMs: number, client: Redis): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  let limiter = upstashLimiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: "memo:rl",
    });
    upstashLimiters.set(cacheKey, limiter);
  }
  return limiter;
}

/**
 * Check and increment the rate limit counter for `key`.
 *
 * @param key      Unique identifier (e.g. IP address, JWT prefix)
 * @param limit    Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const client = getRedis();
  if (!client) return limitInMemory(key, limit, windowMs);

  try {
    const res = await getUpstashLimiter(limit, windowMs, client).limit(key);
    return { allowed: res.success, remaining: res.remaining, resetAt: res.reset };
  } catch (err) {
    console.error("[rate-limit] Upstash error, using in-memory fallback:", err instanceof Error ? err.message : err);
    return limitInMemory(key, limit, windowMs);
  }
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
