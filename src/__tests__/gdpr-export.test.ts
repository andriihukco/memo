/**
 * Tests for GDPR Data Export — Task 5 (REQ-05)
 *
 * Covers:
 *  5.1 GET /api/profile/export — returns all user data including decrypted entries
 *  5.2 POST /api/profile/export/send — sends export via Telegram bot message
 *  5.4 Export includes: profile, entries, categories, reports, subscriptions, transactions
 *
 * Note: 5.3 (UI button) is verified by reading the settings page source — the
 * ExportSheet component and its trigger button are present in settings/page.tsx.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock Supabase ─────────────────────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

// ── Mock rate-limit (always allow) ────────────────────────────────────────────

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  rateLimitResponse: vi.fn(),
}));

// ── Mock crypto ───────────────────────────────────────────────────────────────

vi.mock('@/lib/crypto', () => ({
  deriveUserKey: vi.fn().mockResolvedValue('mock-crypto-key'),
  decryptField: vi.fn().mockImplementation((text: string) =>
    Promise.resolve(text.startsWith('enc:') ? text.slice(4) : text)
  ),
}));

// ── Mock env ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/env', () => ({
  env: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test_service_role_key',
    TELEGRAM_BOT_TOKEN: 'test_bot_token',
    ENTRY_ENCRYPTION_PEPPER: 'test_pepper_32_bytes_hex_value_xx',
  },
}));

// ── Test data ─────────────────────────────────────────────────────────────────

const TEST_USER_ID = 'test-user-uuid';
const TEST_TELEGRAM_ID = '123456789';

const mockProfile = {
  id: TEST_USER_ID,
  telegram_id: TEST_TELEGRAM_ID,
  username: 'testuser',
  settings: { language: 'uk' },
  subscription_tier: 'free',
  subscription_status: 'active',
  subscription_ends_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  encryption_salt: null,
};

const mockEntries = [
  { id: 'entry-1', content: 'enc:Went for a run today', category: 'workout', metadata: {}, created_at: '2024-01-01T10:00:00Z' },
  { id: 'entry-2', content: 'enc:Had a great meeting', category: 'work', metadata: { dashboard_metrics: [{ value: 5, unit: 'hours' }] }, created_at: '2024-01-02T10:00:00Z' },
  { id: 'entry-3', content: 'Plain text entry', category: 'thoughts', metadata: {}, created_at: '2024-01-03T10:00:00Z' },
];

const mockCategories = [
  { id: 'cat-1', name: 'workout', label_ua: 'Тренування', color: '#ff0000', icon: '🏃', created_at: '2024-01-01T00:00:00Z' },
  { id: 'cat-2', name: 'work', label_ua: 'Робота', color: '#0000ff', icon: '💼', created_at: '2024-01-01T00:00:00Z' },
];

const mockReports = [
  { id: 'report-1', period_type: 'weekly', period_from: '2024-01-01', period_to: '2024-01-07', summary: 'Great week!', created_at: '2024-01-07T00:00:00Z' },
];

const mockSubscriptions = [
  { id: 'sub-1', tier: 'stars_basic', status: 'expired', start_date: '2024-01-01', end_date: '2024-02-01', created_at: '2024-01-01T00:00:00Z' },
];

const mockTransactions = [
  { id: 'tx-1', amount: 100, currency: 'XTR', description: 'Memo Nova 1 month', status: 'completed', created_at: '2024-01-01T00:00:00Z' },
];

// ── Supabase mock setup ───────────────────────────────────────────────────────

function setupSupabaseMocks() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: TEST_USER_ID } },
    error: null,
  });

  mockFrom.mockImplementation((table: string) => {
    const makeChain = (resolvedData: unknown, isSingle = false) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: resolvedData, error: null }),
        then: isSingle
          ? undefined
          : vi.fn().mockImplementation((cb: (v: unknown) => unknown) =>
              Promise.resolve({ data: resolvedData, error: null }).then(cb)
            ),
      };
      return chain;
    };

    switch (table) {
      case 'profiles':
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
        };
      case 'entries':
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockEntries, error: null }),
        };
      case 'categories':
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockCategories, error: null }),
        };
      case 'reports':
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockReports, error: null }),
        };
      case 'subscriptions':
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockSubscriptions, error: null }),
        };
      case 'subscription_transactions':
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockTransactions, error: null }),
        };
      default:
        return makeChain(null);
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupSupabaseMocks();
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function callExportRoute(jwt?: string): Promise<Response> {
  const { GET } = await import('@/app/api/profile/export/route');
  const headers: Record<string, string> = {};
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
  const req = new Request('http://localhost/api/profile/export', { headers });
  return GET(req);
}

async function callExportSendRoute(jwt?: string): Promise<Response> {
  const { POST } = await import('@/app/api/profile/export/send/route');
  const headers: Record<string, string> = {};
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
  const req = new Request('http://localhost/api/profile/export/send', {
    method: 'POST',
    headers,
  });
  return POST(req);
}

// ── 5.1 GET /api/profile/export ───────────────────────────────────────────────

describe('GET /api/profile/export', () => {
  it('returns 401 when no JWT is provided', async () => {
    const res = await callExportRoute();
    expect(res.status).toBe(401);
  });

  it('returns 401 when JWT is invalid', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid JWT' } });
    const res = await callExportRoute('invalid_jwt');
    expect(res.status).toBe(401);
  });

  it('returns 200 with a ZIP file for authenticated user', async () => {
    const res = await callExportRoute('valid_jwt');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/zip');
  });

  it('response has Content-Disposition attachment header with .zip filename', async () => {
    const res = await callExportRoute('valid_jwt');
    const disposition = res.headers.get('Content-Disposition');
    expect(disposition).toMatch(/attachment/);
    expect(disposition).toMatch(/\.zip/);
  });

  it('response has Cache-Control: no-store header', async () => {
    const res = await callExportRoute('valid_jwt');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns a non-empty ZIP body', async () => {
    const res = await callExportRoute('valid_jwt');
    const buffer = await res.arrayBuffer();
    // ZIP files start with PK magic bytes (0x50 0x4B)
    const bytes = new Uint8Array(buffer);
    expect(bytes[0]).toBe(0x50); // 'P'
    expect(bytes[1]).toBe(0x4b); // 'K'
  });

  it('rate-limited export returns 429', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, resetAt: Date.now() + 3600_000, remaining: 0 });
    const { rateLimitResponse } = await import('@/lib/rate-limit');
    vi.mocked(rateLimitResponse).mockReturnValueOnce(
      new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 })
    );
    const res = await callExportRoute('valid_jwt');
    expect(res.status).toBe(429);
  });
});

// ── 5.2 POST /api/profile/export/send ────────────────────────────────────────

describe('POST /api/profile/export/send', () => {
  beforeEach(() => {
    // Mock the Telegram sendDocument API call to succeed
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
  });

  it('returns 401 when no JWT is provided', async () => {
    const res = await callExportSendRoute();
    expect(res.status).toBe(401);
  });

  it('returns 401 when JWT is invalid', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid JWT' } });
    const res = await callExportSendRoute('invalid_jwt');
    expect(res.status).toBe(401);
  });

  it('returns 200 with ok:true when Telegram send succeeds', async () => {
    const res = await callExportSendRoute('valid_jwt');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });

  it('calls Telegram sendDocument API with correct chat_id', async () => {
    await callExportSendRoute('valid_jwt');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('sendDocument'),
      expect.objectContaining({ method: 'POST' })
    );
    // Verify the chat_id matches the user's telegram_id
    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    const body = (options as RequestInit).body as FormData;
    expect(body.get('chat_id')).toBe(TEST_TELEGRAM_ID);
  });

  it('returns 502 when Telegram API fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, description: 'Bad Request' }), { status: 400 })
    );
    const res = await callExportSendRoute('valid_jwt');
    expect(res.status).toBe(502);
  });

  it('returns 400 when user has no linked Telegram account', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { ...mockProfile, telegram_id: null },
            error: null,
          }),
        };
      }
      // Return empty arrays for other tables
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });
    const res = await callExportSendRoute('valid_jwt');
    expect(res.status).toBe(400);
  });
});

// ── 5.4 Export data completeness ─────────────────────────────────────────────

describe('Export data completeness', () => {
  it('GET /api/profile/export queries all required tables', async () => {
    await callExportRoute('valid_jwt');

    // Verify all required tables were queried
    const calledTables = vi.mocked(mockFrom).mock.calls.map(([table]) => table);
    expect(calledTables).toContain('profiles');
    expect(calledTables).toContain('entries');
    expect(calledTables).toContain('categories');
    expect(calledTables).toContain('reports');
    expect(calledTables).toContain('subscriptions');
    expect(calledTables).toContain('subscription_transactions');
  });

  it('POST /api/profile/export/send queries all required tables', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    await callExportSendRoute('valid_jwt');

    const calledTables = vi.mocked(mockFrom).mock.calls.map(([table]) => table);
    expect(calledTables).toContain('profiles');
    expect(calledTables).toContain('entries');
    expect(calledTables).toContain('categories');
    expect(calledTables).toContain('reports');
    expect(calledTables).toContain('subscriptions');
    expect(calledTables).toContain('subscription_transactions');
  });

  it('decryptField is called for each encrypted entry', async () => {
    const { decryptField } = await import('@/lib/crypto');
    await callExportRoute('valid_jwt');
    // mockEntries has 3 entries — decryptField should be called for each
    expect(vi.mocked(decryptField)).toHaveBeenCalledTimes(mockEntries.length);
  });

  it('deriveUserKey is called with the user telegram_id', async () => {
    const { deriveUserKey } = await import('@/lib/crypto');
    await callExportRoute('valid_jwt');
    expect(vi.mocked(deriveUserKey)).toHaveBeenCalledWith(TEST_TELEGRAM_ID, null);
  });

  it('entries with enc: prefix are decrypted in the export', async () => {
    const { decryptField } = await import('@/lib/crypto');
    // Verify decryptField is called with the encrypted content
    await callExportRoute('valid_jwt');
    expect(vi.mocked(decryptField)).toHaveBeenCalledWith('enc:Went for a run today', 'mock-crypto-key');
    expect(vi.mocked(decryptField)).toHaveBeenCalledWith('enc:Had a great meeting', 'mock-crypto-key');
  });

  it('plain text entries (no enc: prefix) are passed through decryptField unchanged', async () => {
    const { decryptField } = await import('@/lib/crypto');
    await callExportRoute('valid_jwt');
    // Plain text entry should also be passed to decryptField (it returns it unchanged)
    expect(vi.mocked(decryptField)).toHaveBeenCalledWith('Plain text entry', 'mock-crypto-key');
  });
});

// ── 5.3 Settings page UI verification (static analysis) ──────────────────────

describe('Settings page — Export my data button', () => {
  it('ExportSheet component exists in settings page source', async () => {
    // This test verifies the UI button exists by importing the settings page module
    // and checking that the ExportSheet component is defined and used.
    // The actual rendering is verified by the presence of the component in the file.
    const fs = await import('fs');
    const path = await import('path');
    const settingsSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/miniapp/settings/page.tsx'),
      'utf-8'
    );
    expect(settingsSource).toContain('ExportSheet');
    expect(settingsSource).toContain('showExportSheet');
    expect(settingsSource).toContain('setShowExportSheet(true)');
    expect(settingsSource).toContain("miniapp.settings.export_data");
  });

  it('export_data i18n key exists in Ukrainian locale', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const ukJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'src/i18n/uk.json'), 'utf-8')
    );
    expect(ukJson['miniapp.settings.export_data']).toBeTruthy();
    expect(ukJson['miniapp.settings.export_data_desc']).toBeTruthy();
  });

  it('export_data i18n key exists in English locale', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const enJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'src/i18n/en.json'), 'utf-8')
    );
    expect(enJson['miniapp.settings.export_data']).toBeTruthy();
    expect(enJson['miniapp.settings.export_data_desc']).toBeTruthy();
  });
});
