import { describe, expect, test } from 'vitest';
import { cameraAt, PATH_BEARING_SWEEP } from '../src/camera';

const open = { center: [-74, 4.6] as [number, number], zoom: 11, pitch: 50, bearing: -15 };
const limits = { maxPitch: 55, maxZoom: 16 };

describe('trailer camera path', () => {
  test('starts exactly at the opening view, so frame 0 matches the poster', () => {
    expect(cameraAt(0, open, limits)).toEqual(open);
  });

  test('sweeps the bearing steadily across the trailer', () => {
    const b = [0, 0.25, 0.5, 0.75, 1].map(t => cameraAt(t, open, limits).bearing);
    expect(b[4]! - b[0]!).toBeCloseTo(PATH_BEARING_SWEEP);
    for (let i = 1; i < b.length; i++) expect(b[i]!).toBeGreaterThan(b[i - 1]!);
  });

  test('stays within the template pitch and zoom limits', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const c = cameraAt(t, open, limits);
      expect(c.pitch).toBeLessThanOrEqual(limits.maxPitch);
      expect(c.zoom).toBeLessThanOrEqual(limits.maxZoom);
    }
  });

  test('ends back at the opening pitch so the end card follows a calm frame', () => {
    expect(cameraAt(1, open, limits).pitch).toBeCloseTo(open.pitch);
  });
});
