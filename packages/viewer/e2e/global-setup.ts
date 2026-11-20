import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Build the bootstrap and runtime bundles once before the browser tests. */
export default function globalSetup() {
  execFileSync(process.execPath, [fileURLToPath(new URL('../build.mjs', import.meta.url))], { stdio: 'inherit' });
}
