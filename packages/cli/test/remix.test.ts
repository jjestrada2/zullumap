import { describe, expect, test } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '../src/render';
import { remix } from '../src/remix';
import { parseRemixArgs } from '../src/args';
import { folderForTitle } from '../src/remix';

const TEMPLATE = fileURLToPath(new URL('../../../templates/risograph-choropleth', import.meta.url));
const assets = { bootstrap: '', runtime: { inline: '' } };
const tmp = () => mkdtempSync(join(tmpdir(), 'zm-remix-'));
const sq = (x: number, y: number) => [[[x, y], [x + 0.01, y], [x + 0.01, y + 0.01], [x, y + 0.01], [x, y]]];
function geojson(props: (i: number) => Record<string, unknown>, y = 4) {
  const f = join(tmp(), 'd.geojson');
  writeFileSync(f, JSON.stringify({ type: 'FeatureCollection', features: Array.from({ length: 12 }, (_, i) => ({ type: 'Feature', properties: props(i), geometry: { type: 'Polygon', coordinates: sq(-74 + i * 0.01, y) } })) }));
  return f;
}
/** An original map made with non-default choices. */
function original() {
  const out = join(tmp(), 'orig');
  const opts = join(tmp(), 'o.json');
  writeFileSync(opts, JSON.stringify({ method: 'natural', classCount: 5, heightScale: 0.2 }));
  render({ template: { id: 'risograph-choropleth', version: '1.0.0' }, templateDir: TEMPLATE, data: geojson(i => ({ pop: i * 3, name: `B${i}` })),
    mapping: { value: 'pop', height: 'pop', label: 'name' }, title: 'Density in Bogotá', out, recipe: true, options: opts }, assets);
  return out;
}
const payload = (out: string) => JSON.parse(/id="zm-page">(.*?)<\/script>/s.exec(readFileSync(join(out, 'index.html'), 'utf8'))![1]!);

describe('remix', () => {
  test('re-renders with new data, keeping the template and every stored choice; breaks are re-fitted', async () => {
    const out = join(tmp(), 'mine');
    const r = await remix({ source: original(), data: geojson(i => ({ pop: 100 + i * i, name: `M${i}` }), 40), title: 'Density in Madrid', mapping: {}, templateDir: TEMPLATE, out, recipe: true }, assets);
    const p = payload(out);
    expect(p.title).toBe('Density in Madrid');
    expect(p.choices).toEqual({ method: 'natural', classCount: 5, heightScale: 0.2, pitch: 50 });
    expect(p.legend.min).toBe(100);
    expect(r.link).toBe('https://jjestrada2.github.io/zullumap/t/risograph-choropleth@1.0.0#r=0;mn;c5;h0.2');
  });

  test('reuses the original columns when the new data has the same names, and says so', async () => {
    const r = await remix({ source: original(), data: geojson(i => ({ pop: i, name: 'x' })), title: 'T', mapping: {}, templateDir: TEMPLATE, out: join(tmp(), 'm'), recipe: true }, assets);
    expect(r.notes).toContain('Using column "pop" for value, as the original map did');
    expect(r.notes).toContain('Using column "name" for label, as the original map did');
  });

  test('new column names: --map maps them, optional slots without a match are left out', async () => {
    const out = join(tmp(), 'm');
    await remix({ source: original(), data: geojson(i => ({ density: i })), title: 'T', mapping: { value: 'density' }, templateDir: TEMPLATE, out, recipe: true }, assets);
    expect(payload(out).mapping).toEqual({ value: 'density' });
  });

  test('a missing data file is reported before anything about columns', async () => {
    await expect(remix({ source: original(), data: join(tmp(), 'nope.geojson'), title: 'T', mapping: {}, templateDir: TEMPLATE, out: join(tmp(), 'm'), recipe: true }, assets))
      .rejects.toThrow(/Can't find the data file .*nope\.geojson/);
  });

  test('--title is required, and the error shows the original title for reference', async () => {
    await expect(remix({ source: original(), data: geojson(i => ({ pop: i })), title: undefined, mapping: {}, templateDir: TEMPLATE, out: join(tmp(), 'm'), recipe: true }, assets))
      .rejects.toThrow('--title is required: give your map its own title (the original was "Density in Bogotá")');
  });

  test('from a remix link, the choices come from the link and --map is required', async () => {
    const link = 'https://jjestrada2.github.io/zullumap/t/risograph-choropleth@1.0.0#r=0;c3';
    const base = { source: link, data: geojson(i => ({ density: i })), title: 'T', templateDir: TEMPLATE, out: join(tmp(), 'm'), recipe: true };
    await expect(remix({ ...base, mapping: {} }, assets)).rejects.toThrow(/--map value=<column>/);
    await remix({ ...base, mapping: { value: 'density' } }, assets);
    expect(payload(base.out).choices.classCount).toBe(3);
  });

  test('a template folder with a different version than the recipe is refused, pointing to --template', async () => {
    const link = 'https://jjestrada2.github.io/zullumap/t/risograph-choropleth@2.0.0#r=0';
    await expect(remix({ source: link, data: geojson(i => ({ d: i })), title: 'T', mapping: { value: 'd' }, templateDir: TEMPLATE, out: join(tmp(), 'm'), recipe: true }, assets))
      .rejects.toThrow(/made with risograph-choropleth@2\.0\.0.*version 1\.0\.0.*--template risograph-choropleth@1\.0\.0/);
  });

  test('--template switches the version on purpose', async () => {
    const link = 'https://jjestrada2.github.io/zullumap/t/risograph-choropleth@2.0.0#r=0';
    const r = await remix({ source: link, template: { id: 'risograph-choropleth', version: '1.0.0' }, data: geojson(i => ({ d: i })), title: 'T', mapping: { value: 'd' }, templateDir: TEMPLATE, out: join(tmp(), 'm'), recipe: true }, assets);
    expect(r.notes.join(' ')).toMatch(/Using risograph-choropleth@1\.0\.0 instead of 2\.0\.0/);
  });
});

describe('parseRemixArgs', () => {
  test('reads the source, data, title, --map, --template and --out', () => {
    expect(parseRemixArgs(['my-map', '--template-dir', 't', '--data', 'd.geojson', '--title', 'Mine', '--map', 'value=x', '--template', 'riso@1.0.0', '--out', 'o', '--no-open']))
      .toEqual({ source: 'my-map', templateDir: 't', data: 'd.geojson', title: 'Mine', mapping: { value: 'x' }, template: { id: 'riso', version: '1.0.0' }, out: 'o', recipe: true, open: false });
  });

  test('--title is checked after the recipe is read (so the error can show the original title)', () => {
    expect(parseRemixArgs(['m', '--template-dir', 't', '--data', 'd', '--out', 'o']).title).toBeUndefined();
  });

  test.each([
    [['--template-dir', 't', '--data', 'd', '--out', 'o'], /Name what to remix/],
    [['m', '--data', 'd', '--out', 'o'], /--template-dir/],
    [['m', '--template-dir', 't', '--out', 'o'], /--data is required/],
    [['m', '--template-dir', 't', '--data', 'd', '--out', 'o', '--template', 'riso'], /--template needs a version/],
  ])('rejects %j', (argv, msg) => {
    expect(() => parseRemixArgs(argv)).toThrow(msg);
  });
});

describe('default output folder for remix', () => {
  test('is named after the title, so the panel command needs no --out', () => {
    expect(parseRemixArgs(['m', '--template-dir', 't', '--data', 'd']).out).toBeUndefined();
    expect(folderForTitle('Density in Medellín')).toBe('density-in-medellin');
    expect(folderForTitle('  Población / km² (2024)! ')).toBe('poblacion-km2-2024');
    expect(folderForTitle('!!!')).toBe('my-map');
    expect(folderForTitle('x'.repeat(80))).toHaveLength(40);
  });
});
