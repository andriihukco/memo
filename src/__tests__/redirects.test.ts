import { describe, it, expect } from 'vitest';
import config from '../../next.config.mjs';

const EXPECTED: [string, string][] = [
  ['/miniapp/dashboard', '/miniapp/insights?view=overview'],
  ['/miniapp/reports', '/miniapp/insights?view=reports'],
  ['/miniapp/settings', '/miniapp/you'],
  ['/miniapp/subscriptions', '/miniapp/you/plan'],
  ['/miniapp/categories', '/miniapp/you/categories'],
  ['/miniapp/onboarding', '/miniapp'],
];

describe('legacy route redirects', () => {
  it('maps every old route to its new home, temporarily and without :path*', async () => {
    const redirects = await config.redirects!();
    for (const [source, destination] of EXPECTED) {
      const r = redirects.find((x) => x.source === source);
      expect(r, source).toMatchObject({ source, destination, permanent: false });
      expect(r!.source).not.toContain(':path*'); // Next appends the incoming query itself
    }
  });
});
