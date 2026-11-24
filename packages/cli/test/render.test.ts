import { describe, expect, test } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, type RenderOptions } from '../src/render';

const TEMPLATE = fileURLToPath(new URL('../../../templates/risograph-choropleth', import.meta.url));
const assets = { bootstrap: '/*boot*/', runtime: { inline: '/*runtime*/' } };
const tmp = () => mkdtempSync(join(tmpdir(), 'zm-render-'));

const sq = (x: number) => [[[x, 4], [x + 0.01, 4], [x + 0.01, 4.01], [x, 4.01], [x, 4]]];
function dataFile(props: (i: number) => Record<string, unknown> = i => ({ pop: i + 1, name: `B${i}` }), ext = '.geojson') {
  const dir = tmp();
  const file = join(dir, `data${ext}`);
  writeFileSync(file, JSON.stringify({ type: 'FeatureCollection', features: Array.from({ length: 8 }, (_, i) => ({ type: 'Feature', properties: props(i), geometry: { type: 'Polygon', coordinates: sq(-74 + i * 0.01) } })) }));
  return file;
}

const opts = (o: Partial<RenderOptions> = {}): RenderOptions => ({
  template: { id: 'risograph-choropleth', version: '1.0.0' }, templateDir: TEMPLATE, data: dataFile(),
  mapping: { value: 'pop' }, title: 'Density in Bogotá', out: join(tmp(), 'my-map'), recipe: true, ...o,
});
const payloadOf = (out: string) => JSON.parse(/<script type="application\/json" id="zm-page">(.*?)<\/script>/s.exec(readFileSync(join(out, 'index.html'), 'utf8'))![1]!);

describe('render', () => {
  test('writes index.html with the map inlined, and recipe.json', () => {
    const o = opts();
    const r = render(o, assets);
    expect(r.outDir).toBe(o.out);
    expect(payloadOf(o.out).features).toHaveLength(8);
    expect(payloadOf(o.out).recipe.link).toBe(r.link);
  });

  test('prints a remix link of at most 100 characters that stores only non-default choices', () => {
    expect(render(opts(), assets).link).toBe('https://jjestrada2.github.io/zullumap/t/risograph-choropleth@1.0.0#r=0');
  });

  test('recipe.json has the template, choices, mapping and title, never file paths', () => {
    const o = opts();
    render(o, assets);
    const recipe = JSON.parse(readFileSync(join(o.out, 'recipe.json'), 'utf8'));
    expect(recipe).toMatchObject({
      template: { id: 'risograph-choropleth', version: '1.0.0', author: 'Juan Estrada', license: 'CC-BY-4.0' },
      coreMajor: 0, choices: { method: 'quantile', classCount: 4, heightScale: 0.12, pitch: 50 },
      mapping: { value: 'pop' }, title: 'Density in Bogotá',
    });
    expect(JSON.stringify(recipe)).not.toContain(tmpdir());
  });

  test('--no-recipe leaves out recipe.json and the remix link', () => {
    const o = opts({ recipe: false });
    const r = render(o, assets);
    expect(existsSync(join(o.out, 'recipe.json'))).toBe(false);
    expect(r.link).toBeNull();
    expect(payloadOf(o.out).recipe).toBeNull();
  });

  test('applies --options choices and rejects ones outside the template rules', () => {
    const dir = tmp();
    writeFileSync(join(dir, 'ok.json'), JSON.stringify({ method: 'natural', classCount: 3 }));
    writeFileSync(join(dir, 'bad.json'), JSON.stringify({ classCount: 12 }));
    expect(render(opts({ options: join(dir, 'ok.json') }), assets).link).toMatch(/#r=0;mn;c3$/);
    expect(() => render(opts({ options: join(dir, 'bad.json') }), assets)).toThrow(/classCount 12 is outside/);
  });

  test('a title over the template limit is an error stating the limit and the length', () => {
    expect(() => render(opts({ title: 'x'.repeat(60) }), assets)).toThrow('The title is 60 characters; this template allows at most 48');
  });

  test('mapping an unknown slot is an error listing the template slots', () => {
    expect(() => render(opts({ mapping: { value: 'pop', colour: 'x' } }), assets)).toThrow(/no slot "colour".*value, height, label/);
  });

  test('a label column missing from the data is an error listing the columns', () => {
    expect(() => render(opts({ mapping: { value: 'pop', label: 'barrio' } }), assets)).toThrow(/column "barrio".*pop, name/);
  });

  test('a template folder with a different id or version is refused', () => {
    expect(() => render(opts({ template: { id: 'risograph-choropleth', version: '2.0.0' } }), assets)).toThrow(/is version 1\.0\.0, not 2\.0\.0/);
  });

  test('shapefiles and other formats get the ogr2ogr hint (design re-review D7)', () => {
    expect(() => render(opts({ data: dataFile(undefined, '.shp') }), assets))
      .toThrow('zullumap reads GeoJSON or CSV. Convert with: ogr2ogr -f GeoJSON out.geojson in.shp');
  });

  test('CSV is recognized but not supported by polygon templates', () => {
    const f = join(tmp(), 'points.csv');
    writeFileSync(f, 'lon,lat,pop\n-74,4,1\n');
    expect(() => render(opts({ data: f }), assets)).toThrow(/polygon/);
  });

  test('a template whose overlay has a script is refused (trust model)', () => {
    const dir = join(tmp(), 'bad-template');
    cpSync(TEMPLATE, dir, { recursive: true });
    writeFileSync(join(dir, 'overlay.html'), readFileSync(join(TEMPLATE, 'overlay.html'), 'utf8') + '<script>alert(1)</script>');
    expect(() => render(opts({ templateDir: dir }), assets)).toThrow(/<script> tags are not allowed/);
  });

  test('returns data warnings, e.g. values that are not numbers', () => {
    const r = render(opts({ data: dataFile(i => ({ pop: i === 0 ? 'n/a' : i, name: 'x' })) }), assets);
    expect(r.warnings.join(' ')).toMatch(/no data/i);
  });

  test('only writes index.html and recipe.json, leaving other files in the folder alone', () => {
    const o = opts();
    mkdirSync(o.out, { recursive: true });
    writeFileSync(join(o.out, 'notes.txt'), 'mine');
    render(o, assets);
    expect(readFileSync(join(o.out, 'notes.txt'), 'utf8')).toBe('mine');
  });
});
