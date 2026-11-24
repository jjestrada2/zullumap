import { existsSync, readFileSync } from 'node:fs';
import { manifestSchema } from '@zullumap/core';
import type { PageAssets } from '@zullumap/viewer/src/page';
import type { RemixArgs } from './args';
import { resolveMapping } from './mapping';
import { loadTemplateDir, render, type RenderResult } from './render';
import { loadRecipe } from './source';

export type RemixOptions = Omit<RemixArgs, 'open'>;

/**
 * Re-render a map's look with new data (design: "What the recipe stores, and what remix re-fits"): the template
 * and every stored choice are re-applied; breaks, bounds and camera are re-fitted; data, columns and title are new.
 */
export async function remix(o: RemixOptions, assets: PageAssets): Promise<RenderResult & { notes: string[] }> {
  if (!existsSync(o.data)) throw new Error(`Can't find the data file ${o.data}`);
  const recipe = await loadRecipe(o.source);
  if (!o.title) {
    throw new Error(`--title is required: give your map its own title${recipe.title ? ` (the original was "${recipe.title}")` : ''}`);
  }
  const notes = [...recipe.warnings];
  const wanted = o.template ?? recipe.template;
  if (o.template && (o.template.id !== recipe.template.id || o.template.version !== recipe.template.version)) {
    notes.push(`Using ${o.template.id}@${o.template.version} instead of ${recipe.template.version === o.template.version ? recipe.template.id : recipe.template.version}`);
  }
  const t = loadTemplateDir(o.templateDir);
  const m = manifestSchema.parse(t.manifest);
  if (!o.template && (m.id !== recipe.template.id || m.version !== recipe.template.version)) {
    const has = m.id === recipe.template.id ? `has version ${m.version}` : `holds template ${m.id}`;
    throw new Error(`This map was made with ${recipe.template.id}@${recipe.template.version}, but ${o.templateDir} ${has}. ` +
      `Pass the folder for ${recipe.template.id}@${recipe.template.version}, or remix with this one on purpose: --template ${m.id}@${m.version}`);
  }

  const { mapping, notes: mapNotes } = resolveMapping({ slots: m.slots, stored: recipe.mapping, overrides: o.mapping, columns: columnsOf(o.data) });
  const result = render({
    template: { id: wanted.id, version: wanted.version }, templateDir: o.templateDir, data: o.data, mapping,
    title: o.title, out: o.out ?? folderForTitle(o.title), recipe: o.recipe, choices: { ...recipe.choices },
  }, assets);
  return { ...result, notes: [...notes, ...mapNotes] };
}

/** Column names in a GeoJSON file (for reusing the original map's column names). Render does the full checks. */
function columnsOf(file: string): string[] {
  try {
    const fc = JSON.parse(readFileSync(file, 'utf8')) as { features?: { properties?: Record<string, unknown> | null }[] };
    return [...new Set((fc.features ?? []).flatMap(f => Object.keys(f.properties ?? {})))];
  } catch {
    return []; // render reports a missing or unreadable file with its own message
  }
}

/** Default remix output folder: the title in lowercase ASCII words joined by hyphens, e.g. "density-in-medellin". */
export function folderForTitle(title: string): string {
  const slug = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return slug || 'my-map';
}
