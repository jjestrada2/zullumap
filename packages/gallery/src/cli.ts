import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { GALLERY_HOST } from '@zullumap/core';
import { buildSite } from './build';

const { values } = parseArgs({ options: { out: { type: 'string' }, base: { type: 'string' }, templates: { type: 'string' }, host: { type: 'string' } } });
const here = (f: string) => fileURLToPath(new URL(f, import.meta.url));
const out = resolve(values.out ?? 'site');
buildSite({
  templatesDir: resolve(values.templates ?? 'templates'), outDir: out, base: values.base ?? '/zullumap', host: values.host ?? GALLERY_HOST,
  assets: {
    bootstrap: readFileSync(here('../../viewer/dist/bootstrap.js'), 'utf8'), runtime: readFileSync(here('../../viewer/dist/runtime.js'), 'utf8'),
    client: readFileSync(here('./client.js'), 'utf8'), demo: readFileSync(here('./demo.js'), 'utf8'),
  },
});
console.log(`gallery: site written to ${out}`);
