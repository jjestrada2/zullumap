import { describe, expect, test } from 'vitest';
import { parseRenderArgs } from '../src/args';

const base = ['risograph-choropleth@1.0.0', '--template-dir', 't', '--data', 'd.geojson', '--map', 'value=pop', '--title', 'Hi', '--out', 'o'];

describe('parseRenderArgs', () => {
  test('reads the template, data, slot mappings, title and output folder', () => {
    expect(parseRenderArgs([...base, '--map', 'height=h'])).toEqual({
      template: { id: 'risograph-choropleth', version: '1.0.0' }, templateDir: 't', data: 'd.geojson',
      mapping: { value: 'pop', height: 'h' }, title: 'Hi', out: 'o', options: undefined, recipe: true, open: true,
    });
  });

  test('accepts a bare template id with --template-dir (the folder decides the version)', () => {
    expect(parseRenderArgs(['risograph-choropleth', ...base.slice(1)]).template).toEqual({ id: 'risograph-choropleth', version: undefined });
  });

  test('handles --no-recipe, --no-open and --options', () => {
    const a = parseRenderArgs([...base, '--no-recipe', '--no-open', '--options', 'c.json']);
    expect([a.recipe, a.open, a.options]).toEqual([false, false, 'c.json']);
  });

  test.each([
    [['--title'], /--title is required/],
    [['--data'], /--data is required/],
    [['--map'], /--map value=<column>/],
    [['--out'], /--out is required/],
  ])('requires %s', (drop, msg) => {
    const i = base.indexOf(drop[0]!);
    expect(() => parseRenderArgs([...base.slice(0, i), ...base.slice(i + 2)])).toThrow(msg);
  });

  test('rejects a malformed --map', () => {
    expect(() => parseRenderArgs([...base, '--map', 'height'])).toThrow(/--map needs slot=column/);
  });

  test('rejects unknown flags', () => {
    expect(() => parseRenderArgs([...base, '--colour', 'red'])).toThrow(/--colour/);
  });

  test('explains that the registry is not published yet when --template-dir is missing', () => {
    const i = base.indexOf('--template-dir');
    expect(() => parseRenderArgs([...base.slice(0, i), ...base.slice(i + 2)])).toThrow(/--template-dir/);
  });
});
