/**
 * Privacy: a user's exact home is never exposed. Everyone else sees an approximate
 * point snapped to the centre of a ~500 m grid cell. Snapping is deterministic, so
 * repeated requests can't be averaged to recover the true location.
 */
const CELL_DEG = 0.0045; // ≈ 500 m of latitude

export function approximate([lng, lat]) {
  const snap = (v) => Math.floor(v / CELL_DEG) * CELL_DEG + CELL_DEG / 2;
  const lngCell = CELL_DEG / Math.max(Math.cos((lat * Math.PI) / 180), 0.2);
  const snapLng = Math.floor(lng / lngCell) * lngCell + lngCell / 2;
  return [round(snapLng), round(snap(lat))];
}

const round = (n) => Math.round(n * 1e6) / 1e6;

export const point = (coordinates) => ({ type: 'Point', coordinates });

/** Great-circle distance in km between two [lng, lat] points. */
export function distanceKm([lng1, lat1], [lng2, lat2]) {
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}
