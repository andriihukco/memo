/**
 * Unit tests for verifyInitData() — tested indirectly via the POST /api/auth/telegram handler.
 *
 * Covers:
 *  - Valid initData within 24 hours → 200 with access_token
 *  - Expired initData (auth_date > 24h ago) → 401
 *  - Tampered hash → 401
 *  - Missing hash field → 401
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock Supabase ─────────────────────────────────────────────────────────────

const mockSignInWithPassword = vi.fn();
const mockCreateUser = vi.fn();
const mockListUsers = vi.fn();
const mockUpdateUserById = vi.fn();
const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        listUsers: mockListUsers,
        updateUserById: mockUpdateUserById,
      },
      signInWithPassword: mockSignInWithPassword,
    },
    from: mockFrom,
  })),
}));

// ── Mock rate-limit (always allow) ────────────────────────────────────────────

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  rateLimitResponse: vi.fn(),
}));

// ── Mock profile ──────────────────────────────────────────────────────────────

vi.mock('@/lib/profile', () => ({
  resolveOrCreateProfile: vi.fn().mockResolvedValue({}),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Encode a string as UTF-8 bytes */
function encode(s: string): ArrayBuffer {
  return new TextEncoder().encode(s).buffer as ArrayBuffer;
}

/** Hex-encode a byte array */
function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Build a valid Telegram initData string signed with the given bot token.
 * auth_date defaults to now (valid). Pass offsetSeconds < -86400 to make it expired.
 */
async function buildInitData(
  botToken: string,
  opts: { offsetSeconds?: number; tamperHash?: boolean; omitHash?: boolean } = {}
): Promise<string> {
  const authDate = Math.floor(Date.now() / 1000) + (opts.offsetSeconds ?? 0);
  const user = JSON.stringify({ id: 123456789, username: 'testuser' });

  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('user', user);

  // Build data-check-string
  const entries: string[] = [];
  params.forEach((value, key) => entries.push(`${key}=${value}`));
  entries.sort();
  const dataCheckString = entries.join('\n');

  // secret_key = HMAC-SHA256("WebAppData", bot_token)
  const secretKey = await crypto.subtle.importKey(
    'raw',
    encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const secretKeyBytes = await crypto.subtle.sign('HMAC', secretKey, encode(botToken));

  // signature = HMAC-SHA256(data-check-string, secret_key)
  const signingKey = await crypto.subtle.importKey(
    'raw',
    secretKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', signingKey, encode(dataCheckString));
  const hash = toHex(signatureBytes);

  if (opts.omitHash) {
    return params.toString();
  }

  if (opts.tamperHash) {
    params.set('hash', hash.replace(/[0-9a-f]/, 'x'));
  } else {
    params.set('hash', hash);
  }

  return params.toString();
}

// ── Test setup ────────────────────────────────────────────────────────────────

const BOT_TOKEN = 'test_bot_token_12345';

function setupSupabaseMocks() {
  const mockSelect = vi.fn().mockReturnThis();
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockInsert = vi.fn().mockReturnThis();
  const mockUpdate = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockIn = vi.fn().mockReturnThis();

  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    eq: mockEq,
    in: mockIn,
    single: mockSingle,
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  mockListUsers.mockResolvedValue({
    data: { users: [] },
    error: null,
  });

  mockCreateUser.mockResolvedValue({
    data: { user: { id: 'auth-user-uuid-123' } },
    error: null,
  });

  mockUpdateUserById.mockResolvedValue({ data: {}, error: null });

  mockSignInWithPassword.mockResolvedValue({
    data: {
      session: {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        user: { id: 'auth-user-uuid-123' },
      },
    },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_role_key_abcdefgh';
  setupSupabaseMocks();
});

// ── Import route handler ──────────────────────────────────────────────────────

async function callRoute(body: unknown): Promise<Response> {
  // Dynamic import so mocks are in place before the module loads
  const { POST } = await import('@/app/api/auth/telegram/route');
  const req = new Request('http://localhost/api/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/telegram — verifyInitData', () => {
  it('returns 200 with access_token for valid initData within 24h', async () => {
    const initData = await buildInitData(BOT_TOKEN);
    const res = await callRoute({ initData });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('access_token');
    expect(json.access_token).toBe('mock_access_token');
  });

  it('returns 401 for expired initData (auth_date > 24h ago)', async () => {
    // 25 hours ago
    const initData = await buildInitData(BOT_TOKEN, { offsetSeconds: -(25 * 3600) });
    const res = await callRoute({ initData });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 401 for tampered hash', async () => {
    const initData = await buildInitData(BOT_TOKEN, { tamperHash: true });
    const res = await callRoute({ initData });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 401 when hash field is missing', async () => {
    const initData = await buildInitData(BOT_TOKEN, { omitHash: true });
    const res = await callRoute({ initData });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 when initData is missing from body', async () => {
    const res = await callRoute({});
    expect(res.status).toBe(400);
  });

  it('returns 401 when initData is signed with wrong bot token', async () => {
    const initData = await buildInitData('wrong_bot_token');
    const res = await callRoute({ initData });
    expect(res.status).toBe(401);
  });
});
