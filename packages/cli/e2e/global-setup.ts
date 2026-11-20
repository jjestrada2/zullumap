import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Build the CLI bundle (which builds the viewer's bootstrap and runtime first) once before the browser tests. */
export default function globalSetup() {
  execFileSync(process.execPath, [fileURLToPath(new URL('../build.mjs', import.meta.url))], { stdio: 'inherit' });
}
