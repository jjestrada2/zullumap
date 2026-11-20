import { describe, expect, test } from 'vitest';
import { prepareSpec } from '../src/spec';
import { compiled } from './fixture';

const fc = { type: 'FeatureCollection', features: [] };

describe('prepareSpec (defense in depth for eng review D4/D14)', () => {
  test('accepts a compiled spec and gives every layer without data the map features', () => {
    const spec = prepareSpec(compiled.deck, fc);
    expect((spec.layers[0] as any).data).toBe(fc);
  });

  test('refuses @@= expressions anywhere in the spec', () => {
    const bad = { layers: [{ '@@type': 'GeoJsonLayer', id: 'x', getFillColor: '@@=[255,0,0]' }] };
    expect(() => prepareSpec(bad, fc)).toThrow(/not allowed/);
  });

  test('refuses functions other than the named zullumap helpers', () => {
    const bad = { layers: [{ '@@type': 'GeoJsonLayer', id: 'x', getFillColor: { '@@function': 'eval', code: '1' } }] };
    expect(() => prepareSpec(bad, fc)).toThrow(/eval/);
  });

  test('refuses layer types outside the allowed list', () => {
    const bad = { layers: [{ '@@type': 'WhateverLayer', id: 'x' }] };
    expect(() => prepareSpec(bad, fc)).toThrow(/WhateverLayer/);
  });
});
