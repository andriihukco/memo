/**
 * Tests for REQ-02: Webhook Secret Verification
 *
 * Verifies that POST /api/telegram/webhook:
 *  - Returns 403 when no secret header is sent and TELEGRAM_WEBHOOK_SECRET is set
 *  - Returns 403 when the wrong secret is sent
 *  - Proceeds past the secret check when the correct secret is sent
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

const TEST_SECRET = 'test-webhook-secret-32-chars-long!!';

// ── Mock env ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/env', () => ({
  env: {
    TELEGRAM_BOT_TOKEN: 'test_bot_token',
    TELEGRAM_WEBHOOK_SECRET: TEST_SECRET,
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test_service_role_key',
    GEMINI_API_KEY: 'test_gemini_key',
    ENTRY_ENCRYPTION_PEPPER: 'a'.repeat(32),
    MINIAPP_URL: 'https://test.vercel.app/miniapp',
  },
}));

// ── Mock rate-limit (always allow) ────────────────────────────────────────────

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  rateLimitResponse: vi.fn(),
}));

// ── Mock grammy bot (prevent real bot init) ───────────────────────────────────

vi.mock('grammy', () => {
  function MockBot() {
    return {
      use: vi.fn(),
      command: vi.fn(),
      on: vi.fn(),
      api: { sendMessage: vi.fn() },
    };
  }
  return {
    Bot: MockBot,
    Context: vi.fn(),
    webhookCallback: vi.fn(() => async () => new Response('ok', { status: 200 })),
    InlineKeyboard: vi.fn().mockImplementation(() => ({
      webApp: vi.fn().mockReturnThis(),
    })),
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function callWebhook(headers: Record<string, string> = {}): Promise<Response> {
  const { POST } = await import('@/app/api/telegram/webhook/route');
  const req = new Request('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ update_id: 1, message: { text: 'hi' } }),
  });
  return POST(req);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/telegram/webhook — secret verification (REQ-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when X-Telegram-Bot-Api-Secret-Token header is missing', async () => {
    const res = await callWebhook({}); // no secret header
    expect(res.status).toBe(403);
  });

  it('returns 403 when X-Telegram-Bot-Api-Secret-Token header has wrong value', async () => {
    const res = await callWebhook({
      'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret-value',
    });
    expect(res.status).toBe(403);
  });

  it('returns 403 when secret header is empty string', async () => {
    const res = await callWebhook({
      'X-Telegram-Bot-Api-Secret-Token': '',
    });
    expect(res.status).toBe(403);
  });

  it('passes secret check when correct X-Telegram-Bot-Api-Secret-Token is provided', async () => {
    const res = await callWebhook({
      'X-Telegram-Bot-Api-Secret-Token': TEST_SECRET,
    });
    // Should not be 403 — the secret check passed (may be 200 or other status from bot handler)
    expect(res.status).not.toBe(403);
  });
});
