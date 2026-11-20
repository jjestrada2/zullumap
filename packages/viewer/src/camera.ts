export interface Camera { center: [number, number]; zoom: number; pitch: number; bearing: number }

/** Degrees the trailer orbits around the map. */
export const PATH_BEARING_SWEEP = 60;
const PITCH_LIFT = 8;
const ZOOM_PUSH = 0.2;

/**
 * Default fly-through for trailers: a slow partial orbit with a gentle push-in and a pitch lift that
 * returns to the opening pitch at the end. t runs 0..1; t = 0 is exactly the opening view (the poster).
 */
export function cameraAt(t: number, open: Camera, limits: { maxPitch: number; maxZoom: number }): Camera {
  const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // ease in-out
  return {
    center: open.center,
    bearing: open.bearing + PATH_BEARING_SWEEP * e,
    pitch: Math.min(limits.maxPitch, open.pitch + PITCH_LIFT * Math.sin(Math.PI * t)),
    zoom: Math.min(limits.maxZoom, open.zoom + ZOOM_PUSH * Math.sin(Math.PI * t)),
  };
}
