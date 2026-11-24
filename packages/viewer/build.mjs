// Bundle the viewer's two browser scripts: the tiny inline bootstrap and the runtime (MapLibre + deck.gl).
import { build } from 'esbuild';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const common = { bundle: true, minify: true, format: 'iife', target: 'es2022', platform: 'browser', legalComments: 'none', absWorkingDir: here, logLevel: 'warning' };
await build({ ...common, entryPoints: ['src/bootstrap.ts'], outfile: 'dist/bootstrap.js' });
await build({ ...common, entryPoints: ['src/runtime.ts'], outfile: 'dist/runtime.js', loader: { '.css': 'text' } });

for (const f of ['bootstrap.js', 'runtime.js']) {
  const code = readFileSync(`${here}dist/${f}`, 'utf8');
  if (/<\/script/i.test(code)) throw new Error(`${f} contains "</script", which would break inlining`);
  console.log(`viewer: dist/${f} ${(statSync(`${here}dist/${f}`).size / 1024).toFixed(0)} KB`);
}
