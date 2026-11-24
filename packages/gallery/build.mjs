// Build the static site: viewer scripts, the template page and demo scripts, then the pages themselves.
// Usage: node packages/gallery/build.mjs [--out site] [--base /zullumap] [--templates templates]
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
execFileSync(process.execPath, [fileURLToPath(new URL('../viewer/build.mjs', import.meta.url))], { stdio: 'inherit' });
const browser = { bundle: true, minify: true, format: 'iife', target: 'es2022', platform: 'browser', legalComments: 'none', absWorkingDir: here, logLevel: 'warning' };
await build({ ...browser, entryPoints: ['src/client.ts'], outfile: 'dist/client.js' });
await build({ ...browser, entryPoints: ['src/demo.ts'], outfile: 'dist/demo.js' });
await build({ entryPoints: ['src/cli.ts'], outfile: 'dist/cli.js', bundle: true, platform: 'node', format: 'esm', target: 'node20', absWorkingDir: here, logLevel: 'warning' });
execFileSync(process.execPath, [`${here}dist/cli.js`, ...process.argv.slice(2)], { stdio: 'inherit' });
