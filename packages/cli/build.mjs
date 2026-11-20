// Bundle the CLI (core + viewer page builder included) and copy the viewer's browser scripts next to it.
import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
execFileSync(process.execPath, [fileURLToPath(new URL('../viewer/build.mjs', import.meta.url))], { stdio: 'inherit' });
await build({
  entryPoints: ['src/bin.ts'], outfile: 'dist/cli.js', absWorkingDir: here,
  bundle: true, platform: 'node', external: ['playwright', 'playwright-core', 'ffmpeg-static'], format: 'esm', target: 'node20', legalComments: 'none', logLevel: 'warning',
});
mkdirSync(`${here}dist/assets`, { recursive: true });
for (const f of ['bootstrap.js', 'runtime.js']) cpSync(`${here}../viewer/dist/${f}`, `${here}dist/assets/${f}`);
console.log('cli: dist/cli.js + assets');
