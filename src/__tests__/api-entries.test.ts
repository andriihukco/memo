/**
 * Integration tests for POST /api/entries.
 *
 * Covers:
 *  - Valid JWT + valid body → 201 with entry
 *  - Tier limit exceeded → 402
 *  - Unauthenticated (no JWT) → 401
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock Supabase ─────────────────────────────────────────────────────────────

// We need fine-grained control over what each .from() call returns.
// The entries route calls:
//   1. profiles.select('id').single()           → resolve user id
//   2. entries.select('id', count).eq(...)      → count entries for tier check
//   3. profiles.select('telegram_id, encryption_salt').single() → for encryption
//   4. entries.insert(...).select(...).single() → create entry

type MockChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

// Mutable config for each test
let mockProfileId = 'test-profile-uuid';
let mockEntryCount = 0;
let mockTier = 'free';
let mockInsertResult: { data: unknown; error: unknown } = {
  data: {
    id: 'new-entry-uuid',
    content: 'test content',
    category: 'thoughts',
    metadata: {},
    bot_reply: null,
    thread_id: null,
    reply_to_entry_id: null,
    created_at: new Date().toISOString(),
  },
  error: null,
};

const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// ── Mock rate-limit (always allow) ────────────────────────────────────────────

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  rateLimitResponse: vi.fn(),
}));

// ── Mock crypto (skip encryption for simplicity) ──────────────────────────────

vi.mock('@/lib/crypto', () => ({
  deriveUserKey: vi.fn().mockResolvedValue('mock-crypto-key'),
  encryptField: vi.fn().mockImplementation((text: string) => Promise.resolve(`enc:${text}`)),
  decryptField: vi.fn().mockImplementation((text: string) => Promise.resolve(text.replace(/^enc:/, ''))),
}));

// ── Mock paywall (getEffectiveTier) ───────────────────────────────────────────

vi.mock('@/lib/stars/paywall', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stars/paywall')>();
  return {
    ...actual,
    getEffectiveTier: vi.fn(() => Promise.resolve(mockTier)),
  };
});

// ── Setup Supabase mock responses ─────────────────────────────────────────────

function setupMocks() {
  let callCount = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') {
      // Returns different things depending on which select is called
      const chain: MockChain = {
        select: vi.fn().mockImplementation((cols: string) => {
          if (cols === 'id') {
            return {
              ...chain,
              single: vi.fn().mockResolvedValue({
                data: { id: mockProfileId },
                error: null,
              }),
            };
          }
          // telegram_id + encryption_salt
          return {
            ...chain,
            single: vi.fn().mockResolvedValue({
              data: { telegram_id: '123456789', encryption_salt: null },
              error: null,
            }),
          };
        }),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: mockProfileId }, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        in: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      };
      return chain;
    }

    if (table === 'entries') {
      return {
        select: vi.fn().mockImplementation((cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === 'exact' && opts?.head === true) {
            // Count query for tier limit check
            return {
              eq: vi.fn().mockReturnValue(
                Promise.resolve({ count: mockEntryCount, error: null })
              ),
            };
          }
          // Regular select (for insert result)
          return {
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue(mockInsertResult),
          };
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(mockInsertResult),
          }),
        }),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockInsertResult),
      };
    }

    // Default
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      in: vi.fn().mockReturnThis(),
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockProfileId = 'test-profile-uuid';
  mockEntryCount = 0;
  mockTier = 'free';
  mockInsertResult = {
    data: {
      id: 'new-entry-uuid',
      content: 'test content',
      category: 'thoughts',
      metadata: {},
      bot_reply: null,
      thread_id: null,
      reply_to_entry_id: null,
      created_at: new Date().toISOString(),
    },
    error: null,
  };
  setupMocks();
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test_anon_key';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
  process.env.GEMINI_API_KEY = 'test_gemini_key';
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function callRoute(body: unknown, jwt?: string): Promise<Response> {
  const { POST } = await import('@/app/api/entries/route');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
  const req = new Request('http://localhost/api/entries', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return POST(req);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/entries — integration tests', () => {
  it('unauthenticated request (no JWT) returns 401', async () => {
    const res = await callRoute({ content: 'test entry' });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('valid JWT + valid body creates entry and returns 201', async () => {
    const res = await callRoute({ content: 'Today I went for a run', category: 'workout' }, 'valid_jwt_token');
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toHaveProperty('entry');
    expect(json.entry).toHaveProperty('id');
  });

  it('tier limit exceeded returns 402 with limit_exceeded error', async () => {
    // Free tier limit is 100 entries
    mockEntryCount = 100;
    mockTier = 'free';

    const res = await callRoute({ content: 'One more entry' }, 'valid_jwt_token');
    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error).toBe('limit_exceeded');
    expect(json.feature).toBe('entries');
    expect(json.required_tier).toBe('stars_basic');
  });

  it('missing content field returns 400', async () => {
    const res = await callRoute({ category: 'thoughts' }, 'valid_jwt_token');
    expect(res.status).toBe(400);
  });

  it('paid tier (stars_pro) with high entry count is not limited', async () => {
    mockEntryCount = 5000;
    mockTier = 'stars_pro';

    const res = await callRoute({ content: 'Entry for pro user' }, 'valid_jwt_token');
    // stars_pro has Infinity limit — should not return 402
    expect(res.status).not.toBe(402);
  });

  it('returns JSON content-type on success', async () => {
    const res = await callRoute({ content: 'test' }, 'valid_jwt_token');
    expect(res.headers.get('Content-Type')).toContain('application/json');
  });

  it('entry count at limit - 1 is allowed (not yet exceeded)', async () => {
    mockEntryCount = 99; // one below free tier limit of 100
    mockTier = 'free';

    const res = await callRoute({ content: 'Still allowed' }, 'valid_jwt_token');
    expect(res.status).toBe(201);
  });
});
