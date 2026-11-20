import { describe, expect, test } from 'vitest';
import { validateTemplate } from '../src/template';

const manifest = {
  id: 'risograph-choropleth',
  version: '1.0.0',
  author: 'juan',
  license: 'CC-BY-4.0',
  geometry: 'polygon',
  slots: {
    value: { type: 'number', required: true },
    height: { type: 'number', required: false },
    label: { type: 'string', required: false },
  },
  title: { maxLength: 48 },
  rules: {
    classMethods: ['quantile', 'natural'],
    classCount: { min: 3, max: 7, default: 5 },
    heightScale: { min: 0, max: 5000, default: 3000 },
    zoom: { min: 3, max: 16 },
    pitch: { min: 0, max: 70, default: 50 },
  },
  ramp: ['#2499A6', '#F49AA8', '#E95E5A', '#E9B24F'],
  loading: 'ink-pass',
  chrome: 'light',
};

const deck = {
  layers: [{
    '@@type': 'GeoJsonLayer',
    id: 'cells',
    extruded: true,
    getFillColor: '{{slot:value}}',
    getElevation: '{{slot:height}}',
  }],
};

const overlay = `<div data-zm-region="title">{{title}}</div>
<div data-zm-region="legend">{{#classes}}<span>{{label}}</span>{{/classes}}</div>
<div data-zm-region="credits">{{credits}}</div>`;

const ok = () => ({ manifest: structuredClone(manifest), deck: structuredClone(deck), overlay });

describe('validateTemplate', () => {
  test('accepts a well-formed template', () => {
    expect(validateTemplate(ok())).toEqual({ ok: true, errors: [] });
  });

  test('reports schema problems in the manifest with the field path', () => {
    const t = ok();
    (t.manifest as Record<string, unknown>).version = 'one';
    const r = validateTemplate(t);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/version/);
  });

  test('rejects a default class count outside its own min/max', () => {
    const t = ok();
    t.manifest.rules.classCount.default = 9;
    expect(validateTemplate(t).errors.join(' ')).toMatch(/classCount/);
  });

  test('rejects raw @@ expressions in deck.json (slots only, design D4)', () => {
    const t = ok();
    (t.deck.layers[0] as Record<string, unknown>).getFillColor = '@@=properties.pop';
    expect(validateTemplate(t).errors.join(' ')).toMatch(/@@/);
  });

  test('allows @@type, which only names a registered layer class', () => {
    expect(validateTemplate(ok()).ok).toBe(true);
  });

  test('rejects a slot placeholder for a slot the manifest does not declare', () => {
    const t = ok();
    (t.deck.layers[0] as Record<string, unknown>).getLineColor = '{{slot:mystery}}';
    expect(validateTemplate(t).errors.join(' ')).toMatch(/mystery/);
  });

  test('rejects scripts, inline event handlers and javascript: URLs in overlay.html (design D3)', () => {
    for (const bad of ['<script>alert(1)</script>', '<img src=x onerror="x()">', '<a href="javascript:x()">a</a>']) {
      const t = { ...ok(), overlay: overlay + bad };
      expect(validateTemplate(t).ok, bad).toBe(false);
    }
  });

  test('requires title and legend region markers in overlay.html (eng outside voice #5)', () => {
    const t = { ...ok(), overlay: '<div>{{title}}</div>' };
    const errors = validateTemplate(t).errors.join(' ');
    expect(errors).toMatch(/title/);
    expect(errors).toMatch(/legend/);
  });

  test('requires an ink order for ink-pass loading (design re-review D2)', () => {
    const t = ok();
    delete (t.manifest as Record<string, unknown>).ramp;
    expect(validateTemplate(t).errors.join(' ')).toMatch(/ink-pass/);
  });
});
