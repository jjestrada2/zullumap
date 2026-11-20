import { join } from 'node:path';
import { parseRenderArgs } from './args';
import { render } from './render';
import type { PageAssets } from '@zullumap/viewer/src/page';

export interface Io {
  out(line: string): void;
  err(line: string): void;
  open(file: string): void;
  loadAssets(): PageAssets;
  isTTY: boolean;
}

export const USAGE = `zullumap: remixable 3D map templates

Usage:
  zullumap render <template>@<version> --template-dir <folder> --data <file.geojson>
                  --map value=<column> [--map height=<column>] [--map label=<column>]
                  --title "<title>" --out <folder> [--options <choices.json>] [--no-recipe] [--no-open]

Example:
  zullumap render risograph-choropleth@1.0.0 --template-dir templates/risograph-choropleth \\
    --data examples/bogota-grid.geojson --map value=density --map height=density \\
    --title "Density in Bogotá (synthetic)" --out my-map`;

/** CLI entry: returns the exit code. */
export function main(argv: string[], io: Io): number {
  const [command, ...rest] = argv;
  try {
    if (!command || command === '--help' || command === '-h' || command === 'help') {
      io.out(USAGE);
      return command ? 0 : 1;
    }
    if (command !== 'render') throw new Error(`Unknown command "${command}"\n\n${USAGE}`);
    const args = parseRenderArgs(rest);
    const r = render(args, io.loadAssets());
    for (const w of r.warnings) io.err(`Warning: ${w}`);
    io.out(`Saved your map: ${join(r.outDir, 'index.html')}`);
    io.out(`Make a trailer: zullumap trailer ${r.outDir}`);
    if (r.link) io.out(`Remix link: ${r.link}`);
    if (args.open && io.isTTY) io.open(r.page);
    return 0;
  } catch (e) {
    io.err(`zullumap: ${(e as Error).message}`);
    return 1;
  }
}
