import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { categoryHue, categoryStyle } from '@/lib/categories';

describe('categories', () => {
  it('categoryHue is stable and in 1..12', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const n = categoryHue(s);
        expect(n).toBe(categoryHue(s));
        expect(Number.isInteger(n) && n >= 1 && n <= 12).toBe(true);
      }),
    );
  });

  it('categoryStyle exposes --cat', () => {
    expect(categoryStyle('food')).toEqual({ '--cat': `var(--cat-${categoryHue('food')})` });
  });
});
