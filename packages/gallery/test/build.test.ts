import { describe, expect, test } from 'vitest';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from '../src/build';

const TEMPLATES = fileURLToPath(new URL('../../../templates', import.meta.url));
const assets = { bootstrap: '/*boot*/', runtime: '/*runtime*/', client: '/*client*/', demo: '/*demo*/' };
const opts = (o = {}) => ({ templatesDir: TEMPLATES, outDir: mkdtempSync(join(tmpdir(), 'zm-site-')), base: '/zullumap', host: 'https://jjestrada2.github.io/zullumap', assets, ...o });
const read = (dir: string, f: string) => readFileSync(join(dir, f), 'utf8');

describe('buildSite', () => {
  test('writes a pinned page per template version and a newest page, each with the live demo', () => {
    const o = opts();
    buildSite(o);
    for (const f of ['t/risograph-choropleth@1.0.0/index.html', 't/risograph-choropleth@1.0.0/demo.html', 't/risograph-choropleth/index.html', 'index.html', '404.html']) {
      expect(existsSync(join(o.outDir, f)), f).toBe(true);
    }
    expect(read(o.outDir, 't/risograph-choropleth@1.0.0/index.html')).toMatch(/<iframe[^>]+data-demo="demo\.html"/);
    expect(read(o.outDir, 't/risograph-choropleth/index.html')).toMatch(/data-demo="\.\.\/risograph-choropleth@1\.0\.0\/demo\.html"/);
  });

  test('the template page follows the design order: live map, remix steps, data needs and rules, community maps', () => {
    const o = opts();
    buildSite(o);
    const html = read(o.outDir, 't/risograph-choropleth@1.0.0/index.html');
    const order = ['<iframe', 'Remix this map', 'Ask your agent', 'Or run it yourself', 'What your data needs', 'The agent may adjust', 'Community maps'];
    const at = order.map(s => html.indexOf(s));
    expect(at.every(i => i >= 0), JSON.stringify(at)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  test('lists what the data needs and what the agent may adjust, from the manifest', () => {
    const o = opts();
    buildSite(o);
    const html = read(o.outDir, 't/risograph-choropleth@1.0.0/index.html');
    expect(html).toContain('Polygons in GeoJSON (WGS84)');
    expect(html).toContain('A number column for color (required)');
    expect(html).toContain('Class method: quantile, natural or equal');
    expect(html).toContain('Class count: 2 to 7 (default 4)');
    expect(html).toContain('Height: up to 50% of the map width (default 12%)');
    expect(html).toContain('No remixes yet — be the first');
  });

  test('works without JavaScript: the default remix command is in the page', () => {
    const o = opts();
    buildSite(o);
    expect(read(o.outDir, 't/risograph-choropleth@1.0.0/index.html')).toContain('npx zullumap remix https://jjestrada2.github.io/zullumap/t/risograph-choropleth@1.0.0#r=0');
  });

  test('404.html sends a missing version of a known template to its newest page', () => {
    const o = opts();
    buildSite(o);
    const html = read(o.outDir, '404.html');
    expect(html).toContain('"risograph-choropleth"');
    expect(html).toContain('/zullumap');
  });

  test('a template without preview data is refused with a clear message', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zm-tpl-'));
    cpSync(join(TEMPLATES, 'risograph-choropleth'), join(dir, 'risograph-choropleth'), { recursive: true });
    rmSync(join(dir, 'risograph-choropleth', 'preview'), { recursive: true });
    expect(() => buildSite(opts({ templatesDir: dir }))).toThrow(/risograph-choropleth needs preview\/preview\.json/);
  });

  test('an invalid template stops the build', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zm-tpl-'));
    cpSync(join(TEMPLATES, 'risograph-choropleth'), join(dir, 'risograph-choropleth'), { recursive: true });
    writeFileSync(join(dir, 'risograph-choropleth', 'overlay.html'), '<script>x</script>');
    expect(() => buildSite(opts({ templatesDir: dir }))).toThrow(/<script> tags are not allowed/);
  });
});
