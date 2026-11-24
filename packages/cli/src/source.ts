import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { decodeRecipeLink, recipeFileSchema, CORE_MAJOR, type RecipeChoices, type TemplateRef } from '@zullumap/core';
import { GALLERY_HOST } from './render';

export interface LoadedRecipe {
  template: TemplateRef;
  choices: RecipeChoices;
  /** Column names and title come only from a map page's recipe.json, never from a remix link. */
  mapping: Record<string, string> | undefined;
  title: string | undefined;
  warnings: string[];
}

const UNSUPPORTED = 'unsupported input: pass a zullumap map page, a recipe link or a map page URL';
/** Gallery hosts whose remix links are decoded locally; older hosts stay listed when the gallery moves. */
export const ACCEPTED_HOSTS = [GALLERY_HOST];

/** How remix gets the recipe: a map page folder, a remix link on the gallery, or a published map page URL. */
export async function loadRecipe(source: string): Promise<LoadedRecipe> {
  if (existsSync(source) && statSync(source).isDirectory()) {
    const file = join(source, 'recipe.json');
    if (!existsSync(file)) throw new Error(`${source} has no recipe.json (it was made with --no-recipe), so it can't be remixed`);
    return fromFile(readFileSync(file, 'utf8'), file);
  }
  if (!/^https?:\/\//.test(source)) throw new Error(UNSUPPORTED);
  if (ACCEPTED_HOSTS.some(h => source.startsWith(`${h}/t/`))) {
    const d = decodeRecipeLink(source, { acceptedHosts: ACCEPTED_HOSTS });
    return { template: d.template, choices: d.choices, mapping: undefined, title: undefined, warnings: d.warnings };
  }
  const page = source.split('#')[0]!.split('?')[0]!.replace(/\/index\.html$/, '').replace(/\/$/, '');
  const url = `${page}/recipe.json`;
  let res: Response;
  try {
    res = await fetch(url, { redirect: 'follow' });
  } catch (e) {
    throw new Error(`Couldn't reach ${url}: ${(e as Error).message}`);
  }
  if (!res.ok) throw new Error(`Couldn't get the recipe from ${url} (HTTP ${res.status})`);
  return fromFile(await res.text(), url);
}

function fromFile(text: string, where: string): LoadedRecipe {
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = null; }
  const parsed = recipeFileSchema.safeParse(json);
  if (!parsed.success) throw new Error(`The recipe.json at ${where} is damaged, so this map can't be remixed`);
  const r = parsed.data;
  const warnings = r.coreMajor === CORE_MAJOR ? [] : [
    `This map was made with zullumap core version ${r.coreMajor}.x; you have ${CORE_MAJOR}.x, so class breaks may differ slightly`,
  ];
  return { template: { id: r.template.id, version: r.template.version }, choices: r.choices, mapping: r.mapping, title: r.title, warnings };
}
