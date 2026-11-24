export interface Camera { center: [number, number]; zoom: number; pitch: number; bearing: number }

/** Degrees the trailer orbits around the map. */
export const PATH_BEARING_SWEEP = 60;
const PITCH_LIFT = 8;
const ZOOM_PUSH = 0.2;

/**
 * Default fly-through for trailers: a slow partial orbit with a gentle push-in and a pitch lift that
 * returns to the opening pitch at the end. t runs 0..1; t = 0 is exactly the opening view (the poster).
 */
export function cameraAt(t: number, open: Camera, limits: { maxPitch: number; maxZoom: number }, sweep = PATH_BEARING_SWEEP): Camera {
  const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // ease in-out
  return {
    center: open.center,
    bearing: open.bearing + sweep * e,
    pitch: Math.min(limits.maxPitch, open.pitch + PITCH_LIFT * Math.sin(Math.PI * t)),
    zoom: Math.min(limits.maxZoom, open.zoom + ZOOM_PUSH * Math.sin(Math.PI * t)),
  };
}

/** Data wider than this (degrees of longitude) is treated as a world map. */
const WORLD_LON_SPAN = 270;
const WORLD_MAX_PITCH = 40;
const OPEN_BEARING = -15;

/**
 * The opening view for the data's extent. A full world can't be rotated or steeply tilted without its
 * corners leaving the screen (MapLibre won't zoom out past one world width), so world maps face north,
 * tilt at most 40° and don't orbit.
 */
export function openingCamera(a: { lonSpan: number; pitch: number; rules: { pitch: { min: number; max: number } } }) {
  if (a.lonSpan < WORLD_LON_SPAN) return { bearing: OPEN_BEARING, pitch: a.pitch, sweep: PATH_BEARING_SWEEP };
  return { bearing: 0, pitch: Math.max(a.rules.pitch.min, Math.min(a.pitch, WORLD_MAX_PITCH)), sweep: 0 };
}
