// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, renderHook, screen, cleanup, fireEvent } from '@testing-library/react';

const router = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/i18n/context', () => ({ useI18n: () => ({ t: (k: string) => k }) }));

import { useBack } from '@/components/shell/back';
import { PageHeader } from '@/components/shell/page-header';

const BackButton = { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() };
const setTelegram = (initData: string) => {
  (window as unknown as { Telegram: unknown }).Telegram = { WebApp: { initData, BackButton } };
};

beforeAll(() => {
  window.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  } as never;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useBack', () => {
  it('wires BackButton to router.back and removes that same handler on cleanup', () => {
    setTelegram('auth');
    const { unmount } = renderHook(() => useBack(true));
    expect(BackButton.show).toHaveBeenCalled();
    const handler = BackButton.onClick.mock.calls[0][0];
    handler();
    expect(router.back).toHaveBeenCalled();

    unmount();
    expect(BackButton.offClick).toHaveBeenCalledWith(handler);
    expect(BackButton.hide).toHaveBeenCalled();
    expect(BackButton.offClick.mock.invocationCallOrder[0]).toBeLessThan(BackButton.hide.mock.invocationCallOrder[0]);
  });

  it('does nothing when disabled', () => {
    setTelegram('auth');
    renderHook(() => useBack(false));
    expect(BackButton.show).not.toHaveBeenCalled();
  });
});

describe('PageHeader back chevron', () => {
  it('is hidden inside Telegram (initData present)', () => {
    setTelegram('auth');
    render(<PageHeader title="T" back />);
    expect(screen.queryByRole('button', { name: 'shell.back' })).toBeNull();
  });

  it('is shown outside Telegram (no initData) and goes back', () => {
    setTelegram('');
    render(<PageHeader title="T" back />);
    fireEvent.click(screen.getByRole('button', { name: 'shell.back' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('renders exactly one h1', () => {
    setTelegram('');
    render(<PageHeader title="T" />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
