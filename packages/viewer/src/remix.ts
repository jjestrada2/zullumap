interface ManifestLike { geometry: 'polygon' | 'point' | 'line'; slots: Record<string, { type: 'number' | 'string'; required: boolean }> }

const GEOMETRY: Record<ManifestLike['geometry'], string> = { polygon: 'Polygons', point: 'Points', line: 'Lines' };
const PURPOSE: Record<string, string> = { value: 'color', height: 'height', label: 'names' };

/** Text for the map page's "Remix this map" panel (design re-review D12). */
export function remixTexts(args: { link: string; manifest: ManifestLike }) {
  const { link, manifest } = args;
  const command = `npx zullumap remix ${link}`;
  const required = Object.entries(manifest.slots).filter(([, s]) => s.required);
  const optional = Object.entries(manifest.slots).filter(([, s]) => !s.required);
  const col = ([name, s]: [string, ManifestLike['slots'][string]]) => `a ${s.type === 'number' ? 'number' : 'text'} column for ${PURPOSE[name] ?? name}`;
  const opt = optional.length ? `, and optionally ${joinAnd(optional.map(col))}` : '';
  const dataNeeds = `${GEOMETRY[manifest.geometry]} in GeoJSON (WGS84) with ${joinAnd(required.map(col))}${opt}.`;
  const maps = required.map(([name]) => `--map ${name}=<column>`).join(' ');
  const prompt = `Remix this map with my data using zullumap. Run: ${command} --data <my file> --title "<my title>" ${maps}. ` +
    `Pick the columns from my file (${dataNeeds.replace(/\.$/, '')}) and ask me for the title.`;
  return { link, command, prompt, dataNeeds, templateUrl: link.split('#')[0]! };
}

function joinAnd(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}
