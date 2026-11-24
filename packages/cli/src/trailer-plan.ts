import { join } from 'node:path';

/** The end card holds 3 seconds (design D5). */
export const END_CARD_SECONDS = 3;

export function framePlan(o: { duration: number; fps: number }) {
  const cameraFrames = Math.max(1, Math.round(o.duration * o.fps));
  const endCardFrames = END_CARD_SECONDS * o.fps;
  const times = Array.from({ length: cameraFrames }, (_, i) => (cameraFrames === 1 ? 0 : i / (cameraFrames - 1)));
  return { cameraFrames, endCardFrames, total: cameraFrames + endCardFrames, times };
}

/** ffmpeg arguments: numbered PNG frames → H.264 MP4 that plays in LinkedIn, phones and browsers. */
export function encodeArgs(o: { framesDir: string; fps: number; out: string }): string[] {
  return ['-y', '-loglevel', 'error', '-framerate', String(o.fps), '-i', join(o.framesDir, 'f%05d.png'),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(o.fps), o.out];
}
