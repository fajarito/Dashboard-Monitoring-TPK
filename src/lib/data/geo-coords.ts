/** Lat Indonesia ~ -11..6, lng ~ 95..141 — buang outlier jelas invalid. */
export function isValidIdCoords(
  lat: number | null,
  lng: number | null,
): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -11.5 || lat > 6.5) return false;
  if (lng < 94.5 || lng > 141.5) return false;
  return true;
}
