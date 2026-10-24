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
    ['journal', '/miniapp', true],
    ['journal', '/miniapp/entry/42', true],
    ['journal', '/miniapp/insights', false],
    ['insights', '/miniapp/insights', true],
    ['insights', '/miniapp/insights/reports/7', true],
    ['insights', '/miniapp/insightsx', false],
    ['you', '/miniapp/you/plan', true],
    ['you', '/miniapp', false],
  ] as const)('%s on %s → %s', (tab, path, want) => expect(isTabActive(tab, path)).toBe(want));
});

describe('TabBar', () => {
  it('marks only the active tab with aria-current and semibold', () => {
    nav.pathname = '/miniapp/you/categories';
    render(<TabBar />);
    const you = screen.getByRole('link', { name: 'shell.you' });
    expect(you.getAttribute('aria-current')).toBe('page');
    expect(you.className).toContain('font-semibold');
    expect(screen.getByRole('link', { name: 'shell.journal' }).getAttribute('aria-current')).toBeNull();
  });

  it('Compose opens the drawer and announces a saved draft', () => {
    compose.hasDraft = true;
    render(<TabBar />);
    fireEvent.click(screen.getByRole('button', { name: 'shell.compose_draft' }));
    expect(compose.open).toHaveBeenCalled();
  });
});
