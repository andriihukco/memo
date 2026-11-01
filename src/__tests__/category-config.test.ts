import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CATEGORY_SWATCHES, isHexColor, slugFromLabel, swatchFor } from '@/lib/category-config';

describe('category-config', () => {
  it('slugFromLabel makes ascii snake_case that starts with a letter', () => {
    expect(slugFromLabel('Gym days!')).toBe('gym_days');
    expect(slugFromLabel('  Café  Notes ')).toBe('cafe_notes');
    expect(slugFromLabel('3 meals')).toBe('c_3_meals');
  });

  it('slugFromLabel always returns a valid slug, even without latin letters', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (label) => {
        expect(slugFromLabel(label)).toMatch(/^[a-z][a-z0-9_]{0,47}$/);
      }),
    );
    expect(slugFromLabel('Здоров\'я')).toMatch(/^cat_[a-z0-9]+$/);
  });

  it('slugFromLabel never returns the reserved system name', () => {
    expect(slugFromLabel('uncategorized')).not.toBe('uncategorized');
  });

  it('isHexColor accepts six-digit hex only', () => {
    expect(isHexColor('#0A84FF')).toBe(true);
    expect(isHexColor('#0a84ff')).toBe(true);
    expect(isHexColor('bg-indigo-100 text-indigo-700')).toBe(false);
    expect(isHexColor('🏷️')).toBe(false);
    expect(isHexColor('#fff')).toBe(false);
  });

  it('swatchFor is stable and always picks from the shared palette', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(swatchFor(s)).toBe(swatchFor(s));
        expect(CATEGORY_SWATCHES).toContain(swatchFor(s));
      }),
    );
  });
});
