import { compile } from '@zullumap/core';

export const manifest = {
  id: 'risograph-choropleth', version: '1.0.0', author: 'juan', license: 'CC-BY-4.0',
  geometry: 'polygon',
  slots: { value: { type: 'number', required: true }, height: { type: 'number', required: false }, label: { type: 'string', required: false } },
  title: { maxLength: 48 },
  rules: {
    classMethods: ['quantile', 'natural'],
    classCount: { min: 2, max: 7, default: 4 },
    heightScale: { min: 0, max: 5000, default: 3000 },
    zoom: { min: 3, max: 16 }, pitch: { min: 0, max: 70, default: 50 },
  },
  ramp: ['#2499A6', '#F49AA8', '#E95E5A', '#E9B24F'],
  inks: ['teal', 'pink', 'coral', 'mustard'],
  loading: 'ink-pass', chrome: 'light',
};
export const deck = { layers: [{ '@@type': 'GeoJsonLayer', id: 'cells', extruded: true, getFillColor: '{{slot:value}}', getElevation: '{{slot:height}}' }] };
export const overlay = `<style>[data-zm-region=title]{position:absolute;top:24px;left:24px}</style>
<h1 data-zm-region="title">{{title}}</h1>
<ul data-zm-region="legend">{{#legend}}<li><i style="background:{{color}}"></i>{{label}}</li>{{/legend}}</ul>
<p data-zm-region="credits">Riso template by juan</p>`;

const sq = (x: number) => [[[x, 4], [x + 0.01, 4], [x + 0.01, 4.01], [x, 4.01], [x, 4]]];
export const data = {
  type: 'FeatureCollection',
  features: [1, 2, 3, 4, 5, 6, 7, 8].map((v, i) => ({
    type: 'Feature', properties: { pop: v, h: v * 10, name: `Barrio ${i + 1}` }, geometry: { type: 'Polygon', coordinates: sq(-74 + i * 0.01) },
  })),
};
export const mapping = { value: 'pop', height: 'h', label: 'name' };
export const compiled = compile({ manifest, deck, data, mapping, overlay });
export const LINK = 'https://jjestrada2.github.io/zullumap/t/risograph-choropleth@1.0.0#r=0';
