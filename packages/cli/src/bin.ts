import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { main } from './main';

const assetsDir = fileURLToPath(new URL('./assets/', import.meta.url));

function openFile(file: string) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [file]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', file]]
    : ['xdg-open', [file]];
  spawn(cmd, args as string[], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

main(process.argv.slice(2), {
  out: s => process.stdout.write(s + '\n'),
  err: s => process.stderr.write(s + '\n'),
  open: openFile,
  isTTY: Boolean(process.stdout.isTTY),
  progress: line => { if (process.stderr.isTTY) process.stderr.write(`\r\x1b[2K${line}`); },
  loadAssets: () => ({
    bootstrap: readFileSync(assetsDir + 'bootstrap.js', 'utf8'),
    // Preview: the runtime is inlined. Once @zullumap/viewer is on npm, pages load it from a pinned CDN URL with SRI (eng review D6).
    runtime: { inline: readFileSync(assetsDir + 'runtime.js', 'utf8') },
  }),
}).then(code => { process.exitCode = code; });
