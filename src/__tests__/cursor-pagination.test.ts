/**
 * Tests for cursor-based pagination in GET /api/entries.
 *
 * REQ-10: Cursor-Based Pagination + Infinite Scroll
 *
 * Covers:
 *  - First page returns up to 30 entries + has_more=true when more exist
 *  - Cursor param fetches next page of entries older than the cursor
 *  - has_more=false and next_cursor=null when no more entries
 *  - A user with 150 entries can scroll through all of them in pages of 30
 *  - Legacy offset pagination still works (backward compat)
 *  - Unauthenticated request returns 401
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock Supabase ─────────────────────────────────────────────────────────────

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

// ── Mock crypto (no-op) ───────────────────────────────────────────────────────

vi.mock('@/lib/crypto', () => ({
  deriveUserKey: vi.fn().mockResolvedValue('mock-crypto-key'),
  encryptField: vi.fn().mockImplementation((text: string) => Promise.resolve(`enc:${text}`)),
  decryptField: vi.fn().mockImplementation((text: string) => Promise.resolve(text.replace(/^enc:/, ''))),
}));

// ── Mock paywall ──────────────────────────────────────────────────────────────

vi.mock('@/lib/stars/paywall', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stars/paywall')>();
  return {
    ...actual,
    getEffectiveTier: vi.fn(() => Promise.resolve('stars_pro')), // no history limit
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate N fake entries ordered newest-first */
function makeEntries(count: number, offsetMs = 0) {
  return Array.from({ length: count }, (_, i) => ({
    id: `entry-${String(i).padStart(4, '0')}`,
    content: `Entry ${i}`,
    category: 'thoughts',
    metadata: {},
    bot_reply: null,
    thread_id: null,
    reply_to_entry_id: null,
    // newest first: entry-0000 is most recent
    created_at: new Date(Date.now() - (i + offsetMs) * 1000).toISOString(),
  }));
}

/** Build a minimal Supabase query chain that resolves to `result` */
function makeQueryChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.lt = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.range = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  // Make the chain itself thenable so `await query` works
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  chain.catch = (reject: (e: unknown) => unknown) => Promise.resolve(result).catch(reject);
  return chain;
}

/**
 * Set up mocks for a GET /api/entries call.
 *
 * @param entries  The full list of entries the "DB" holds for this user
 * @param cursorCreatedAt  If provided, simulate cursor lookup returning this timestamp
 */
function setupGetMocks(entries: ReturnType<typeof makeEntries>, cursorCreatedAt?: string) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') {
      const chain = makeQueryChain({ data: { id: 'test-profile-uuid', telegram_id: '123', encryption_salt: null }, error: null });
      return chain;
    }

    if (table === 'entries') {
      // We need to intercept the cursor lookup (single()) vs the main query (thenable chain)
      let isCursorLookup = false;

      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockImplementation((_cols: string) => chain);
      chain.eq = vi.fn().mockImplementation((_col: string, _val: string) => {
        // cursor lookup: .eq('id', beforeParam).single()
        isCursorLookup = true;
        return chain;
      });
      chain.gte = vi.fn().mockReturnValue(chain);
      chain.lte = vi.fn().mockReturnValue(chain);
      chain.lt = vi.fn().mockImplementation((_col: string, _val: string) => {
        // After lt() is called with the cursor timestamp, filter entries
        if (cursorCreatedAt) {
          const filtered = entries.filter(e => e.created_at < cursorCreatedAt);
          chain._filteredEntries = filtered;
        }
        return chain;
      });
      chain.order = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation((n: number) => {
        chain._limit = n;
        return chain;
      });
      chain.range = vi.fn().mockImplementation((from: number, to: number) => {
        chain._range = { from, to };
        return chain;
      });
      chain.single = vi.fn().mockImplementation(() => {
        if (isCursorLookup && cursorCreatedAt) {
          return Promise.resolve({ data: { created_at: cursorCreatedAt }, error: null });
        }
        return Promise.resolve({ data: entries[0] ?? null, error: null });
      });

      // Make chain thenable — returns sliced entries based on limit
      chain.then = (resolve: (v: unknown) => unknown) => {
        const limit = (chain._limit as number | undefined) ?? entries.length;
        const filteredEntries = (chain._filteredEntries as typeof entries | undefined) ?? entries;
        const rangeInfo = chain._range as { from: number; to: number } | undefined;

        let result: typeof entries;
        if (rangeInfo) {
          result = filteredEntries.slice(rangeInfo.from, rangeInfo.to + 1);
        } else {
          result = filteredEntries.slice(0, limit);
        }
        return Promise.resolve({ data: result, error: null }).then(resolve);
      };
      chain.catch = (reject: (e: unknown) => unknown) =>
        Promise.resolve({ data: entries.slice(0, 31), error: null }).catch(reject);

      return chain;
    }

    // Default
    return makeQueryChain({ data: null, error: null });
  });
}

async function callGet(url: string, jwt = 'valid_jwt_token'): Promise<Response> {
  const { GET } = await import('@/app/api/entries/route');
  const req = new Request(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${jwt}` },
  });
  return GET(req);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test_anon_key';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/entries — cursor-based pagination', () => {
  it('unauthenticated request returns 401', async () => {
    const { GET } = await import('@/app/api/entries/route');
    const req = new Request('http://localhost/api/entries', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('first page returns entries with has_more and next_cursor', async () => {
    // 35 entries in DB — first page of 30 should have has_more=true
    const allEntries = makeEntries(35);
    setupGetMocks(allEntries);

    const res = await callGet('http://localhost/api/entries?limit=30');
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.entries).toHaveLength(30);
    expect(json.has_more).toBe(true);
    expect(json.next_cursor).toBe('entry-0029'); // last entry on first page
  });

  it('when fewer entries than limit, has_more=false and next_cursor=null', async () => {
    const allEntries = makeEntries(15);
    setupGetMocks(allEntries);

    const res = await callGet('http://localhost/api/entries?limit=30');
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.entries).toHaveLength(15);
    expect(json.has_more).toBe(false);
    expect(json.next_cursor).toBeNull();
  });

  it('response always includes has_more and next_cursor fields', async () => {
    const allEntries = makeEntries(5);
    setupGetMocks(allEntries);

    const res = await callGet('http://localhost/api/entries?limit=30');
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json).toHaveProperty('has_more');
    expect(json).toHaveProperty('next_cursor');
    expect(json).toHaveProperty('entries');
  });

  it('cursor param fetches entries older than the cursor entry', async () => {
    // 60 entries total; cursor points to entry-0029 (30th entry)
    const allEntries = makeEntries(60);
    const cursorEntry = allEntries[29]; // entry-0029
    setupGetMocks(allEntries, cursorEntry.created_at);

    const res = await callGet(`http://localhost/api/entries?limit=30&before=${cursorEntry.id}`);
    expect(res.status).toBe(200);
    const json = await res.json();

    // Should return entries older than cursor (entries 30-59)
    expect(json.entries.length).toBeGreaterThan(0);
    // All returned entries should be older than the cursor
    for (const entry of json.entries) {
      expect(entry.created_at < cursorEntry.created_at).toBe(true);
    }
  });

  it('user with 150 entries can scroll through all of them in pages of 30', async () => {
    // Simulate scrolling through 150 entries in 5 pages of 30
    const totalEntries = 150;
    const pageSize = 30;
    const expectedPages = totalEntries / pageSize; // 5 pages

    const collectedEntries: string[] = [];
    let cursor: string | null = null;
    let pageCount = 0;

    // Page 1: no cursor
    {
      const allEntries = makeEntries(totalEntries);
      setupGetMocks(allEntries);
      const url = `http://localhost/api/entries?limit=${pageSize}`;
      const res = await callGet(url);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.entries).toHaveLength(pageSize);
      expect(json.has_more).toBe(true);
      expect(json.next_cursor).not.toBeNull();

      collectedEntries.push(...json.entries.map((e: { id: string }) => e.id));
      cursor = json.next_cursor;
      pageCount++;
    }

    // Pages 2-4: use cursor
    for (let page = 2; page <= expectedPages - 1; page++) {
      const allEntries = makeEntries(totalEntries);
      const cursorEntry = allEntries.find(e => e.id === cursor)!;
      setupGetMocks(allEntries, cursorEntry.created_at);

      const url = `http://localhost/api/entries?limit=${pageSize}&before=${cursor}`;
      const res = await callGet(url);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.entries).toHaveLength(pageSize);
      expect(json.has_more).toBe(true);

      collectedEntries.push(...json.entries.map((e: { id: string }) => e.id));
      cursor = json.next_cursor;
      pageCount++;
    }

    // Last page (page 5): should have has_more=false
    {
      const allEntries = makeEntries(totalEntries);
      const cursorEntry = allEntries.find(e => e.id === cursor)!;
      setupGetMocks(allEntries, cursorEntry.created_at);

      const url = `http://localhost/api/entries?limit=${pageSize}&before=${cursor}`;
      const res = await callGet(url);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.entries).toHaveLength(pageSize);
      expect(json.has_more).toBe(false);
      expect(json.next_cursor).toBeNull();

      collectedEntries.push(...json.entries.map((e: { id: string }) => e.id));
      pageCount++;
    }

    // Verify we got all 150 entries across 5 pages
    expect(pageCount).toBe(expectedPages);
    expect(collectedEntries).toHaveLength(totalEntries);
    // No duplicates
    expect(new Set(collectedEntries).size).toBe(totalEntries);
  });

  it('legacy offset pagination still works (backward compat)', async () => {
    const allEntries = makeEntries(50);
    setupGetMocks(allEntries);

    const res = await callGet('http://localhost/api/entries?page=1&limit=20');
    expect(res.status).toBe(200);
    const json = await res.json();

    // Legacy offset mode: no has_more detection, returns entries as-is
    expect(json).toHaveProperty('entries');
    expect(json).toHaveProperty('page');
    // Legacy callers still get a response
    expect(json.entries.length).toBeGreaterThan(0);
  });

  it('empty DB returns empty entries with has_more=false', async () => {
    setupGetMocks([]);

    const res = await callGet('http://localhost/api/entries?limit=30');
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.entries).toHaveLength(0);
    expect(json.has_more).toBe(false);
    expect(json.next_cursor).toBeNull();
  });
});
