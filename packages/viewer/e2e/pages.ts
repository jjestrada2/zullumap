import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import type { Page, BrowserContext } from '@playwright/test';
import { buildPage, type PageAssets, type PageInput } from '../src/page';
import { compiled, manifest, mapping, overlay, LINK } from '../test/fixture';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const read = (f: string) => readFileSync(join(dist, f), 'utf8');

export const defaultInput: PageInput = { title: 'Density in Bogotá', manifest, compiled, mapping, overlay, basemap: null, recipe: { link: LINK } };

/** Write a map page to a temp folder and return its file:// URL (pages open by double-click, eng review D5). */
export function writePage(input: Partial<PageInput> = {}, runtime?: PageAssets['runtime']): string {
  const dir = mkdtempSync(join(tmpdir(), 'zm-page-'));
  mkdirSync(dir, { recursive: true });
  const html = buildPage({ ...defaultInput, ...input }, { bootstrap: read('bootstrap.js'), runtime: runtime ?? { inline: read('runtime.js') } });
  const file = join(dir, 'index.html');
  writeFileSync(file, html);
  return pathToFileURL(file).href;
}

/** Keep tests offline and deterministic: only file:// loads. */
export async function offline(context: BrowserContext) {
  await context.route(/^https?:/, route => route.abort());
}

export async function openMap(page: Page, url: string) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => (window as any).zullumap?.isReady === true, null, { timeout: 45_000 });
  return errors;
}
