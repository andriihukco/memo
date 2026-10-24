import { describe, it, expect, vi, afterEach } from 'vitest';
import { isDevAuthAllowed } from '@/lib/dev-auth';

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  rateLimitResponse: vi.fn(),
}));

afterEach(() => vi.unstubAllEnvs());

describe('isDevAuthAllowed', () => {
  it.each([
    ['production', 'localhost:3000', false],
    ['development', 'localhost:3000', true],
    ['development', '127.0.0.1:3001', true],
    ['development', '[::1]:3000', true],
    ['development', 'memo.vercel.app', false],
    ['development', 'localhost.evil.com', false],
    ['development', null, false],
    ['test', 'localhost', false],
  ])('%s %s -> %s', (env, host, want) => {
    expect(isDevAuthAllowed(env, host)).toBe(want);
  });
});

describe('POST /api/auth/dev guards', () => {
  const call = async (host: string) => {
    const { POST } = await import('@/app/api/auth/dev/route');
    return POST(new Request('http://x/api/auth/dev', { method: 'POST', headers: { host }, body: '{}' }));
  };
  it('404 in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await call('localhost:3000');
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('');
  });
  it('404 for non-local host in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const res = await call('example.com');
    expect(res.status).toBe(404);
  });
});
