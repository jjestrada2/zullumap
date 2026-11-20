import { expect, test } from '@playwright/test';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const bin = join(root, 'packages/cli/bin/zullumap.js');
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static') as string;
const LINK = 'https://jjestrada2.github.io/zullumap/t/risograph-choropleth@1.0.0#r=0;c5';

test.setTimeout(180_000);

test('zullumap trailer records an MP4 whose end card QR decodes to the remix link, and adds the poster (D5, D12, D16)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'zm-trailer-'));
  const map = join(dir, 'my-map');
  const opts = join(dir, 'o.json');
  writeFileSync(opts, JSON.stringify({ classCount: 5 }));
  execFileSync(process.execPath, [bin, 'render', 'risograph-choropleth@1.0.0', '--template-dir', join(root, 'templates/risograph-choropleth'),
    '--data', join(root, 'examples/bogota-grid.geojson'), '--map', 'value=density', '--map', 'height=density',
    '--title', 'Density in Bogotá (synthetic)', '--options', opts, '--out', map, '--no-open']);
  expect(readFileSync(join(map, 'index.html'), 'utf8')).toContain('class="zm-card"');

  // Smoke trailer, as in CI (eng review D8): 1 s at 10 fps plus the 3 s end card.
  const r = spawnSync(process.execPath, [bin, 'trailer', map, '--duration', '1', '--fps', '10'], { encoding: 'utf8' });
  expect(r.status, r.stderr).toBe(0);
  const mp4 = join(map, 'trailer.mp4');
  expect(r.stdout).toContain(`Saved your trailer: ${mp4}`);
  expect(existsSync(mp4)).toBe(true);

  // Duration and size from ffmpeg's own report.
  const info = spawnSync(ffmpeg, ['-i', mp4], { encoding: 'utf8' }).stderr;
  expect(info).toMatch(/Duration: 00:00:04\.0/);
  expect(info).toMatch(/1080x1350/);

  // The last frame, decoded from the H.264 file, holds a QR that reads back the full remix link.
  const last = join(dir, 'last.png');
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-sseof', '-0.2', '-i', mp4, '-frames:v', '1', last]);
  const png = PNG.sync.read(readFileSync(last));
  expect(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data).toBe(LINK);

  // The first frame is the drawn map, not a blank canvas.
  const first = join(dir, 'first.png');
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', mp4, '-frames:v', '1', first]);
  const f = PNG.sync.read(readFileSync(first));
  const colors = new Set<number>();
  for (let i = 0; i < f.data.length; i += 4 * 97) colors.add((f.data[i]! >> 4) << 8 | (f.data[i + 1]! >> 4) << 4 | (f.data[i + 2]! >> 4));
  expect(colors.size).toBeGreaterThan(20);

  // The page now opens with the poster instead of the title card.
  const html = readFileSync(join(map, 'index.html'), 'utf8');
  expect(html).toMatch(/<div id="zm-poster"[^>]*><!--zm-poster--><img src="data:image\/jpeg;base64,/);
  const poster = /src="data:image\/jpeg;base64,([^"]+)"/.exec(html)![1]!;
  expect(Buffer.from(poster, 'base64').length).toBeLessThanOrEqual(200 * 1024);
});

test('zullumap trailer explains a folder that is not a map page', () => {
  const r = spawnSync(process.execPath, [bin, 'trailer', tmpdir()], { encoding: 'utf8' });
  expect(r.status).toBe(1);
  expect(r.stderr).toMatch(/^zullumap: No zullumap map in /);
});
