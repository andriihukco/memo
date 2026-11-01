import { describe, expect, it } from 'vitest';
import { palettes, resolveScheme } from '../palettes';

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('palettes', () => {
  for (const [name, p] of Object.entries(palettes)) {
    it(`${name}: text tokens meet WCAG AA (4.5:1) on background and card`, () => {
      for (const token of ['label', 'secondary', 'muted', 'destructive'] as const) {
        for (const surface of ['bg', 'card'] as const) {
          expect(contrast(p[token], p[surface]), `${token} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`${name}: filled button text meets 4.5:1`, () => {
      expect(contrast(p.onTint, p.tintFill)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('light and dark define the same tokens', () => {
    expect(Object.keys(palettes.light).sort()).toEqual(Object.keys(palettes.dark).sort());
  });
});

describe('resolveScheme', () => {
  it('uses an explicit choice regardless of the device', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('follows the device when the choice is system', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', 'dark')).toBe('dark');
  });

  it('falls back to dark when the device value is unknown', () => {
    expect(resolveScheme('system', null)).toBe('dark');
    expect(resolveScheme('system', undefined)).toBe('dark');
  });
});
