import { expect, test } from '@playwright/test';
import { offline, openMap, writePage } from './pages';
import { overlay } from '../test/fixture';

test.beforeEach(async ({ context }) => { await offline(context); });

test.describe('desktop map page', () => {
  test('draws the 3D data layer from the inlined payload and fades out the poster', async ({ page }) => {
    const errors = await openMap(page, writePage());
    expect(errors).toEqual([]);
    await expect(page.locator('#zm-poster')).toHaveClass(/zm-done/);
    await page.waitForFunction(() => (window as any).zullumap.motionDone === true);
    const info = await page.evaluate(() => {
      const zm = (window as any).zullumap;
      const layer = zm.deck._deck.layerManager.getLayers().find((l: any) => l.id === 'cells');
      return { features: layer?.props.data.features.length, extruded: layer?.props.extruded };
    });
    expect(info).toEqual({ features: 8, extruded: true });
  });

  test('shows the attribution chip top-right, linking to the template page', async ({ page }) => {
    await openMap(page, writePage());
    const chip = page.locator('#zm-chrome').getByRole('link', { name: 'made with zullumap · remix' });
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute('href', 'https://jjestrada2.github.io/zullumap/t/risograph-choropleth@1.0.0');
    const box = (await chip.boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(1280 - 40);
    expect(box.y).toBeLessThan(40);
  });

  test('a template overlay with aggressive CSS cannot hide or cover the chip (DT6)', async ({ page }) => {
    const hostile = `<style>:host{z-index:2147483647!important;position:fixed!important;inset:0!important;pointer-events:auto!important}
      *{display:block!important;background:red!important;pointer-events:auto!important}
      [data-zm-region]{position:fixed!important;inset:0!important;z-index:2147483647!important}</style>` + overlay;
    await openMap(page, writePage({ overlay: hostile }));
    const chip = page.locator('#zm-chrome').getByRole('link', { name: /made with zullumap/ });
    const box = (await chip.boundingBox())!;
    const topId = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    expect(topId).toBe('zm-chrome');
    await chip.click({ trial: true });
  });

  test('"Remix this map" sits 24px from the bottom-right, 48px tall, and opens the remix panel', async ({ page }) => {
    await openMap(page, writePage());
    const button = page.locator('#zm-chrome').getByRole('button', { name: 'Remix this map' });
    const b = (await button.boundingBox())!;
    expect(Math.round(b.height)).toBe(48);
    expect(Math.round(1280 - (b.x + b.width))).toBe(24 + 4); // 24px gap; the 4px pink plate sits outside the box
    expect(Math.round(800 - (b.y + b.height))).toBe(24 + 4);
    await button.click();
    const panel = page.locator('#zm-chrome').getByRole('dialog', { name: 'Remix this map' });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('npx zullumap remix https://jjestrada2.github.io/zullumap/t/risograph-choropleth@1.0.0#r=0');
    await expect(panel).toContainText('Polygons in GeoJSON (WGS84)');
    await expect(panel.getByRole('link', { name: 'See the template →' })).toHaveAttribute('href', /\/t\/risograph-choropleth@1\.0\.0$/);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(button).toBeFocused();
  });

  test('without a recipe the chip reads "made with zullumap" and there is no remix button', async ({ page }) => {
    await openMap(page, writePage({ recipe: null }));
    await expect(page.locator('#zm-chrome').getByText('made with zullumap', { exact: true })).toBeVisible();
    await expect(page.locator('#zm-chrome').getByRole('button', { name: 'Remix this map' })).toHaveCount(0);
  });

  test('shows the template title and legend from overlay.html, with legend rows as text', async ({ page }) => {
    await openMap(page, writePage({ title: '</script><script>window.pwned=1</script>' }));
    await expect(page.locator('#zm-overlay').getByRole('heading')).toHaveText('</script><script>window.pwned=1</script>');
    expect(await page.evaluate(() => (window as any).pwned)).toBeUndefined();
    await expect(page.locator('#zm-overlay').locator('li')).toHaveCount(4);
  });

  test('has a screen-reader summary of the map', async ({ page }) => {
    await openMap(page, writePage());
    const summary = page.getByRole('region', { name: 'Map summary' });
    await expect(summary).toContainText('Color shows pop in 4 classes: 1–2, 2–4, 4–6, 6–8.');
    await expect(summary).toContainText('Height shows h, from 10 to 80.');
  });

  test('arrow keys pan only once the map itself has focus', async ({ page }) => {
    await openMap(page, writePage({}), );
    const center = () => page.evaluate(() => (window as any).zullumap.map.getCenter().lng);
    await page.evaluate(() => (window as any).zullumap.stopMotion());
    const before = await center();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    expect(await center()).toBeCloseTo(before, 6);
    await page.locator('#zm-map canvas').focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(600);
    expect(await center()).toBeGreaterThan(before);
  });
});

test.describe('opening motion', () => {
  test('an ink-pass template prints one ink at a time, then shows every feature', async ({ page }) => {
    const url = writePage();
    const seen: string[] = [];
    await page.exposeFunction('__zmSaw', (t: string) => { if (!seen.includes(t)) seen.push(t); });
    await page.addInitScript(() => {
      new MutationObserver(() => { const t = document.getElementById('zm-status')?.textContent; if (t) (window as any).__zmSaw(t); })
        .observe(document, { subtree: true, childList: true, characterData: true });
    });
    await openMap(page, url);
    await page.waitForFunction(() => (window as any).zullumap.motionDone === true, null, { timeout: 15_000 });
    expect(seen).toEqual(['Printing the teal layer…', 'Printing the pink layer…', 'Printing the coral layer…', 'Printing the mustard layer…']);
    const n = await page.evaluate(() => (window as any).zullumap.deck._deck.layerManager.getLayers().find((l: any) => l.id === 'cells').props.data.features.length);
    expect(n).toBe(8);
  });

  test('with reduced motion the inks appear at once and the camera never moves', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await offline(context);
    const page = await context.newPage();
    await openMap(page, writePage());
    const cam = () => page.evaluate(() => { const m = (window as any).zullumap.map; return [m.getBearing(), m.getPitch()]; });
    const a = await cam();
    await page.waitForTimeout(1200);
    expect(await cam()).toEqual(a);
    expect(await page.locator('#zm-status').textContent()).toBe('');
    await context.close();
  });

  test('a bar template orbits once and any input stops it', async ({ page }) => {
    const { manifest } = await import('../test/fixture');
    await openMap(page, writePage({ manifest: { ...manifest, loading: 'bar' } }));
    const bearing = () => page.evaluate(() => (window as any).zullumap.map.getBearing());
    const b0 = await bearing();
    await page.waitForTimeout(500);
    expect(await bearing()).not.toBe(b0);
    await page.mouse.move(640, 400);
    await page.mouse.down(); await page.mouse.up();
    const b1 = await bearing();
    await page.waitForTimeout(500);
    expect(await bearing()).toBeCloseTo(b1, 3);
  });
});

test.describe('phone map page (<600px, design D2)', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('keeps only the title on the map and moves the legend into a 72px bottom-sheet peek', async ({ page }) => {
    await openMap(page, writePage());
    await expect(page.locator('#zm-overlay').getByRole('heading')).toBeVisible();
    const sheet = page.locator('#zm-chrome').getByRole('region', { name: 'Map legend and remix' });
    const legend = sheet.locator('[data-zm-region=legend]');
    await expect(legend).toHaveCount(1);
    const visibleTop = await sheet.evaluate(el => el.getBoundingClientRect().top);
    expect(Math.round(812 - visibleTop)).toBe(72);
    const chip = (await page.locator('#zm-chrome').getByRole('link', { name: /made with zullumap/ }).boundingBox())!;
    expect(chip.y + chip.height).toBeLessThan(visibleTop);
  });

  test('the chip never covers the title, even when the template positions the title itself', async ({ page }) => {
    await openMap(page, writePage({ title: 'Population density in Bogotá by block' }));
    const t = (await page.locator('#zm-overlay').getByRole('heading').boundingBox())!;
    const c = (await page.locator('#zm-chrome').getByRole('link', { name: /made with zullumap/ }).boundingBox())!;
    const overlap = t.x < c.x + c.width && c.x < t.x + t.width && t.y < c.y + c.height && c.y < t.y + t.height;
    expect(overlap).toBe(false);
  });

  test('the 72px peek shows one whole legend row', async ({ page }) => {
    await openMap(page, writePage());
    const row = (await page.locator('#zm-chrome').locator('[data-zm-region=legend] li').first().boundingBox())!;
    expect(row.y + row.height).toBeLessThanOrEqual(812);
  });

  test('the grab bar expands the sheet to show the full legend and the remix button', async ({ page }) => {
    await openMap(page, writePage());
    const grab = page.locator('#zm-chrome').getByRole('button', { name: 'Show legend' });
    await grab.click();
    await expect(page.locator('#zm-chrome').getByRole('button', { name: 'Show legend' })).toHaveAttribute('aria-expanded', 'true');
    const remix = page.locator('#zm-chrome').getByRole('button', { name: 'Remix this map' });
    await expect(remix).toBeInViewport();
    const b = (await remix.boundingBox())!;
    expect(Math.round(b.width)).toBe(375 - 32 - 4);
  });
});

test.describe('failure states (design D3)', () => {
  test('no WebGL: the poster stays with "Your device can\'t show the 3D map"', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return /webgl/.test(type) ? null : (orig as any).call(this, type, ...rest);
      } as typeof orig;
    });
    await page.goto(writePage());
    await expect(page.locator('#zm-status')).toHaveText("Your device can't show the 3D map — here's a picture of it.");
    await expect(page.locator('#zm-poster')).not.toHaveClass(/zm-done/);
  });

  test('runtime unreachable (offline or CDN down): "Connect to the internet to explore this map"', async ({ page }) => {
    await page.goto(writePage({}, { src: 'https://cdn.jsdelivr.net/npm/@zullumap/viewer@0.1.0/dist/runtime.js', integrity: 'sha384-x' }));
    await expect(page.locator('#zm-status')).toHaveText('Connect to the internet to explore this map.');
    await expect(page.locator('#zm-poster')).toHaveClass(/zm-failed/);
  });
});

test.describe('dark chrome', () => {
  test('the chip uses the sheet-dark backing when the template declares chrome: dark', async ({ page }) => {
    const { manifest } = await import('../test/fixture');
    await openMap(page, writePage({ manifest: { ...manifest, chrome: 'dark' } }));
    const bg = await page.locator('#zm-chrome').getByRole('link', { name: /made with zullumap/ }).evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgba(28, 34, 51, 0.92)');
  });
});
