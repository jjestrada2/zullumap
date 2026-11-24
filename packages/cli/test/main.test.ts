import { describe, expect, test } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/main';

const TEMPLATE = fileURLToPath(new URL('../../../templates/risograph-choropleth', import.meta.url));
const assets = () => ({ bootstrap: '', runtime: { inline: '' } });

async function run(argv: string[]) {
  const out: string[] = [], err: string[] = [], opened: string[] = [];
  const code = await main(argv, { out: s => out.push(s), err: s => err.push(s), open: f => opened.push(f), loadAssets: assets, isTTY: true, progress: () => {} });
  return { code, out, err, opened };
}

function data() {
  const dir = mkdtempSync(join(tmpdir(), 'zm-main-'));
  const f = join(dir, 'd.geojson');
  writeFileSync(f, JSON.stringify({ type: 'FeatureCollection', features: [1, 2, 3].map(v => ({ type: 'Feature', properties: { v }, geometry: { type: 'Polygon', coordinates: [[[v, 0], [v + 1, 0], [v + 1, 1], [v, 0]]] } })) }));
  return { dir, f };
}

describe('zullumap CLI', () => {
  test('render prints where the page is, the next step and the remix link, then opens it (design re-review D7)', async () => {
    const { dir, f } = data();
    const r = await run(['render', 'risograph-choropleth@1.0.0', '--template-dir', TEMPLATE, '--data', f, '--map', 'value=v', '--title', 'T', '--out', join(dir, 'm')]);
    expect(r.code).toBe(0);
    expect(r.out).toEqual([
      `Saved your map: ${join(dir, 'm', 'index.html')}`,
      `Make a trailer: zullumap trailer ${join(dir, 'm')}`,
      'Remix link: https://jjestrada2.github.io/zullumap/t/risograph-choropleth@1.0.0#r=0',
    ]);
    expect(r.opened).toEqual([join(dir, 'm', 'index.html')]);
  });

  test('--no-open skips opening the browser', async () => {
    const { dir, f } = data();
    expect((await run(['render', 'risograph-choropleth', '--template-dir', TEMPLATE, '--data', f, '--map', 'value=v', '--title', 'T', '--out', join(dir, 'm'), '--no-open'])).opened).toEqual([]);
  });

  test('prints errors as "zullumap: <message>" and exits 1', async () => {
    const r = await run(['render', 'risograph-choropleth', '--template-dir', TEMPLATE, '--data', 'nope.geojson', '--map', 'value=v', '--title', 'T', '--out', 'x']);
    expect(r.code).toBe(1);
    expect(r.err[0]).toMatch(/^zullumap: .*nope\.geojson/);
  });

  test('shows usage for --help and for unknown commands', async () => {
    expect((await run(['--help'])).out.join('\n')).toMatch(/zullumap render <template>/);
    const r = await run(['paint']);
    expect(r.code).toBe(1);
    expect(r.err.join('\n')).toMatch(/Unknown command "paint"/);
  });
});
