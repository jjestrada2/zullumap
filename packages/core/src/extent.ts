/** Web Mercator can't show the poles; latitudes are clamped here, as maps clamp them. */
const MAX_LAT = 85.0511;
const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LON_EQUATOR = 111_320;
/** Smallest extent used for heights, so a single point or tiny feature still gets a visible height. */
const MIN_EXTENT_M = 1_000;

/**
 * Width of the data in meters: the wider side of its bounds (longitude measured at the middle latitude).
 * Heights are a share of this (design: defaults computed from the data), so a city and the world look alike.
 */
export function extentMeters(data: unknown): number {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const visit = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      const x = c[0] as number, y = Math.max(-MAX_LAT, Math.min(MAX_LAT, c[1] as number));
      w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
    } else if (Array.isArray(c)) c.forEach(visit);
  };
  const features = (data as { features?: { geometry?: { coordinates?: unknown } | null }[] })?.features ?? [];
  for (const f of features) visit(f.geometry?.coordinates);
  if (!Number.isFinite(w)) return MIN_EXTENT_M;
  const midLat = ((s + n) / 2) * (Math.PI / 180);
  const dx = (e - w) * M_PER_DEG_LON_EQUATOR * Math.cos(midLat);
  const dy = (n - s) * M_PER_DEG_LAT;
  return Math.max(MIN_EXTENT_M, dx, dy);
}
