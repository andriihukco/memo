import { describe, expect, it } from 'vitest';
import { scaleFontSize, TEXT_SCALE_FACTOR } from '../palettes';

describe('text size', () => {
  it('medium keeps the design size', () => {
    expect(scaleFontSize(17, 'medium')).toBe(17);
  });

  it('small and large move in the expected direction', () => {
    expect(scaleFontSize(17, 'small')).toBeLessThan(17);
    expect(scaleFontSize(17, 'large')).toBeGreaterThan(17);
  });

  it('steps are ordered small < medium < large for every size', () => {
    for (const size of [11, 13, 15, 17, 22, 34]) {
      const s = scaleFontSize(size, 'small');
      const m = scaleFontSize(size, 'medium');
      const l = scaleFontSize(size, 'large');
      expect(s).toBeLessThanOrEqual(m);
      expect(m).toBeLessThanOrEqual(l);
    }
  });

  it('uses the same factors as the web (90% / 100% / 115%)', () => {
    expect(TEXT_SCALE_FACTOR).toEqual({ small: 0.9, medium: 1, large: 1.15 });
  });
});
