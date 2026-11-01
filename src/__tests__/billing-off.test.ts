/**
 * While BILLING_ENABLED is false, every account is open-access:
 *  - server tier lookups return OPEN_ACCESS_TIER without reading the database
 *  - GET /api/profile hides the stored tier and subscription dates
 *  - paid-only processing (weekly retro) runs for everyone
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test_service_role_key',
    SUPABASE_ANON_KEY: 'test_anon_key',
    ENTRY_ENCRYPTION_PEPPER: 'test-pepper-for-billing-off-tests-32b!!',
    TELEGRAM_BOT_TOKEN: 'test_bot_token',
    GEMINI_API_KEY: 'test_gemini_api_key',
  },
}));

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

import { BILLING_ENABLED, OPEN_ACCESS_TIER, hasPaidTier } from '@/lib/billing/plans';
import { getEffectiveTier, getUserTier } from '@/lib/stars/paywall';
import { GET } from '@/app/api/profile/route';

describe('billing switch (off)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is off and treats every account as the open-access tier', () => {
    expect(BILLING_ENABLED).toBe(false);
    expect(OPEN_ACCESS_TIER).toBe('stars_pro');
    expect(hasPaidTier('free')).toBe(true);
    expect(hasPaidTier(null)).toBe(true);
  });

  it('returns the open tier from server lookups without querying the database', async () => {
    expect(await getEffectiveTier('user-1')).toBe('stars_pro');
    expect(await getUserTier('user-1')).toBe('stars_pro');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('GET /api/profile hides the stored tier and subscription dates', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1', user_metadata: {} } }, error: null });
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: {
              id: 'user-1',
              subscription_tier: 'free',
              subscription_status: 'canceled',
              subscription_ends_at: '2020-01-01T00:00:00Z',
              subscription_start_date: null,
              trial_used: false,
            },
            error: null,
          }),
        }),
      }),
    });

    const res = await GET(new Request('http://localhost/api/profile', {
      headers: { Authorization: 'Bearer token' },
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.profile.subscription_tier).toBe('stars_pro');
    expect(json.profile.subscription_status).toBeNull();
    expect(json.profile.subscription_ends_at).toBeNull();
    expect(json.profile.trial_used).toBe(false);
  });
});
