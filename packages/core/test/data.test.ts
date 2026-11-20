import { describe, expect, test } from 'vitest';
import { prepareData } from '../src/data';

const square = (x: number, y: number) => ({
  type: 'Polygon' as const,
  coordinates: [[[x, y], [x + 0.01, y], [x + 0.01, y + 0.01], [x, y + 0.01], [x, y]]],
});
const poly = (props: Record<string, unknown>, x = -74, y = 4.6) => ({ type: 'Feature' as const, properties: props, geometry: square(x, y) });
const point = (props: Record<string, unknown>) => ({ type: 'Feature' as const, properties: props, geometry: { type: 'Point' as const, coordinates: [-74, 4.6] } });
const fc = (features: unknown[], extra: Record<string, unknown> = {}) => ({ type: 'FeatureCollection', features, ...extra });

const spec = { geometry: 'polygon' as const, numeric: [{ slot: 'value', column: 'pop' }] };

describe('prepareData', () => {
  test('returns numeric values for a valid polygon dataset', () => {
    const r = prepareData(fc([poly({ pop: 10 }), poly({ pop: 20 })]), spec);
    expect(r.features).toHaveLength(2);
    expect(r.values.value).toEqual([10, 20]);
    expect(r.warnings).toEqual([]);
  });

  test('rejects an empty dataset', () => {
    expect(() => prepareData(fc([]), spec)).toThrow(/empty/i);
  });

  test('rejects data whose geometry does not match the slot, naming the slot and type', () => {
    expect(() => prepareData(fc([point({ pop: 1 })]), spec)).toThrow(/geometry.*polygon/i);
  });

  test('keeps matching features from mixed geometries and warns with the skipped count', () => {
    const r = prepareData(fc([poly({ pop: 1 }), point({ pop: 2 }), poly({ pop: 3 })]), spec);
    expect(r.features).toHaveLength(2);
    expect(r.warnings.join(' ')).toMatch(/skipped 1/i);
  });

  test('rejects a missing value column and lists the available columns', () => {
    expect(() => prepareData(fc([poly({ name: 'a', density: 2 })]), spec)).toThrow(/pop.*name, density/);
  });

  test('coerces numeric strings and treats other values as no data with a warning', () => {
    const r = prepareData(fc([poly({ pop: '12' }), poly({ pop: 'n/a' }), poly({ pop: 3 })]), spec);
    expect(r.values.value).toEqual([12, null, 3]);
    expect(r.warnings.join(' ')).toMatch(/1 .*no data/i);
  });

  test('rejects a numeric slot when no values are numeric', () => {
    expect(() => prepareData(fc([poly({ pop: 'x' }), poly({ pop: null })]), spec)).toThrow(/no numeric values/i);
  });

  test('rejects negative values in a height slot unless the template allows diverging heights', () => {
    const heightSpec = { geometry: 'polygon' as const, numeric: [{ slot: 'height', column: 'h', nonNegative: true }] };
    expect(() => prepareData(fc([poly({ h: -1 }), poly({ h: 2 })]), heightSpec)).toThrow(/negative/i);
    const diverging = { geometry: 'polygon' as const, numeric: [{ slot: 'height', column: 'h' }] };
    expect(prepareData(fc([poly({ h: -1 }), poly({ h: 2 })]), diverging).values.height).toEqual([-1, 2]);
  });

  test('rejects coordinates outside WGS84 ranges and asks to reproject', () => {
    expect(() => prepareData(fc([poly({ pop: 1 }, 500000, 4600000)]), spec)).toThrow(/reproject/i);
  });

  test('rejects a crs member that is not WGS84', () => {
    const projected = fc([poly({ pop: 1 })], { crs: { type: 'name', properties: { name: 'EPSG:3857' } } });
    expect(() => prepareData(projected, spec)).toThrow(/reproject/i);
  });

  test('accepts an explicit WGS84 crs member', () => {
    const wgs = fc([poly({ pop: 1 })], { crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } } });
    expect(prepareData(wgs, spec).features).toHaveLength(1);
  });
});
