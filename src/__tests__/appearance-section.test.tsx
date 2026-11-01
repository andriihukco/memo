// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const setTheme = vi.fn();
let theme: string | undefined = 'dark';

vi.mock('@/lib/theme-provider', () => ({
  useTheme: () => ({ theme, setTheme }),
}));
vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock('@/lib/haptics', () => ({ hapticImpact: vi.fn() }));

const { AppearanceSection } = await import('@/components/features/settings/appearance-section');

afterEach(() => {
  cleanup();
  setTheme.mockClear();
});

describe('AppearanceSection', () => {
  it('marks the stored choice as checked', () => {
    theme = 'dark';
    render(<AppearanceSection />);
    expect(screen.getByRole('radio', { name: /appearance\.dark/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: /appearance\.light/ }).getAttribute('aria-checked')).toBe('false');
  });

  it('falls back to system when no theme is stored yet', () => {
    theme = undefined;
    render(<AppearanceSection />);
    expect(screen.getByRole('radio', { name: /appearance\.system/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('writes the chosen theme', () => {
    theme = 'dark';
    render(<AppearanceSection />);
    fireEvent.click(screen.getByRole('radio', { name: /appearance\.light/ }));
    expect(setTheme).toHaveBeenCalledWith('light');
  });
});
