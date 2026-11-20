import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { withPoster } from '@zullumap/viewer/src/page';
import type { TrailerArgs } from './args';
import { encodeArgs, framePlan } from './trailer-plan';

const require = createRequire(import.meta.url);
const MAX_POSTER_BYTES = 200 * 1024;
/** Pages render at half size and 2× density, so text and the QR are sized for phones watching a 1080 px video. */
const DPR = 2;

export interface TrailerIo { err(line: string): void; progress(line: string): void }

/** Record the map page's fly-through frame by frame and encode an MP4 (spike T1 contract), then add the poster to the page. */
export async function recordTrailer(a: TrailerArgs, io: TrailerIo): Promise<{ out: string; poster: boolean }> {
  const dir = resolve(a.map);
  const index = join(dir, 'index.html');
  if (!existsSync(index) || !readFileSync(index, 'utf8').includes('id="zm-page"')) {
    throw new Error(`No zullumap map in ${dir} (make one with zullumap render)`);
  }
  const { chromium, ffmpeg } = await videoTools(io);
  const plan = framePlan(a);
  const frames = mkdtempSync(join(tmpdir(), 'zm-frames-'));
  const browser = await launch(chromium, io);
  try {
    const context = await browser.newContext({ viewport: { width: a.width / DPR, height: a.height / DPR }, deviceScaleFactor: DPR });
    // Only the page itself, its basemap and fonts load while recording (trust model).
    const allowed = allowedHosts(readFileSync(index, 'utf8'));
    await context.route(/^https?:/, route => (allowed.has(new URL(route.request().url()).host) ? route.continue() : route.abort()));
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(index).href + '?zm-capture');
    try {
      await page.waitForFunction(() => (window as unknown as { zullumap?: { isReady: boolean } }).zullumap?.isReady === true, null, { timeout: 60_000 });
    } catch {
      const status = await page.locator('#zm-status').textContent().catch(() => '');
      throw new Error(`The map didn't load in the recording browser${status ? `: ${status}` : ''}${errors.length ? ` (${errors[0]})` : ''}`);
    }
    await page.evaluate(() => document.fonts.ready);

    // Poster: the opening view without overlay, as a small JPEG (eng re-review D16).
    await page.evaluate(() => (window as any).zullumap.setDecorations(false));
    await page.evaluate(() => (window as any).zullumap.renderFrame(0));
    const poster = await posterJpeg(page);
    await page.evaluate(() => (window as any).zullumap.setDecorations(true));

    const name = (i: number) => join(frames, `f${String(i).padStart(5, '0')}.png`);
    for (const [i, t] of plan.times.entries()) {
      await page.evaluate(t => (window as any).zullumap.renderFrame(t), t);
      await page.screenshot({ path: name(i) });
      io.progress(`Recording frame ${i + 1} of ${plan.cameraFrames}`);
    }
    await page.evaluate(() => (window as any).zullumap.showEndCard());
    await page.screenshot({ path: name(plan.cameraFrames) });
    for (let i = plan.cameraFrames + 1; i < plan.total; i++) copyFileSync(name(plan.cameraFrames), name(i));
    io.progress('');
    if (errors.length) throw new Error(`The map page reported an error while recording: ${errors[0]}`);

    const out = resolve(a.out);
    const enc = spawnSync(ffmpeg, encodeArgs({ framesDir: frames, fps: a.fps, out }), { encoding: 'utf8' });
    if (enc.status !== 0) throw new Error(`Video encoding failed: ${(enc.stderr || enc.error?.message || '').trim()}`);

    if (poster) writeFileSync(index, withPoster(readFileSync(index, 'utf8'), poster));
    else io.err('Warning: the poster image came out over 200 KB, so the page keeps its title card');
    return { out, poster: Boolean(poster) };
  } finally {
    await browser.close();
    rmSync(frames, { recursive: true, force: true });
  }
}

async function posterJpeg(page: import('playwright').Page): Promise<string | null> {
  for (const quality of [80, 70, 60, 50, 40]) {
    const buf = await page.screenshot({ type: 'jpeg', quality });
    if (buf.length <= MAX_POSTER_BYTES) return `data:image/jpeg;base64,${buf.toString('base64')}`;
  }
  return null;
}

/** Hosts the recording page may reach: Google Fonts and the basemap's tile/style hosts. */
function allowedHosts(html: string): Set<string> {
  const hosts = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
  const json = /<script type="application\/json" id="zm-page">(.*?)<\/script>/s.exec(html)?.[1];
  const basemap = json ? (JSON.parse(json) as { basemap?: Record<string, unknown> | null }).basemap : null;
  const visit = (v: unknown) => {
    if (typeof v === 'string' && /^https?:\/\//.test(v)) hosts.add(new URL(v.replace(/\{[^}]+\}/g, '0')).host);
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(basemap);
  return hosts;
}

/** Playwright's Chromium and ffmpeg; installed on the first trailer run (design re-review D7). */
async function videoTools(io: TrailerIo) {
  let ffmpeg = require('ffmpeg-static') as string | null;
  if (!ffmpeg || !existsSync(ffmpeg)) {
    io.err('Setting up video tools (one time, ~150 MB)…');
    const r = spawnSync(process.execPath, [require.resolve('ffmpeg-static/install.js')], { stdio: 'inherit' });
    ffmpeg = require('ffmpeg-static') as string | null;
    if (r.status !== 0 || !ffmpeg || !existsSync(ffmpeg)) throw new Error('Could not install ffmpeg; check your internet connection and run the trailer again');
  }
  const { chromium } = await import('playwright');
  return { chromium, ffmpeg };
}

type Chromium = typeof import('playwright').chromium;

/** GPU WebGL on macOS (ANGLE Metal, spike T1: ~300 ms/frame); software WebGL elsewhere. Installs Chromium if missing. */
async function launch(chromium: Chromium, io: TrailerIo) {
  const args = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [];
  try {
    return await chromium.launch({ args });
  } catch (e) {
    if (!/Executable doesn't exist|install/i.test((e as Error).message)) throw e;
    io.err('Setting up video tools (one time, ~150 MB)…');
    const r = spawnSync(process.execPath, [require.resolve('playwright/cli.js'), 'install', 'chromium'], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('Could not install the recording browser; check your internet connection and run the trailer again');
    return chromium.launch({ args });
  }
}
