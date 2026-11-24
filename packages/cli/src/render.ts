import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { compile, defaultChoices, encodeRecipeLink, manifestSchema, validateTemplate, CORE_MAJOR } from '@zullumap/core';
import { buildPage, type PageAssets } from '@zullumap/viewer/src/page';
import type { RenderArgs } from './args';

/** Gallery host for remix links in the 2026 preview (GitHub Pages). */
export const GALLERY_HOST = 'https://jjestrada2.github.io/zullumap';
const LARGE_DATA_BYTES = 20 * 1024 * 1024;

export type RenderOptions = Omit<RenderArgs, 'open' | 'options'> & { options?: string };
export interface RenderResult { outDir: string; page: string; link: string | null; warnings: string[] }

/** Template + data + choices → an interactive map page folder (index.html, recipe.json). */
export function render(o: RenderOptions, assets: PageAssets): RenderResult {
  const t = loadTemplateDir(o.templateDir);
  const m = manifestSchema.parse(t.manifest);
  if (m.id !== o.template.id) throw new Error(`The folder ${o.templateDir} holds template "${m.id}", not "${o.template.id}"`);
  if (o.template.version && m.version !== o.template.version) {
    throw new Error(`The folder ${o.templateDir} is version ${m.version}, not ${o.template.version}`);
  }
  if (o.title.length > m.title.maxLength) {
    throw new Error(`The title is ${o.title.length} characters; this template allows at most ${m.title.maxLength}`);
  }
  for (const slot of Object.keys(o.mapping)) {
    if (!m.slots[slot]) throw new Error(`This template has no slot "${slot}" (its slots: ${Object.keys(m.slots).join(', ')})`);
  }

  const warnings: string[] = [];
  const data = readData(o.data, m.geometry, warnings);
  checkTextColumns(data, o.mapping, m.slots);
  const options = o.options ? readJson(o.options, '--options') as Record<string, unknown> : undefined;

  const compiled = compile({ manifest: t.manifest, deck: t.deck, data, mapping: o.mapping, options, overlay: t.overlay });
  warnings.push(...compiled.warnings);

  const link = o.recipe
    ? encodeRecipeLink({ host: GALLERY_HOST, template: { id: m.id, version: m.version }, choices: compiled.choices, defaults: defaultChoices(t.manifest) })
    : null;

  const html = buildPage({
    title: o.title, manifest: t.manifest, compiled, mapping: o.mapping, overlay: t.overlay,
    basemap: t.basemap, recipe: link ? { link } : null,
  }, assets);

  const outDir = resolve(o.out);
  mkdirSync(outDir, { recursive: true });
  const page = join(outDir, 'index.html');
  writeFileSync(page, html);
  if (link) {
    const recipe = {
      template: { id: m.id, version: m.version, author: m.author, license: m.license },
      coreMajor: CORE_MAJOR, choices: compiled.choices, mapping: o.mapping, title: o.title, link,
      basemapAttribution: basemapAttribution(t.basemap),
    };
    writeFileSync(join(outDir, 'recipe.json'), JSON.stringify(recipe, null, 2) + '\n');
  }
  return { outDir, page, link, warnings };
}

/** Read a local template folder: manifest.json, deck.json, overlay.html, optional basemap.json. Validated every load (trust model). */
export function loadTemplateDir(dir: string) {
  if (!existsSync(join(dir, 'manifest.json'))) throw new Error(`No template in ${dir} (manifest.json is missing)`);
  const manifest = readJson(join(dir, 'manifest.json'), 'manifest.json');
  const deck = readJson(join(dir, 'deck.json'), 'deck.json');
  const overlay = readFileSync(join(dir, 'overlay.html'), 'utf8');
  const basemap = existsSync(join(dir, 'basemap.json')) ? readJson(join(dir, 'basemap.json'), 'basemap.json') as Record<string, unknown> : null;
  if (existsSync(join(dir, 'effects.js'))) throw new Error('This template has effects.js; templates with code are not supported yet');
  const check = validateTemplate({ manifest, deck, overlay });
  if (!check.ok) throw new Error(`The template in ${dir} is invalid:\n- ${check.errors.join('\n- ')}`);
  return { manifest, deck, overlay, basemap };
}

function readData(file: string, geometry: string, warnings: string[]): unknown {
  if (!existsSync(file)) throw new Error(`Can't find the data file ${file}`);
  const ext = extname(file).toLowerCase();
  if (ext === '.csv') {
    throw new Error(`CSV gives point data, but this template maps ${geometry} data; use a GeoJSON file of ${geometry === 'polygon' ? 'polygons' : `${geometry}s`}`);
  }
  if (ext !== '.geojson' && ext !== '.json') {
    throw new Error(`zullumap reads GeoJSON or CSV. Convert with: ogr2ogr -f GeoJSON out.geojson in${ext || '.shp'}`);
  }
  if (statSync(file).size > LARGE_DATA_BYTES) warnings.push('This data is over 20 MB; the map page may load slowly in browsers');
  return readJson(file, file);
}

function checkTextColumns(data: unknown, mapping: Record<string, string>, slots: Record<string, { type: string }>) {
  const features = (data as { features?: { properties?: Record<string, unknown> | null }[] }).features ?? [];
  const columns = [...new Set(features.flatMap(f => Object.keys(f.properties ?? {})))];
  for (const [slot, column] of Object.entries(mapping)) {
    if (slots[slot]?.type === 'string' && !columns.includes(column)) {
      throw new Error(`The ${slot} slot is mapped to column "${column}", which the data doesn't have (columns: ${columns.join(', ')})`);
    }
  }
}

function basemapAttribution(style: Record<string, unknown> | null): string[] {
  const sources = (style?.sources ?? {}) as Record<string, { attribution?: string }>;
  return Object.values(sources).flatMap(s => (s.attribution ? [s.attribution] : []));
}

function readJson(file: string, name: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${name} is not valid JSON: ${(e as Error).message}`);
  }
}
