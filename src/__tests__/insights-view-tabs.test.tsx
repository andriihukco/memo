// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/miniapp/insights',
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock('@/lib/i18n/context', () => ({ useI18n: () => ({ t: (k: string) => k }) }));
vi.mock('@/components/shell/page-header', () => ({
  PageHeader: ({ title, children }: { title: string; children?: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {children}
    </header>
  ),
}));
vi.mock('@/components/legacy/pages/dashboard', () => ({ default: () => <p>legacy-dashboard</p> }));
vi.mock('@/components/legacy/pages/reports', () => ({ default: () => <p>legacy-reports</p> }));
vi.mock('@/components/legacy/pages/graph', () => ({ default: () => <p>legacy-graph</p> }));
vi.mock('@/components/features/goals/goals-content', () => ({ GoalsContent: () => <p>goals-content</p> }));

import InsightsPage from '@/app/miniapp/insights/page';

afterEach(() => {
  cleanup();
  nav.replace.mockClear();
});

const tab = (v: string) => screen.getByRole('tab', { name: `insights.view.${v}` });

describe('Insights view tabs', () => {
  it.each([
    ['', 'widgets', 'legacy-dashboard'],
    ['view=overview', 'widgets', 'legacy-dashboard'],
    ['view=widgets', 'widgets', 'legacy-dashboard'],
    ['view=goals', 'goals', 'goals-content'],
    ['view=reports', 'reports', 'legacy-reports'],
    ['view=graph', 'graph', 'legacy-graph'],
    ['view=bogus', 'widgets', 'legacy-dashboard'],
  ])('?%s → %s tab active, renders %s', (search, active, body) => {
    nav.search = search;
    render(<InsightsPage />);
    expect(tab(active).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(body)).toBeTruthy();
  });

  it.each([
    ['x=1', 'reports', '/miniapp/insights?x=1&view=reports'],
    ['x=1', 'goals', '/miniapp/insights?x=1&view=goals'],
    ['view=goals&x=1', 'widgets', '/miniapp/insights?view=widgets&x=1'],
  ])('from ?%s selecting %s → router.replace(%s)', (search, v, url) => {
    nav.search = search;
    render(<InsightsPage />);
    fireEvent.mouseDown(tab(v), { button: 0 }); // Radix activates tabs on mousedown
    expect(nav.replace).toHaveBeenCalledWith(url, { scroll: false });
  });
});
