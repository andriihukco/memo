/**
 * Walk tracking math: turns a stream of GPS fixes into distance and
 * "explored cells" (a fog-of-world style grid, not road snapping).
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Grid cell size in degrees of latitude (~25 m). */
export const CELL_DEGREES = 0.000225;

/** Stable key for the grid cell that contains a point. */
export function cellKey(p: GeoPoint): string {
  const row = Math.floor(p.latitude / CELL_DEGREES);
  // Longitude cells shrink with latitude; scale the step so cells stay roughly square.
  const lngStep = CELL_DEGREES / Math.max(Math.cos((p.latitude * Math.PI) / 180), 0.01);
  const col = Math.floor(p.longitude / lngStep);
  return `${row}:${col}`;
}

/** Ignore fixes this noisy (metres) or jumps this far in one step (metres) — GPS glitches. */
const MAX_ACCURACY_M = 30;
const MAX_STEP_M = 100;

export interface WalkState {
  distanceM: number;
  cells: Set<string>;
  last: GeoPoint | null;
}

export function createWalkState(): WalkState {
  return { distanceM: 0, cells: new Set(), last: null };
}

/** Feed one GPS fix. Returns the same state object, mutated, for cheap updates. */
export function addFix(state: WalkState, fix: GeoPoint & { accuracy?: number | null }): WalkState {
  if (fix.accuracy != null && fix.accuracy > MAX_ACCURACY_M) return state;
  state.cells.add(cellKey(fix));
  if (state.last) {
    const step = distanceMeters(state.last, fix);
    if (step <= MAX_STEP_M) state.distanceM += step;
  }
  state.last = { latitude: fix.latitude, longitude: fix.longitude };
  return state;
}

/** Explored area in square metres, approximated from cell count. */
export function exploredAreaM2(state: WalkState): number {
  const cellSideM = (CELL_DEGREES * EARTH_RADIUS_M * Math.PI) / 180;
  return state.cells.size * cellSideM * cellSideM;
}
