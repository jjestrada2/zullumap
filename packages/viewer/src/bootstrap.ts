/**
 * Inline bootstrap (eng re-review): owns the poster, progress bar and failure messages, so they work
 * even when the viewer runtime can't load. Kept tiny and dependency-free.
 */
export const MESSAGES = {
  webgl: "Your device can't show the 3D map — here's a picture of it.",
  offline: 'Connect to the internet to explore this map.',
} as const;
type Failure = keyof typeof MESSAGES;

const RUNTIME_TIMEOUT_MS = 20_000;
const poster = document.getElementById('zm-poster');
const status = document.getElementById('zm-status');
let state: 'loading' | 'ready' | Failure = 'loading';

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

function fail(kind: Failure) {
  if (state === kind || (state !== 'loading' && kind !== 'webgl')) return;
  state = kind;
  poster?.classList.remove('zm-done');
  poster?.classList.add('zm-failed');
  if (status) status.textContent = MESSAGES[kind];
}

function ready() {
  if (state !== 'loading') return;
  state = 'ready';
  poster?.classList.add('zm-done');
}

const webgl = hasWebGL();
(window as unknown as { __zmBoot: unknown }).__zmBoot = { ready, fail, webgl, started: false };
if (!webgl) fail('webgl');

// A runtime <script src> that fails to load (offline, CDN down, wrong SRI hash) fires a non-bubbling error.
addEventListener('error', e => { if (e.target instanceof HTMLScriptElement) fail('offline'); }, true);
setTimeout(() => {
  const boot = (window as unknown as { __zmBoot: { started: boolean } }).__zmBoot;
  if (!boot.started) fail('offline');
}, RUNTIME_TIMEOUT_MS);
