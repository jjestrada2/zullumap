import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));

test('zullumap render writes a page that opens by double-click and draws the map', async ({ page, context }) => {
  const out = join(mkdtempSync(join(tmpdir(), 'zm-cli-')), 'my-map');
  const stdout = execFileSync(process.execPath, [join(root, 'packages/cli/bin/zullumap.js'), 'render', 'risograph-choropleth@1.0.0',
    '--template-dir', join(root, 'templates/risograph-choropleth'), '--data', join(root, 'examples/bogota-grid.geojson'),
    '--map', 'value=density', '--map', 'height=density', '--map', 'label=cell', '--title', 'Density in Bogotá (synthetic)', '--out', out, '--no-open'], { encoding: 'utf8' });
  expect(stdout).toContain('Remix link: https://jjestrada2.github.io/zullumap/t/risograph-choropleth@1.0.0#r=0');

  await context.route(/^https?:/, r => r.abort());
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(join(out, 'index.html')).href);
  await page.waitForFunction(() => (window as any).zullumap?.motionDone === true, null, { timeout: 45_000 });
  expect(errors).toEqual([]);
  await expect(page.locator('#zm-overlay').getByRole('heading')).toHaveText('Density in Bogotá (synthetic)');
  await expect(page.locator('#zm-overlay').locator('li')).toHaveCount(5); // 4 classes + height key
  const n = await page.evaluate(() => (window as any).zullumap.deck._deck.layerManager.getLayers().find((l: any) => l.id === 'prints').props.data.features.length);
  expect(n).toBe(1600);
  await expect(page.getByRole('region', { name: 'Map summary' })).toContainText('Highest values');
});
