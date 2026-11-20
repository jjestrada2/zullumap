import { join } from 'node:path';
import { parseRenderArgs, parseTrailerArgs } from './args';
import { recordTrailer } from './trailer';
import { render } from './render';
import type { PageAssets } from '@zullumap/viewer/src/page';

export interface Io {
  out(line: string): void;
  err(line: string): void;
  open(file: string): void;
  loadAssets(): PageAssets;
  isTTY: boolean;
  /** Overwrite one status line (frame counter); '' clears it. */
  progress(line: string): void;
}

export const USAGE = `zullumap: remixable 3D map templates

Usage:
  zullumap render <template>@<version> --template-dir <folder> --data <file.geojson>
                  --map value=<column> [--map height=<column>] [--map label=<column>]
                  --title "<title>" --out <folder> [--options <choices.json>] [--no-recipe] [--no-open]
  zullumap trailer <map-folder> [--size 1080x1350] [--duration 12] [--fps 30] [--out trailer.mp4]

Example:
  zullumap render risograph-choropleth@1.0.0 --template-dir templates/risograph-choropleth \\
    --data examples/bogota-grid.geojson --map value=density --map height=density \\
    --title "Density in Bogotá (synthetic)" --out my-map
  zullumap trailer my-map`;

/** CLI entry: returns the exit code. */
export async function main(argv: string[], io: Io): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (!command || command === '--help' || command === '-h' || command === 'help') {
      io.out(USAGE);
      return command ? 0 : 1;
    }
    if (command === 'trailer') {
      const args = parseTrailerArgs(rest);
      const r = await recordTrailer(args, io);
      io.out(`Saved your trailer: ${r.out}`);
      if (r.poster) io.out('Added the opening view to the map page as its poster');
      return 0;
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
