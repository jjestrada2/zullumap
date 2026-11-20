import { describe, expect, test } from 'vitest';
import { framePlan, encodeArgs, END_CARD_SECONDS } from '../src/trailer-plan';

describe('trailer frame plan', () => {
  test('camera frames cover the duration and the end card holds 3 s (design D5)', () => {
    const p = framePlan({ duration: 12, fps: 30 });
    expect(p.cameraFrames).toBe(360);
    expect(p.endCardFrames).toBe(END_CARD_SECONDS * 30);
    expect(p.total).toBe(450);
  });

  test('camera times run from 0 to 1 inclusive', () => {
    const p = framePlan({ duration: 1, fps: 10 });
    expect(p.times[0]).toBe(0);
    expect(p.times.at(-1)).toBe(1);
    expect(p.times).toHaveLength(10);
  });

  test('encodes H.264 in yuv420p with faststart so it plays in feeds and browsers', () => {
    const a = encodeArgs({ framesDir: '/f', fps: 30, out: '/o.mp4' });
    expect(a).toEqual(expect.arrayContaining(['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '30', '/o.mp4']));
    expect(a.join(' ')).toContain('/f/f%05d.png');
  });
});
