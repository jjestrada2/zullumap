import { describe, expect, test } from 'vitest';
import { openingMotion, inkSteps, featuresThroughStep } from '../src/motion';
import { compiled, manifest } from './fixture';

describe('opening motion (design re-review D4)', () => {
  test('ink-pass templates print, then tilt once; never orbit', () => {
    expect(openingMotion({ loading: 'ink-pass', reducedMotion: false })).toEqual({ print: true, camera: 'tilt' });
  });

  test('other templates orbit once', () => {
    expect(openingMotion({ loading: 'bar', reducedMotion: false })).toEqual({ print: false, camera: 'orbit' });
  });

  test('reduced motion: inks appear at once and the camera never moves', () => {
    expect(openingMotion({ loading: 'ink-pass', reducedMotion: true })).toEqual({ print: false, camera: 'none' });
    expect(openingMotion({ loading: 'bar', reducedMotion: true })).toEqual({ print: false, camera: 'none' });
  });
});

describe('ink-pass steps (DESIGN.md motion)', () => {
  test('prints one class per step, naming the ink nearest each class', () => {
    const steps = inkSteps({ classCount: 4, inks: manifest.inks });
    expect(steps.map(s => s.message)).toEqual(['Printing the teal layer…', 'Printing the pink layer…', 'Printing the coral layer…', 'Printing the mustard layer…']);
  });

  test('maps more classes than inks onto the nearest ink', () => {
    expect(inkSteps({ classCount: 7, inks: manifest.inks }).map(s => s.ink)).toEqual(['teal', 'pink', 'pink', 'coral', 'coral', 'mustard', 'mustard']);
  });

  test('falls back to "layer n of N" when the template names no inks', () => {
    expect(inkSteps({ classCount: 3 }).map(s => s.message)[1]).toBe('Printing layer 2 of 3…');
  });

  test('each step shows the features of every class printed so far; no-data features print first', () => {
    const legend = compiled.legend!;
    const feats = structuredClone(compiled.features);
    (feats[0]!.properties.__zm as Record<string, number | null>).value = null;
    expect(featuresThroughStep(feats, legend, 0).length).toBe(2); // no-data + value 2 (class 0 ≤ 2)
    expect(featuresThroughStep(feats, legend, 3).length).toBe(8);
  });
});
