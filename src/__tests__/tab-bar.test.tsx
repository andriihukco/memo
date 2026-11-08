// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const nav = vi.hoisted(() => ({ pathname: '/miniapp' }));
const compose = vi.hoisted(() => ({ open: vi.fn(), hasDraft: false }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));
vi.mock('@/components/features/compose/compose-drawer', () => ({ useCompose: () => compose }));
vi.mock('@/lib/sound/use-sound', () => ({ useSound: () => ({ play: vi.fn() }) }));
vi.mock('@/lib/i18n/context', () => ({ useI18n: () => ({ t: (k: string) => k }) }));

import { TabBar, isTabActive } from '@/components/shell/tab-bar';

afterEach(cleanup);

describe('isTabActive', () => {
  it.each([
    ['today', '/miniapp', true],
    ['today', '/miniapp/journal', false],
    ['journal', '/miniapp/journal', true],
    ['journal', '/miniapp/entry/42', true],
    ['journal', '/miniapp', false],
    ['trends', '/miniapp/insights', true],
    ['trends', '/miniapp/insights/reports/7', true],
    ['trends', '/miniapp/graph', true],
    ['trends', '/miniapp/goals', true],
    ['trends', '/miniapp/insightsx', false],
  ] as const)('%s on %s → %s', (tab, path, want) => expect(isTabActive(tab, path)).toBe(want));
});

describe('TabBar', () => {
  it('marks only the active tab with aria-current and semibold', () => {
    nav.pathname = '/miniapp/graph';
    render(<TabBar />);
    const trends = screen.getByRole('link', { name: 'shell.trends' });
    expect(trends.getAttribute('aria-current')).toBe('page');
    expect(trends.className).toContain('font-semibold');
    expect(screen.getByRole('link', { name: 'shell.today' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: 'shell.journal' }).getAttribute('aria-current')).toBeNull();
  });

  it('has no You tab: Settings opens from the header instead', () => {
    nav.pathname = '/miniapp';
    render(<TabBar />);
    expect(screen.queryByRole('link', { name: 'shell.you' })).toBeNull();
  });

  it('Compose opens the drawer and announces a saved draft', () => {
    compose.hasDraft = true;
    render(<TabBar />);
    fireEvent.click(screen.getByRole('button', { name: 'shell.compose_draft' }));
    expect(compose.open).toHaveBeenCalled();
  });
});
