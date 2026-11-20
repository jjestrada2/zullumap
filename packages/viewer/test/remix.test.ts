import { describe, expect, test } from 'vitest';
import { remixTexts } from '../src/remix';
import { manifest, LINK } from './fixture';

describe('remix panel text (design re-review D12)', () => {
  const t = remixTexts({ link: LINK, manifest: manifest as Parameters<typeof remixTexts>[0]['manifest'] });

  test('gives the remix command for this map link', () => {
    expect(t.command).toBe(`npx zullumap remix ${LINK}`);
  });

  test('gives an agent prompt that names the command, the data and the title', () => {
    expect(t.prompt).toContain(t.command);
    expect(t.prompt).toMatch(/--data/);
    expect(t.prompt).toMatch(/--title/);
    expect(t.prompt).toMatch(/--map value=/);
  });

  test('says in one line what the data needs, from the template slots', () => {
    expect(t.dataNeeds).toBe('Polygons in GeoJSON (WGS84) with a number column for color, and optionally a number column for height and a text column for names.');
  });

  test('links to the template page, without the recipe fragment', () => {
    expect(t.templateUrl).toBe('https://jjestrada2.github.io/zullumap/t/risograph-choropleth@1.0.0');
  });
});
