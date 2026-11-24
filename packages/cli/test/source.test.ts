import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRecipe } from '../src/source';

const recipe = {
  template: { id: 'risograph-choropleth', version: '1.0.0', author: 'Juan Estrada', license: 'CC-BY-4.0' },
  coreMajor: 0, choices: { method: 'natural', classCount: 5, heightScale: 0.2, pitch: 50 },
  mapping: { value: 'pop', height: 'pop' }, title: 'Density in Bogotá',
  link: 'https://jjestrada2.github.io/zullumap/t/risograph-choropleth@1.0.0#r=0;mn;c5;h0.2', basemapAttribution: [],
};
const folder = (r: unknown = recipe) => {
  const d = mkdtempSync(join(tmpdir(), 'zm-src-'));
  if (r !== null) writeFileSync(join(d, 'recipe.json'), JSON.stringify(r));
  writeFileSync(join(d, 'index.html'), '<html></html>');
  return d;
};

let server: Server, base = '';
beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/maps/bogota/recipe.json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(recipe)); }
    else { res.writeHead(404); res.end(); }
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => server.close());

describe('loadRecipe: how remix gets the recipe', () => {
  test('a local map page folder: reads recipe.json, including the columns and title', async () => {
    const r = await loadRecipe(folder());
    expect(r).toMatchObject({ template: { id: 'risograph-choropleth', version: '1.0.0' }, choices: recipe.choices, mapping: recipe.mapping, title: 'Density in Bogotá', warnings: [] });
  });

  test('a folder made with --no-recipe cannot be remixed', async () => {
    await expect(loadRecipe(folder(null))).rejects.toThrow(/no recipe\.json.*--no-recipe/);
  });

  test('a damaged recipe.json is reported', async () => {
    await expect(loadRecipe(folder({ template: 'x' }))).rejects.toThrow(/recipe\.json is damaged/);
  });

  test('a remix link on the gallery: decoded locally, choices only, no columns or title', async () => {
    const r = await loadRecipe('https://jjestrada2.github.io/zullumap/t/risograph-choropleth@1.0.0#r=0;mn;c5');
    expect(r).toEqual({ template: { id: 'risograph-choropleth', version: '1.0.0' }, choices: { method: 'natural', classCount: 5 }, mapping: undefined, title: undefined, warnings: [] });
  });

  test('a published map page URL: fetches <page>/recipe.json (with or without index.html)', async () => {
    expect((await loadRecipe(`${base}/maps/bogota/`)).mapping).toEqual(recipe.mapping);
    expect((await loadRecipe(`${base}/maps/bogota/index.html`)).title).toBe('Density in Bogotá');
    expect((await loadRecipe(`${base}/maps/bogota`)).title).toBe('Density in Bogotá');
  });

  test('a map page URL without a recipe says so', async () => {
    await expect(loadRecipe(`${base}/maps/nothing/`)).rejects.toThrow(`Couldn't get the recipe from ${base}/maps/nothing/recipe.json (HTTP 404)`);
  });

  test('anything else is unsupported input', async () => {
    await expect(loadRecipe('not-a-folder-or-url')).rejects.toThrow('unsupported input: pass a zullumap map page, a recipe link or a map page URL');
  });

  test('warns when the recipe was made by a different core major version (eng review D13)', async () => {
    const r = await loadRecipe(folder({ ...recipe, coreMajor: 1 }));
    expect(r.warnings.join(' ')).toMatch(/core version 1/);
  });
});
