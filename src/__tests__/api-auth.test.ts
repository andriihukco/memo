/**
 * Integration tests for POST /api/auth/telegram.
 *
 * Covers:
 *  - Valid initData → 200 with access_token and refresh_token
 *  - Invalid hash → 401
 *  - Expired auth_date → 401
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

function encode(s: string): ArrayBuffer {
  return new TextEncoder().encode(s).buffer as ArrayBuffer;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function buildInitData(
  botToken: string,
  opts: { offsetSeconds?: number; tamperHash?: boolean; omitHash?: boolean } = {}
): Promise<string> {
  const authDate = Math.floor(Date.now() / 1000) + (opts.offsetSeconds ?? 0);
  const user = JSON.stringify({ id: 987654321, username: 'integrationuser' });

  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('user', user);

  const entries: string[] = [];
  params.forEach((value, key) => entries.push(`${key}=${value}`));
  entries.sort();
  const dataCheckString = entries.join('\n');

  const secretKey = await crypto.subtle.importKey(
    'raw',
    encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const secretKeyBytes = await crypto.subtle.sign('HMAC', secretKey, encode(botToken));

  const signingKey = await crypto.subtle.importKey(
    'raw',
    secretKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', signingKey, encode(dataCheckString));
  const hash = toHex(signatureBytes);

  if (opts.omitHash) return params.toString();

  params.set('hash', opts.tamperHash ? hash.replace(/[0-9a-f]/, 'z') : hash);
  return params.toString();
}

const BOT_TOKEN = 'integration_test_bot_token';

function setupSupabaseMocks() {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  mockListUsers.mockResolvedValue({ data: { users: [] }, error: null });
  mockCreateUser.mockResolvedValue({
    data: { user: { id: 'auth-uuid-integration' } },
    error: null,
  });
  mockUpdateUserById.mockResolvedValue({ data: {}, error: null });
  mockSignInWithPassword.mockResolvedValue({
    data: {
      session: {
        access_token: 'integration_access_token',
        refresh_token: 'integration_refresh_token',
        user: { id: 'auth-uuid-integration' },
      },
    },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'integration_service_role_key_xyz';
  setupSupabaseMocks();
});

async function callRoute(body: unknown): Promise<Response> {
  const { POST } = await import('@/app/api/auth/telegram/route');
  const req = new Request('http://localhost/api/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/telegram — integration tests', () => {
  it('valid initData returns 200 with access_token and refresh_token', async () => {
    const initData = await buildInitData(BOT_TOKEN);
    const res = await callRoute({ initData });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('access_token', 'integration_access_token');
    expect(json).toHaveProperty('refresh_token', 'integration_refresh_token');
  });

  it('invalid hash returns 401', async () => {
    const initData = await buildInitData(BOT_TOKEN, { tamperHash: true });
    const res = await callRoute({ initData });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('expired auth_date (>24h) returns 401', async () => {
    const initData = await buildInitData(BOT_TOKEN, { offsetSeconds: -(26 * 3600) });
    const res = await callRoute({ initData });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('missing hash field returns 401', async () => {
    const initData = await buildInitData(BOT_TOKEN, { omitHash: true });
    const res = await callRoute({ initData });

    expect(res.status).toBe(401);
  });

  it('missing initData body returns 400', async () => {
    const res = await callRoute({});
    expect(res.status).toBe(400);
  });

  it('initData signed with wrong token returns 401', async () => {
    const initData = await buildInitData('completely_wrong_token');
    const res = await callRoute({ initData });

    expect(res.status).toBe(401);
  });

  it('returns JSON content-type on success', async () => {
    const initData = await buildInitData(BOT_TOKEN);
    const res = await callRoute({ initData });

    expect(res.headers.get('Content-Type')).toContain('application/json');
  });

  it('auth_date exactly at 24h boundary is still valid', async () => {
    // Exactly 24h ago minus 1 second = still valid
    const initData = await buildInitData(BOT_TOKEN, { offsetSeconds: -(86400 - 1) });
    const res = await callRoute({ initData });

    expect(res.status).toBe(200);
  });
});
