import { describe, expect, it } from 'vitest';
import { addFix, cellKey, createWalkState, distanceMeters, exploredAreaM2 } from '../walk-coverage';

const KYIV = { latitude: 50.4501, longitude: 30.5234 };

describe('distanceMeters', () => {
  it('is about 111 km per degree of latitude', () => {
    const d = distanceMeters({ latitude: 50, longitude: 30 }, { latitude: 51, longitude: 30 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });
});

describe('walk state', () => {
  it('accumulates distance and cells for clean fixes', () => {
    const s = createWalkState();
    addFix(s, { ...KYIV, accuracy: 5 });
    addFix(s, { latitude: KYIV.latitude + 0.0002, longitude: KYIV.longitude, accuracy: 5 });
    expect(s.distanceM).toBeGreaterThan(20);
    expect(s.distanceM).toBeLessThan(25);
    expect(s.cells.size).toBe(2);
    expect(exploredAreaM2(s)).toBeGreaterThan(0);
  });

  it('drops noisy fixes and glitchy jumps', () => {
    const s = createWalkState();
    addFix(s, { ...KYIV, accuracy: 5 });
    addFix(s, { latitude: KYIV.latitude + 0.0002, longitude: KYIV.longitude, accuracy: 80 });
    expect(s.cells.size).toBe(1);
    addFix(s, { latitude: KYIV.latitude + 0.01, longitude: KYIV.longitude, accuracy: 5 });
    expect(s.distanceM).toBe(0);
  });

  it('keeps the same cell for points inside one cell', () => {
    expect(cellKey(KYIV)).toBe(cellKey({ latitude: KYIV.latitude + 0.00001, longitude: KYIV.longitude }));
  });
});
