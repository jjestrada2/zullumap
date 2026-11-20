import { parseArgs } from 'node:util';

export interface RenderArgs {
  template: { id: string; version: string | undefined };
  templateDir: string;
  data: string;
  mapping: Record<string, string>;
  title: string;
  out: string;
  options: string | undefined;
  recipe: boolean;
  open: boolean;
}

const TEMPLATE_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*)(?:@(\d+\.\d+\.\d+))?$/;

/** `zullumap render <template>[@<version>] --template-dir <folder> --data <file> --map slot=column --title "…" --out <folder>` */
export function parseRenderArgs(argv: string[]): RenderArgs {
  const { values, positionals } = parseArgs({
    args: argv, allowPositionals: true, strict: true,
    options: {
      'template-dir': { type: 'string' }, data: { type: 'string' }, map: { type: 'string', multiple: true },
      title: { type: 'string' }, out: { type: 'string' }, options: { type: 'string' },
      'no-recipe': { type: 'boolean' }, 'no-open': { type: 'boolean' },
    },
  });
  const spec = positionals[0];
  const t = spec ? TEMPLATE_RE.exec(spec) : null;
  if (!t) throw new Error('Name the template: zullumap render <template>@<version>, e.g. risograph-choropleth@1.0.0');
  if (positionals.length > 1) throw new Error(`Unexpected argument "${positionals[1]}"`);
  if (!values['template-dir']) {
    throw new Error('The template registry is not published yet; pass the template folder with --template-dir, e.g. --template-dir templates/risograph-choropleth');
  }
  if (!values.data) throw new Error('--data is required: the GeoJSON file to map');
  if (!values.map?.length) throw new Error('--map is required: map each template slot to a data column, e.g. --map value=<column>');
  if (!values.title) throw new Error('--title is required: the map title');
  if (!values.out) throw new Error('--out is required: the folder to write the map page to');

  const mapping: Record<string, string> = {};
  for (const m of values.map) {
    const eq = m.indexOf('=');
    if (eq < 1 || eq === m.length - 1) throw new Error(`--map needs slot=column (got "${m}")`);
    mapping[m.slice(0, eq)] = m.slice(eq + 1);
  }
  return {
    template: { id: t[1]!, version: t[2] }, templateDir: values['template-dir'], data: values.data, mapping,
    title: values.title, out: values.out, options: values.options, recipe: !values['no-recipe'], open: !values['no-open'],
  };
}
