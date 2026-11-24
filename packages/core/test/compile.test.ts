import { describe, expect, test } from 'vitest';
import { compile } from '../src/compile';
import { accessorHelpers } from '../src/helpers';
import { extentMeters } from '../src/extent';

const manifest = {
  id: 'risograph-choropleth', version: '1.0.0', author: 'juan', license: 'CC-BY-4.0',
  geometry: 'polygon',
  slots: { value: { type: 'number', required: true }, height: { type: 'number', required: false } },
  title: { maxLength: 48 },
  rules: {
    classMethods: ['quantile', 'natural'],
    classCount: { min: 2, max: 7, default: 4 },
    heightScale: { min: 0, max: 0.5, default: 0.12 },
    zoom: { min: 3, max: 16 }, pitch: { min: 0, max: 70, default: 50 },
  },
  ramp: ['#2499A6', '#F49AA8', '#E95E5A', '#E9B24F'],
  loading: 'ink-pass', chrome: 'light',
};
const deck = { layers: [{ '@@type': 'GeoJsonLayer', id: 'cells', extruded: true, getFillColor: '{{slot:value}}', getElevation: '{{slot:height}}', opacity: 0.9 }] };
const sq = (x: number) => [[[x, 4], [x + 0.01, 4], [x + 0.01, 4.01], [x, 4.01], [x, 4]]];
const data = {
  type: 'FeatureCollection',
  features: [1, 2, 3, 4, 5, 6, 7, 8].map((v, i) => ({ type: 'Feature', properties: { pop: v, h: v * 10 }, geometry: { type: 'Polygon', coordinates: sq(-74 + i * 0.01) } })),
};
const base = { manifest, deck, data, mapping: { value: 'pop', height: 'h' } };

describe('compile', () => {
  test('replaces the value slot with a zmClassColor helper reference carrying breaks and colors', () => {
    const r = compile(base);
    const fill = (r.deck.layers[0] as Record<string, any>).getFillColor;
    expect(fill['@@function']).toBe('zmClassColor');
    expect(fill.slot).toBe('value');
    expect(fill.breaks).toEqual([2, 4, 6]);
    expect(fill.colors).toHaveLength(4);
  });

  test('replaces the height slot with a zmHeight helper whose scale is the default share of the data width', () => {
    const elev = (compile(base).deck.layers[0] as Record<string, any>).getElevation;
    const width = extentMeters(data);
    expect(elev).toMatchObject({ '@@function': 'zmHeight', slot: 'height', max: 80 });
    expect(elev.scale).toBeCloseTo(0.12 * width, 6);
  });

  test('the tallest feature is the same share of the map whether the data covers a city or a continent', () => {
    const wide = structuredClone(data);
    for (const f of wide.features) for (const p of f.geometry.coordinates[0]!) p[0] = -74 + (p[0]! + 74) * 100;
    const scale = (d: unknown) => (compile({ ...base, data: d }).deck.layers[0] as Record<string, any>).getElevation.scale;
    expect(scale(wide) / scale(data)).toBeCloseTo(100, 0);
  });

  test('keeps non-slot props unchanged', () => {
    expect((compile(base).deck.layers[0] as Record<string, any>).opacity).toBe(0.9);
  });

  test('an unmapped optional height leaves the map flat, not at deck.gl\'s 1000 m default', () => {
    const r = compile({ ...base, mapping: { value: 'pop' } });
    expect((r.deck.layers[0] as Record<string, any>).getElevation).toBe(0);
  });

  test('drops other props whose optional slot is not mapped', () => {
    const deck2 = { layers: [{ '@@type': 'ScatterplotLayer', id: 'p', getFillColor: '{{slot:value}}', getRadius: '{{slot:height}}' }] };
    const r = compile({ ...base, deck: deck2, mapping: { value: 'pop' } });
    expect((r.deck.layers[0] as Record<string, any>).getRadius).toBeUndefined();
  });

  test('annotates each feature with its slot values for the helpers', () => {
    const r = compile(base);
    expect((r.features[0]!.properties as any).__zm).toEqual({ value: 1, height: 10 });
  });

  test('returns the legend and the resolved choices', () => {
    const r = compile(base);
    expect(r.legend).toMatchObject({ classCount: 4, breaks: [2, 4, 6] });
    expect(r.choices).toEqual({ method: 'quantile', classCount: 4, heightScale: 0.12, pitch: 50 });
  });

  test('applies overrides that respect the template rules', () => {
    const r = compile({ ...base, options: { method: 'natural', classCount: 3 } });
    expect(r.choices).toMatchObject({ method: 'natural', classCount: 3 });
  });

  test('rejects an override outside the rules, naming the rule', () => {
    expect(() => compile({ ...base, options: { classCount: 9 } })).toThrow(/classCount.*2.*7/);
    expect(() => compile({ ...base, options: { method: 'equal' } })).toThrow(/method.*quantile, natural/);
  });

  test('rejects a template that fails validation', () => {
    const bad = { ...base, deck: { layers: [{ '@@type': 'GeoJsonLayer', getFillColor: '@@=properties.pop' }] } };
    expect(() => compile(bad)).toThrow(/@@/);
  });

  test('is deterministic for the same inputs', () => {
    expect(JSON.stringify(compile(base))).toBe(JSON.stringify(compile(structuredClone(base))));
  });
});

describe('accessorHelpers', () => {
  const f = (value: number | null, height: number | null = null) => ({ properties: { __zm: { value, height } } });

  test('zmClassColor colors a feature by its class', () => {
    const color = accessorHelpers.zmClassColor({ slot: 'value', breaks: [10, 20], colors: [[1, 1, 1], [2, 2, 2], [3, 3, 3]] });
    expect(color(f(5))).toEqual([1, 1, 1]);
    expect(color(f(15))).toEqual([2, 2, 2]);
    expect(color(f(25))).toEqual([3, 3, 3]);
  });

  test('zmClassColor uses the no-data color for missing values', () => {
    const color = accessorHelpers.zmClassColor({ slot: 'value', breaks: [10], colors: [[1, 1, 1], [2, 2, 2]], noData: [9, 9, 9] });
    expect(color(f(null))).toEqual([9, 9, 9]);
  });

  test('zmHeight scales values to the template scale and draws no data flat', () => {
    const h = accessorHelpers.zmHeight({ slot: 'height', max: 100, scale: 2000 });
    expect(h(f(0, 50))).toBe(1000);
    expect(h(f(0, null))).toBe(0);
  });
});

describe('compile legend for the overlay (design D11)', () => {
  test('includes the data range so every class gets a labelled range', () => {
    expect(compile(base).legend).toMatchObject({ min: 1, max: 8, hasNoData: false });
  });

  test('flags missing values so the legend shows a no-data swatch', () => {
    const withGap = structuredClone(data);
    (withGap.features[0]!.properties as Record<string, unknown>).pop = null;
    expect(compile({ ...base, data: withGap }).legend?.hasNoData).toBe(true);
  });

  test('adds a height key with the low and high values when a height slot is mapped', () => {
    expect(compile(base).legend?.height).toEqual({ slot: 'height', low: 10, high: 80 });
    expect(compile({ ...base, mapping: { value: 'pop' } }).legend?.height).toBeUndefined();
  });
});

describe('defaultChoices', () => {
  test('gives the choices a map gets with no overrides, used to keep remix links short', async () => {
    const { defaultChoices } = await import('../src/compile');
    expect(defaultChoices(manifest)).toEqual({ method: 'quantile', classCount: 4, heightScale: 0.12, pitch: 50 });
  });
});

describe('extentMeters', () => {
  const box = (w: number, s: number, e: number, n: number) => ({ type: 'FeatureCollection', features: [
    { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } }] });

  test('is the wider side of the data bounds, in meters', () => {
    expect(extentMeters(box(0, 0, 1, 0.5)) / 1000).toBeCloseTo(111.3, 0); // 1° of longitude at the equator
  });

  test('a world dataset spans about 40,000 km', () => {
    expect(extentMeters(box(-180, -90, 180, 84)) / 1e6).toBeGreaterThan(35);
  });
});
