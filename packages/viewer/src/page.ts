import { escapeHtml, legendRows, manifestSchema, renderOverlay, rgbCss, serializeJsonBlock, NO_DATA_COLOR, formatNumber, type CompileResult } from '@zullumap/core';
import { PAYLOAD_ID, type PagePayload } from './payload';

export interface PageInput {
  title: string;
  manifest: unknown;
  compiled: CompileResult;
  mapping: Record<string, string>;
  /** overlay.html source, already validated by core. */
  overlay: string;
  basemap: Record<string, unknown> | null;
  recipe: { link: string } | null;
  /** Opening-view still as a data: JPEG (≤200 KB), from `trailer` or `render --poster` (eng re-review D16, D17). */
  poster?: string;
}

export interface PageAssets {
  /** Small inline script that owns the poster, progress bar and failure messages (eng re-review). */
  bootstrap: string;
  /** The viewer runtime: inlined, or a pinned CDN URL with its SRI hash (eng review D6). */
  runtime: { inline: string } | { src: string; integrity: string };
}

const MAX_POSTER_BYTES = 200 * 1024;
const FONTS = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;600&family=Familjen+Grotesk:wght@600&family=IBM+Plex+Mono&display=swap';

/** Write a map page's index.html. Called by `zullumap render` / `remix`. */
export function buildPage(input: PageInput, assets: PageAssets): string {
  const m = manifestSchema.parse(input.manifest);
  if (input.poster !== undefined) checkPoster(input.poster);
  const { compiled } = input;

  const legend = compiled.legend;
  const overlayHtml = renderOverlay(input.overlay, {
    title: input.title,
    legend: legend ? legendRows(legend) : undefined,
    noData: legend?.hasNoData ? { label: 'No data', color: rgbCss(NO_DATA_COLOR) } : undefined,
    height: legend?.height ? { low: formatNumber(legend.height.low), high: formatNumber(legend.height.high) } : undefined,
  });

  const payload: PagePayload = {
    title: input.title,
    manifest: { id: m.id, version: m.version, author: m.author, license: m.license, geometry: m.geometry, slots: m.slots, rules: m.rules, loading: m.loading, chrome: m.chrome, inks: m.inks, ramp: m.ramp },
    deck: compiled.deck, features: compiled.features, legend, choices: compiled.choices,
    mapping: input.mapping, overlayHtml, basemap: input.basemap, recipe: input.recipe,
  };

  const title = escapeHtml(input.title);
  const poster = input.poster
    ? `<img src="${escapeHtml(input.poster)}" alt="">`
    : `<div class="zm-card"><p class="zm-card-title">${title}</p><p class="zm-card-note">Loading 3D map…</p></div>`;
  const runtime = 'inline' in assets.runtime
    ? `<script>${scriptSafe(assets.runtime.inline)}</script>`
    : `<script src="${escapeHtml(assets.runtime.src)}" integrity="${escapeHtml(assets.runtime.integrity)}" crossorigin="anonymous" defer></script>`;

  return `<!doctype html>
<html lang="en" data-zm-chrome="${m.chrome}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="${FONTS}">
<style>${BASE_CSS}</style>
</head>
<body>
<div id="zm-map"></div>
<div id="zm-poster" aria-hidden="true">${POSTER_START}${poster}${POSTER_END}<div class="zm-progress"><span></span></div></div>
<div id="zm-status" role="status" aria-live="polite"></div>
<script type="application/json" id="${PAYLOAD_ID}">${serializeJsonBlock(payload)}</script>
<script>${scriptSafe(assets.bootstrap)}</script>
${runtime}
</body>
</html>
`;
}

const POSTER_START = '<!--zm-poster-->';
const POSTER_END = '<!--/zm-poster-->';

/** Put the opening-view poster into an existing map page, replacing the title card or an older poster. */
export function withPoster(html: string, poster: string): string {
  checkPoster(poster);
  const a = html.indexOf(POSTER_START), b = html.indexOf(POSTER_END);
  if (a < 0 || b < a) throw new Error('This is not a zullumap map page (or it was made by an older version); render it again');
  return html.slice(0, a + POSTER_START.length) + `<img src="${escapeHtml(poster)}" alt="">` + html.slice(b);
}

/** Read the payload block back (viewer runtime and tests). */
export function readPayload(doc: Document): PagePayload {
  const el = doc.getElementById(PAYLOAD_ID);
  if (!el?.textContent) throw new Error('This page has no zullumap map data');
  return JSON.parse(el.textContent) as PagePayload;
}

function checkPoster(poster: string) {
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(poster)) throw new Error('The poster must be an inline data:image/jpeg image');
  const bytes = Math.floor((poster.length - poster.indexOf(',') - 1) * 3 / 4);
  if (bytes > MAX_POSTER_BYTES) throw new Error(`The poster is ${Math.round(bytes / 1024)} KB; the limit is 200 KB`);
}

/** Inline scripts must not contain `</script` (it would end the element early). */
function scriptSafe(code: string): string {
  return code.replace(/<\/(script)/gi, '<\\/$1');
}

/** Page-level CSS for the parts that must work before (or without) the runtime: poster, title card, progress bar, status. */
const BASE_CSS = `
:root{--ink:#244C91;--ink-pressed:#173B78;--on-ink:#F3F0E8;--paper:#E9E5DC;--sheet:#F3F0E8;--text:#244C91;--overprint:#E74F8A;
--panel:rgba(243,240,232,.92);--panel-text:#244C91;--font-body:"Atkinson Hyperlegible Next",system-ui,sans-serif;--font-display:"Familjen Grotesk",system-ui,sans-serif}
[data-zm-chrome=dark]{--sheet:#1C2233;--panel:rgba(28,34,51,.92);--panel-text:#F3F0E8;--text:#F3F0E8}
html,body{margin:0;height:100%;overflow:hidden;background:var(--paper)}
#zm-map{position:fixed;inset:0}
#zm-poster{position:fixed;inset:0;z-index:5;background:var(--paper);transition:opacity 600ms ease-out}
#zm-poster img{width:100%;height:100%;object-fit:cover;display:block}
#zm-poster.zm-done{opacity:0;pointer-events:none}
.zm-card{position:absolute;top:24px;left:24px;right:24px;max-width:640px;font-family:var(--font-body);color:var(--text)}
.zm-card-title{display:inline-block;margin:0 0 8px;padding:12px 16px;background:var(--sheet);border:1px solid var(--ink);font:600 1.25rem/1.15 var(--font-display);color:var(--panel-text)}
.zm-card-note{margin:0;font-size:1rem;color:var(--text)}
.zm-progress{position:absolute;left:0;right:0;bottom:0;height:3px}
.zm-progress span{display:block;height:100%;width:30%;background:var(--ink);animation:zm-bar 1.2s ease-in-out infinite alternate}
#zm-poster.zm-failed .zm-progress{display:none}
@keyframes zm-bar{from{margin-left:0}to{margin-left:70%}}
@media (prefers-reduced-motion:reduce){.zm-progress span{animation:none;width:100%;opacity:.4}#zm-poster{transition:none}}
#zm-status:empty{display:none}
#zm-status{position:fixed;z-index:6;left:16px;right:16px;bottom:96px;margin:0 auto;max-width:480px;padding:16px;background:var(--panel);color:var(--panel-text);font:1rem/1.5 var(--font-body)}
#zm-status a{color:inherit;font-weight:600}
`;
