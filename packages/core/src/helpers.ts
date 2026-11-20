import { classIndex } from './classify';

export type RGB = [number, number, number];

interface ZmFeature { properties?: { __zm?: Record<string, number | null> } | null }

/** Grey used for "no data" when a template doesn't set its own. */
export const NO_DATA_COLOR: RGB = [201, 197, 188];

/**
 * Named accessor factories registered with deck.gl's JSONConverter (eng review D14).
 * The compiled spec references them as { "@@function": "<name>", ...args }.
 * Isomorphic: used by the viewer in the browser and by tests in Node.
 */
export const accessorHelpers = {
  zmClassColor(args: { slot: string; breaks: number[]; colors: RGB[]; noData?: RGB }) {
    const noData = args.noData ?? NO_DATA_COLOR;
    return (f: ZmFeature): RGB => {
      const v = f.properties?.__zm?.[args.slot];
      if (v === null || v === undefined) return noData;
      return args.colors[classIndex(v, args.breaks)] ?? noData;
    };
  },
  zmHeight(args: { slot: string; max: number; scale: number }) {
    return (f: ZmFeature): number => {
      const v = f.properties?.__zm?.[args.slot];
      if (v === null || v === undefined || args.max <= 0) return 0;
      return (v / args.max) * args.scale;
    };
  },
};

/** Resample a hex ramp to exactly `n` RGB colors (linear interpolation in sRGB). */
export function resampleRamp(hexes: string[], n: number): RGB[] {
  const rgb = hexes.map(hexToRgb);
  if (n === 1) return [rgb[rgb.length - 1]!];
  return Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * (rgb.length - 1);
    const lo = Math.floor(t), hi = Math.min(rgb.length - 1, lo + 1), f = t - lo;
    const a = rgb[lo]!, b = rgb[hi]!;
    return [0, 1, 2].map(c => Math.round(a[c]! + (b[c]! - a[c]!) * f)) as RGB;
  });
}

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB;
}
