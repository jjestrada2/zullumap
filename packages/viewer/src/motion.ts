import { classIndex } from '@zullumap/core/src/classify';
import type { Legend } from '@zullumap/core/src/compile';

/** One motion moment per page (design re-review D4): print + tilt, or one orbit; nothing under reduced motion. */
export function openingMotion(args: { loading: 'ink-pass' | 'bar'; reducedMotion: boolean }): { print: boolean; camera: 'tilt' | 'orbit' | 'none' } {
  if (args.reducedMotion) return { print: false, camera: 'none' };
  return args.loading === 'ink-pass' ? { print: true, camera: 'tilt' } : { print: false, camera: 'orbit' };
}

export const INK_STEP_MS = 250;
export const TILT_MS = 1500;
export const ORBIT_MS = 4000;

/** Ink-pass print order: one class per step, named after the nearest ink (DESIGN.md motion). */
export function inkSteps(args: { classCount: number; inks?: string[] }): { ink?: string; message: string }[] {
  const n = args.classCount, inks = args.inks;
  return Array.from({ length: n }, (_, i) => {
    if (!inks?.length) return { message: `Printing layer ${i + 1} of ${n}…` };
    const ink = inks[n === 1 ? inks.length - 1 : Math.round((i * (inks.length - 1)) / (n - 1))]!;
    return { ink, message: `Printing the ${ink} layer…` };
  });
}

interface ZmFeature { properties: Record<string, unknown> }

/** Features printed by the end of `step`: no-data features with the first ink, then classes 0..step. */
export function featuresThroughStep<F extends ZmFeature>(features: F[], legend: Pick<Legend, 'slot' | 'breaks'>, step: number): F[] {
  return features.filter(f => {
    const v = (f.properties.__zm as Record<string, number | null> | undefined)?.[legend.slot];
    return v === null || v === undefined || classIndex(v, legend.breaks) <= step;
  });
}
