import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const BASE = '/zullumap';
const LINK = 'https://jjestrada2.github.io/zullumap/t/risograph-choropleth@1.0.0';
let server: Server, origin = '';

/** A static server like GitHub Pages: /zullumap/<path>, directory index.html, and 404.html for anything missing. */
test.beforeAll(async () => {
  const site = join(mkdtempSync(join(tmpdir(), 'zm-site-')), 'site');
  execFileSync(process.execPath, [join(root, 'packages/gallery/build.mjs'), '--out', site, '--templates', join(root, 'templates')], { stdio: 'inherit' });
  server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    if (!path.startsWith(BASE)) { res.writeHead(404); res.end(); return; }
    let file = join(site, path.slice(BASE.length));
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!path.endsWith('/')) { res.writeHead(301, { location: `${path}/` }); res.end(); return; }
      file = join(file, 'index.html');
    }
    const found = existsSync(file);
    res.writeHead(found ? 200 : 404, { 'content-type': extname(file) === '.html' || !found ? 'text/html' : 'application/octet-stream' });
    res.end(readFileSync(found ? file : join(site, '404.html')));
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
test.afterAll(() => server.close());

test.beforeEach(async ({ context }) => {
  await context.route(/^https?:/, r => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));
});

async function open(page: Page, path: string) {
  await page.goto(origin + BASE + path);
  const frame = page.frameLocator('#zm-demo');
  await expect(frame.locator('#zm-map canvas')).toBeVisible({ timeout: 45_000 });
  const demo = page.frames().find(f => f.url().includes('demo.html'))!;
  await demo.waitForFunction(() => (window as any).zullumap?.isReady === true, null, { timeout: 45_000 });
  return { frame, demo };
}

test.describe('desktop template page', () => {
  test('a remix link loads the live demo with its choices, and the remix command carries the same link', async ({ page }) => {
    const { frame } = await open(page, '/t/risograph-choropleth@1.0.0/#r=0;mn;c5');
    await expect(frame.locator('#zm-overlay [data-zm-region=legend] li:not(.zm-key)')).toHaveCount(5);
    await expect(page.locator('#zm-command')).toHaveText(`npx zullumap remix ${LINK}#r=0;mn;c5`);
    await expect(page.locator('#zm-prompt')).toContainText(`${LINK}#r=0;mn;c5`);
    await expect(page.locator('#zm-message')).toBeHidden();
  });

  test('without a link it shows the template default look', async ({ page }) => {
    const { frame } = await open(page, '/t/risograph-choropleth/');
    await expect(frame.locator('#zm-overlay [data-zm-region=legend] li:not(.zm-key)')).toHaveCount(4);
    await expect(page.locator('#zm-command')).toHaveText(`npx zullumap remix ${LINK}#r=0`);
  });

  test('a damaged link shows the default look and says so', async ({ page }) => {
    const { frame } = await open(page, '/t/risograph-choropleth@1.0.0/#r=%25%25');
    await expect(page.locator('#zm-message')).toHaveText("This remix link is damaged — here's the template's default look");
    await expect(frame.locator('#zm-overlay [data-zm-region=legend] li:not(.zm-key)')).toHaveCount(4);
  });

  test('a version that is gone goes to the newest, keeping the link choices', async ({ page }) => {
    const { frame } = await open(page, '/t/risograph-choropleth@9.9.9/#r=0;c5');
    expect(page.url()).toBe(`${origin}${BASE}/t/risograph-choropleth/?missing=9.9.9#r=0;c5`);
    await expect(page.locator('#zm-message')).toHaveText('This version is gone — showing the newest');
    await expect(frame.locator('#zm-overlay [data-zm-region=legend] li:not(.zm-key)')).toHaveCount(5);
    await expect(page.locator('#zm-command')).toHaveText(`npx zullumap remix ${LINK}#r=0;c5`);
  });

  test('the demo has no chip or remix button of its own, and waits for a click before it moves', async ({ page }) => {
    const { frame, demo } = await open(page, '/t/risograph-choropleth/');
    await expect(frame.locator('#zm-chrome').getByRole('link', { name: /made with zullumap/ })).toHaveCount(0);
    await expect(frame.locator('#zm-chrome').getByRole('button', { name: 'Remix this map' })).toHaveCount(0);
    await expect(frame.getByRole('button', { name: 'Click to explore' })).toBeVisible();
    expect(await demo.evaluate(() => (window as any).zullumap.map.scrollZoom.isEnabled())).toBe(false);
    await frame.getByRole('button', { name: 'Click to explore' }).click();
    expect(await demo.evaluate(() => (window as any).zullumap.interactive)).toBe(true);
    await page.mouse.move(640, 20); // over the page header, outside the demo
    await page.mouse.wheel(0, 600); // scrolling the page hands gestures back to the page
    await expect.poll(() => demo.evaluate(() => (window as any).zullumap.interactive)).toBe(false);
  });

  test('"Remix this map" goes to the remix steps without losing the link choices', async ({ page }) => {
    await open(page, '/t/risograph-choropleth@1.0.0/#r=0;mn;c5');
    await page.getByRole('link', { name: 'Remix this map' }).click();
    await expect(page.getByRole('heading', { name: 'Remix this map' })).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Remix this map' })).toBeInViewport();
    expect(new URL(page.url()).hash).toBe('#r=0;mn;c5');
    await expect(page.locator('#zm-message')).toBeHidden();
  });

  test('copy buttons say "Copied"', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    await open(page, '/t/risograph-choropleth@1.0.0/#r=0;c3');
    await page.locator('button[data-copy=zm-command]').click();
    await expect(page.locator('button[data-copy=zm-command]')).toHaveText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`npx zullumap remix ${LINK}#r=0;c3`);
  });

  test('lists what the data needs, what the agent may adjust, and the empty community list', async ({ page }) => {
    await open(page, '/t/risograph-choropleth/');
    await expect(page.getByRole('heading', { name: 'What your data needs' })).toBeVisible();
    await expect(page.getByText('A number column for color (required)')).toBeVisible();
    await expect(page.getByText('No remixes yet — be the first')).toBeVisible();
  });
});

test.describe('phone template page', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('"Remix this map" opens the share sheet with the remix link (design re-review D6)', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__shared = null;
      (navigator as any).share = (d: unknown) => { (window as any).__shared = d; return Promise.resolve(); };
    });
    const { frame } = await open(page, '/t/risograph-choropleth@1.0.0/#r=0;mn;c5');
    await expect(frame.getByRole('button', { name: 'Tap to explore' })).toBeVisible();
    await page.getByRole('link', { name: 'Remix this map' }).tap();
    expect(await page.evaluate(() => (window as any).__shared?.url)).toBe(`${LINK}#r=0;mn;c5`);
  });

  test('the first-screen button sits above the demo legend peek instead of covering it', async ({ page }) => {
    const { frame } = await open(page, '/t/risograph-choropleth/');
    const button = (await page.getByRole('link', { name: 'Remix this map' }).boundingBox())!;
    const peekRow = (await frame.locator('#zm-chrome [data-zm-region=legend] li').first().boundingBox())!;
    expect(button.y + button.height + 4).toBeLessThan(peekRow.y); // + the 4 px pink plate
    const hint = (await frame.getByRole('button', { name: 'Tap to explore' }).boundingBox())!;
    expect(hint.y + hint.height).toBeLessThan(button.y);
  });

  test('the remix steps are collapsed under "Remix now" with a short note (design D4)', async ({ page }) => {
    await open(page, '/t/risograph-choropleth/');
    await expect(page.getByText('Love this look? Remix it on your laptop')).toBeVisible();
    await expect(page.locator('#zm-command')).toBeHidden();
    await page.getByText('Remix now').tap();
    await expect(page.locator('#zm-command')).toBeVisible();
  });
});

test('home page lists the templates', async ({ page }) => {
  await page.goto(`${origin}${BASE}/`);
  await expect(page.getByRole('heading', { name: 'Maps can be this beautiful' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Risograph choropleth' })).toHaveAttribute('href', `${BASE}/t/risograph-choropleth/`);
  await expect(page.getByText('More templates are coming — publish your own')).toBeVisible();
});
