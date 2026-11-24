import { describe, expect, test } from 'vitest';
import { join } from 'node:path';
import { parseTrailerArgs } from '../src/args';

describe('parseTrailerArgs', () => {
  test('defaults: 1080×1350 (4:5 for LinkedIn), 12 s at 30 fps, trailer.mp4 inside the map folder', () => {
    expect(parseTrailerArgs(['my-map'])).toEqual({ map: 'my-map', width: 1080, height: 1350, duration: 12, fps: 30, out: join('my-map', 'trailer.mp4') });
  });

  test('reads --size, --duration, --fps and --out', () => {
    expect(parseTrailerArgs(['m', '--size', '1080x1920', '--duration', '1', '--fps', '10', '--out', 't.mp4']))
      .toMatchObject({ width: 1080, height: 1920, duration: 1, fps: 10, out: 't.mp4' });
  });

  test.each([
    [['m', '--size', '1080'], /--size must look like 1080x1350/],
    [['m', '--size', '100x100'], /between 320 and 2160/],
    [['m', '--size', '1081x1350'], /even/],
    [['m', '--duration', '40'], /--duration must be between 1 and 30 seconds/],
    [['m', '--fps', '90'], /--fps must be between 1 and 60/],
    [[], /Name the map folder/],
  ])('rejects %j', (argv, msg) => {
    expect(() => parseTrailerArgs(argv)).toThrow(msg);
  });
});
