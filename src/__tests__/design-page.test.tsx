// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { DesignPage } from '@/components/design/design-page';
import { WIKI } from '@/components/design/wiki/wiki-content';

afterEach(cleanup);

describe('/design page', () => {
  it('renders every documented section', () => {
    render(<DesignPage />);
    for (const id of ['foundations', 'atoms', 'molecules', 'organisms', 'platforms', 'references', 'wiki']) {
      expect(document.getElementById(id)).not.toBeNull();
    }
    expect(screen.getByRole('heading', { level: 1, name: 'Design' })).toBeTruthy();
  });

  it('switches the simulated platform frame', () => {
    render(<DesignPage />);
    const frame = () => document.querySelector('[data-platform]')?.getAttribute('data-platform');
    expect(frame()).toBe('web');
    fireEvent.click(screen.getByRole('radio', { name: 'Preview as iOS' }));
    expect(frame()).toBe('ios');
    fireEvent.click(screen.getByRole('radio', { name: 'Preview as Android' }));
    expect(frame()).toBe('android');
  });

  it('updates the Button snippet when a prop changes', () => {
    render(<DesignPage />);
    const atoms = document.getElementById('atoms') as HTMLElement;
    const variantSelect = within(atoms).getAllByRole('combobox')[0];
    fireEvent.change(variantSelect, { target: { value: 'destructive' } });
    expect(atoms.textContent).toContain('variant="destructive"');
  });

  it('switches the foundations token set between light and dark', () => {
    render(<DesignPage />);
    const block = () => document.querySelector('[data-token-set]') as HTMLElement;
    expect(block().dataset.tokenSet).toBe('light');
    fireEvent.click(screen.getByRole('radio', { name: 'Dark tokens' }));
    expect(block().dataset.tokenSet).toBe('dark');
    expect(block().classList.contains('dark')).toBe(true);
  });

  it('gives every wiki entry a source reference', () => {
    for (const category of Object.values(WIKI)) {
      for (const entry of category.entries) {
        expect(entry.refs.length, entry.title).toBeGreaterThan(0);
      }
    }
  });
});
