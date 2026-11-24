import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { compile } from '@zullumap/core';
import { offline, writePage } from './pages';
import { manifest, deck, overlay } from '../test/fixture';

const grid = JSON.parse(readFileSync(new URL('../../../examples/bogota-grid.geojson', import.meta.url), 'utf8'));
const gridMapping = { value: 'density', height: 'density' };
const gridPage = () => writePage({ compiled: compile({ manifest, deck, data: grid, mapping: gridMapping, overlay }), mapping: gridMapping });

// Trailers record a 540×675 CSS-pixel page at 2× = a 1080×1350 video (design D5).
test.use({ viewport: { width: 540, height: 675 }, deviceScaleFactor: 2 });
const H = 675;

async function openCapture(page: import('@playwright/test').Page, url: string) {
  await page.goto(url + '?zm-capture');
  await page.waitForFunction(() => (window as any).zullumap?.isReady === true, null, { timeout: 45_000 });
}

test.beforeEach(async ({ context }) => { await offline(context); });

test('trailer layout: title and legend sit inside LinkedIn safe zones; no chip, button or sheet', async ({ page }) => {
  await openCapture(page, writePage());
  const title = (await page.locator('#zm-overlay').getByRole('heading').boundingBox())!;
  const legend = (await page.locator('#zm-overlay [data-zm-region=legend]').boundingBox())!;
  expect(title.y).toBeGreaterThanOrEqual(H * 0.08);
  expect(legend.y + legend.height).toBeLessThanOrEqual(H * 0.85);
  await expect(page.locator('#zm-chrome').getByRole('link', { name: /made with zullumap/ })).toHaveCount(0);
  await expect(page.locator('#zm-chrome').getByRole('button')).toHaveCount(0);
  const credits = (await page.locator('#zm-chrome .credits').boundingBox())!;
  expect(credits.y + credits.height).toBeLessThanOrEqual(H * 0.85);
});

test('no opening motion while recording: the recorder drives the camera', async ({ page }) => {
  await openCapture(page, writePage());
  expect(await page.locator('#zm-status').textContent()).toBe('');
  const b = () => page.evaluate(() => (window as any).zullumap.map.getBearing());
  const b0 = await b();
  await page.evaluate(() => (window as any).zullumap.renderFrame(0.5));
  expect(await b()).toBeGreaterThan(b0 + 20);
  await page.evaluate(() => (window as any).zullumap.renderFrame(0));
  expect(await b()).toBeCloseTo(b0, 5);
});

test('poster frame hides the overlay and chrome', async ({ page }) => {
  await openCapture(page, writePage());
  await page.evaluate(() => (window as any).zullumap.setDecorations(false));
  await expect(page.locator('#zm-overlay').getByRole('heading')).toBeHidden();
  await page.evaluate(() => (window as any).zullumap.setDecorations(true));
  await expect(page.locator('#zm-overlay').getByRole('heading')).toBeVisible();
});

test('end card: QR at least 300 video px wide, URL the largest text, chip below the URL (design D5)', async ({ page }) => {
  await openCapture(page, writePage());
  await page.evaluate(() => (window as any).zullumap.showEndCard());
  const card = page.locator('#zm-endcard');
  const qr = (await card.getByRole('img', { name: /QR code for https:\/\/jjestrada2\.github\.io/ }).boundingBox())!;
  expect(qr.width * 2).toBeGreaterThanOrEqual(300);
  const url = card.locator('.url');
  await expect(url).toHaveText('jjestrada2.github.io/zullumap/t/risograph-choropleth');
  const sizes = await card.locator('p').evaluateAll(ps => ps.map(p => parseFloat(getComputedStyle(p).fontSize)));
  const urlSize = await url.evaluate(p => parseFloat(getComputedStyle(p).fontSize));
  expect(urlSize).toBe(Math.max(...sizes));
  const u = (await url.boundingBox())!, chip = (await card.getByText('made with zullumap · remix').boundingBox())!;
  expect(chip.y).toBeGreaterThan(u.y + u.height - 1);
  for (const b of [qr, u, chip]) {
    expect(b.y).toBeGreaterThanOrEqual(H * 0.08);
    expect(b.y + b.height).toBeLessThanOrEqual(H * 0.85);
  }
});

test('the loading card and progress bar are gone before the first frame', async ({ page }) => {
  await openCapture(page, writePage());
  await expect(page.locator('#zm-poster')).toHaveCount(0);
});

test('the opening view keeps the data clear of the title and legend, and large', async ({ page }) => {
  await openCapture(page, gridPage());
  await page.evaluate(() => (window as any).zullumap.renderFrame(0));
  const box = await page.evaluate(() => {
    const m = (window as any).zullumap.map;
    const xs: number[] = [], ys: number[] = [];
    for (const f of JSON.parse(document.getElementById('zm-page')!.textContent!).features)
      for (const [x, y] of f.geometry.coordinates[0]) { const p = m.project([x, y]); xs.push(p.x); ys.push(p.y); }
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });
  const title = (await page.locator('#zm-overlay').getByRole('heading').boundingBox())!;
  const legend = (await page.locator('#zm-overlay [data-zm-region=legend]').boundingBox())!;
  const hits = (r: { x: number; y: number; width: number; height: number }) =>
    box.x0 < r.x + r.width && r.x < box.x1 && box.y0 < r.y + r.height && r.y < box.y1;
  expect(hits(title)).toBe(false);
  expect(hits(legend)).toBe(false);
  // Beside a 150px legend about 350 of 540px are free; the old above-the-legend framing gave 44%.
  expect((box.x1 - box.x0) / 540).toBeGreaterThan(0.55);
});

test('the end-card URL breaks only after slashes', async ({ page }) => {
  await openCapture(page, writePage());
  await page.evaluate(() => (window as any).zullumap.showEndCard());
  const lines = await page.locator('#zm-endcard .url').evaluate(el => {
    const r = document.createRange(), out: string[] = [];
    let line = '', top = -1;
    const text = el.textContent!;
    const node = [...el.childNodes].flatMap(n => (n.nodeType === 3 ? [n] : [...n.childNodes]));
    for (const n of node) for (let i = 0; i < n.textContent!.length; i++) {
      r.setStart(n, i); r.setEnd(n, i + 1);
      const t = Math.round(r.getBoundingClientRect().top);
      if (top !== -1 && t > top + 2) { out.push(line); line = ''; }
      top = t; line += n.textContent![i];
    }
    out.push(line);
    return { out, text };
  });
  expect(lines.out.join('')).toBe(lines.text);
  for (const l of lines.out.slice(0, -1)) expect(l.endsWith('/')).toBe(true);
});
