import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { escapeHtml, manifestSchema, serializeJsonBlock, validateTemplate, type TemplateManifest } from '@zullumap/core';
import { pageHtml } from '@zullumap/viewer/src/page';
import { remixTexts } from '@zullumap/viewer/src/remix';

export interface SiteAssets {
  /** Viewer bootstrap and runtime (inlined into each demo page). */
  bootstrap: string;
  runtime: string;
  /** Template page script (state, copy, share, demo frame). */
  client: string;
  /** Demo page script: compiles the preview data with the link's choices in the browser. */
  demo: string;
}

export interface SiteOptions {
  templatesDir: string;
  outDir: string;
  /** Path the site is served under, e.g. "/zullumap" for a GitHub Pages project site. */
  base: string;
  /** Gallery host in remix links, e.g. "https://jjestrada2.github.io/zullumap". */
  host: string;
  assets: SiteAssets;
}

interface Template {
  manifest: TemplateManifest;
  raw: { manifest: unknown; deck: unknown; overlay: string; basemap: Record<string, unknown> | null };
  preview: { name: string; title: string; mapping: Record<string, string>; data: unknown };
}

/**
 * Build the static site (design: Gallery): a pinned page per template version (`/t/<id>@<version>/`), a newest page
 * (`/t/<id>/`), a 404 page that sends missing versions to the newest, and the home page.
 */
export function buildSite(o: SiteOptions): void {
  const templates = readdirSync(o.templatesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(join(o.templatesDir, d.name, 'manifest.json')))
    .map(d => loadTemplate(join(o.templatesDir, d.name), d.name));
  if (!templates.length) throw new Error(`No templates found in ${o.templatesDir}`);

  // One version per folder today; the registry (eng review D10) will materialize every tagged version here.
  const newest = new Map<string, Template>();
  for (const t of templates) {
    const prev = newest.get(t.manifest.id);
    if (!prev || compareSemver(t.manifest.version, prev.manifest.version) > 0) newest.set(t.manifest.id, t);
  }

  for (const t of templates) {
    const pinned = `${t.manifest.id}@${t.manifest.version}`;
    write(o.outDir, `t/${pinned}/demo.html`, demoHtml(t, o.assets));
    write(o.outDir, `t/${pinned}/index.html`, templatePageHtml(t, { demo: 'demo.html', base: o.base, host: o.host, client: o.assets.client }));
  }
  for (const [id, t] of newest) {
    write(o.outDir, `t/${id}/index.html`, templatePageHtml(t, { demo: `../${id}@${t.manifest.version}/demo.html`, base: o.base, host: o.host, client: o.assets.client }));
  }
  write(o.outDir, '404.html', notFoundHtml([...newest.keys()], o.base));
  write(o.outDir, 'index.html', homeHtml([...newest.values()], o.base));
}

function loadTemplate(dir: string, folder: string): Template {
  const json = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as unknown;
  const manifest = json('manifest.json');
  const deck = json('deck.json');
  const overlay = readFileSync(join(dir, 'overlay.html'), 'utf8');
  const check = validateTemplate({ manifest, deck, overlay });
  if (!check.ok) throw new Error(`Template ${folder} is invalid:\n- ${check.errors.join('\n- ')}`);
  if (!existsSync(join(dir, 'preview', 'preview.json'))) {
    throw new Error(`${folder} needs preview/preview.json (name, title, data file and column mapping) for its live demo`);
  }
  const p = json('preview/preview.json') as { name: string; title: string; data: string; mapping: Record<string, string> };
  return {
    manifest: manifestSchema.parse(manifest),
    raw: { manifest, deck, overlay, basemap: existsSync(join(dir, 'basemap.json')) ? json('basemap.json') as Record<string, unknown> : null },
    preview: { name: p.name, title: p.title, mapping: p.mapping, data: json(join('preview', p.data)) },
  };
}

/** The live demo inside the template page's iframe: the viewer, fed by a script that compiles the preview in the browser. */
function demoHtml(t: Template, a: SiteAssets): string {
  const data = { ...t.raw, title: t.preview.title, mapping: t.preview.mapping, data: t.preview.data };
  return pageHtml({
    title: t.preview.title, chrome: t.manifest.chrome, payload: null,
    beforeRuntime: `window.__zmTemplate=${serializeJsonBlock(data)};\n${a.demo}`,
  }, { bootstrap: a.bootstrap, runtime: { inline: a.runtime } });
}

const PURPOSE: Record<string, string> = { value: 'color', height: 'height', label: 'names' };
const GEOMETRY = { polygon: 'Polygons', point: 'Points', line: 'Lines' } as const;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const or = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}`);

function dataNeeds(m: TemplateManifest): string[] {
  return [
    `${GEOMETRY[m.geometry]} in GeoJSON (WGS84)`,
    ...Object.entries(m.slots).map(([name, s]) =>
      `A ${s.type === 'number' ? 'number' : 'text'} column for ${PURPOSE[name] ?? name} (${s.required ? 'required' : 'optional'})`),
  ];
}

function agentMayAdjust(m: TemplateManifest): string[] {
  const r = m.rules;
  const def = (v: number | undefined, f: (n: number) => string = String) => (v === undefined ? '' : ` (default ${f(v)})`);
  const lines = [`Class method: ${or(r.classMethods)}`, `Class count: ${r.classCount.min} to ${r.classCount.max}${def(r.classCount.default)}`];
  if (r.heightScale) lines.push(`Height: up to ${pct(r.heightScale.max)} of the map width${def(r.heightScale.default, pct)}`);
  lines.push(`Tilt: ${r.pitch.min}° to ${r.pitch.max}°${def(r.pitch.default, n => `${n}°`)}`);
  return lines;
}

function templatePageHtml(t: Template, o: { demo: string; base: string; host: string; client: string }): string {
  const m = t.manifest;
  const name = escapeHtml(t.preview.name);
  const defaultLink = `${o.host}/t/${m.id}@${m.version}#r=0`;
  const texts = remixTexts({ link: defaultLink, manifest: m });
  const config = { id: m.id, version: m.version, host: o.host, manifest: { geometry: m.geometry, slots: m.slots, rules: m.rules } };
  const li = (xs: string[]) => xs.map(x => `<li>${escapeHtml(x)}</li>`).join('');
  const copyBlock = (id: string, text: string) =>
    `<pre id="${id}">${escapeHtml(text)}</pre><p class="copy-row"><button type="button" class="copy" data-copy="${id}">Copy</button><span class="hint" role="status"></span></p>`;
  const communityCommand = `${texts.command} --data your-data.geojson --title "Your title"`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}: a zullumap template</title>
<meta name="description" content="Remix this 3D map template with your own data.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;600&family=Familjen+Grotesk:wght@600&family=IBM+Plex+Mono&display=swap">
<style>${PAGE_CSS}</style>
</head>
<body>
<header class="bar"><a class="wordmark" href="${escapeHtml(o.base)}/">zullumap</a></header>
<main>
<section class="first" aria-label="Live demo of ${name}">
  <iframe id="zm-demo" title="Live 3D demo of ${name}" data-demo="${escapeHtml(o.demo)}"
    sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"></iframe>
  <noscript><p class="message">Turn on JavaScript to see the live 3D demo.</p></noscript>
  <p id="zm-message" class="message" role="status" hidden></p>
  <a id="zm-remix" class="primary" href="#remix">Remix this map</a>
</section>
<div class="column">
<section id="remix" aria-labelledby="remix-title">
  <h2 id="remix-title" tabindex="-1">Remix this map</h2>
  <p class="phone-note">Love this look? Remix it on your laptop: tap “Remix this map” above to send yourself the link.</p>
  <details id="remix-now" open>
    <summary>Remix now</summary>
    <ol class="steps">
      <li><h3>Get your data ready</h3><p id="zm-needs">${escapeHtml(texts.dataNeeds)}</p></li>
      <li><h3>Ask your agent</h3>${copyBlock('zm-prompt', texts.prompt)}</li>
      <li><h3>Or run it yourself</h3>${copyBlock('zm-command', texts.command)}</li>
    </ol>
  </details>
</section>
<section aria-labelledby="needs-title">
  <h2 id="needs-title">What your data needs</h2>
  <ul class="dash">${li(dataNeeds(m))}</ul>
  <h2>The agent may adjust</h2>
  <ul class="dash">${li(agentMayAdjust(m))}</ul>
</section>
<section aria-labelledby="community-title">
  <h2 id="community-title">Community maps</h2>
  <p>No remixes yet — be the first</p>
  ${copyBlock('zm-community', communityCommand)}
</section>
</div>
</main>
<footer class="column foot"><p>Template ${escapeHtml(m.id)} ${escapeHtml(m.version)} by ${escapeHtml(m.author)}, licensed ${escapeHtml(m.license)}.</p></footer>
<script type="application/json" id="zm-template-page">${serializeJsonBlock(config)}</script>
<script>${o.client.replace(/<\/(script)/gi, '<\\/$1')}</script>
</body>
</html>
`;
}

function notFoundHtml(ids: string[], base: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Not found: zullumap</title>
<style>${PAGE_CSS}</style></head>
<body>
<header class="bar"><a class="wordmark" href="${escapeHtml(base)}/">zullumap</a></header>
<main class="column"><h1>This page doesn't exist</h1><p><a href="${escapeHtml(base)}/">See the map templates</a></p></main>
<script>
// A remix link to a version that's gone lands here: send it to the template's newest page, keeping the link's choices.
(function () {
  var known = ${serializeJsonBlock(ids)}, base = ${serializeJsonBlock(base)};
  var m = location.pathname.match(/\\/t\\/([a-z0-9]+(?:-[a-z0-9]+)*)@([^/]+)\\/?$/);
  if (m && known.indexOf(m[1]) >= 0) location.replace(base + '/t/' + m[1] + '/?missing=' + encodeURIComponent(m[2]) + location.hash);
})();
</script>
</body>
</html>
`;
}

function homeHtml(templates: Template[], base: string): string {
  const items = templates.map(t => `<li><a href="${escapeHtml(base)}/t/${escapeHtml(t.manifest.id)}/">${escapeHtml(t.preview.name)}</a></li>`).join('');
  const more = templates.length === 1 ? '<p>More templates are coming — publish your own</p>' : '';
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>zullumap: map templates you can remix</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;600&family=Familjen+Grotesk:wght@600&display=swap">
<style>${PAGE_CSS}</style></head>
<body>
<header class="bar"><a class="wordmark" href="${escapeHtml(base)}/">zullumap</a></header>
<main class="column home"><h1>Maps can be this beautiful</h1><p>Map templates you can remix with your own data</p>
<ul class="dash">${items}</ul>${more}</main>
</body>
</html>
`;
}

function write(root: string, file: string, html: string) {
  const path = join(root, file);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, html);
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i]! - pb[i]!;
  return 0;
}

/** DESIGN.md: ink on paper, square corners, no shadows; Familjen headings, Atkinson body, Plex Mono commands. */
const PAGE_CSS = `
:root{--ink:#244C91;--ink-pressed:#173B78;--on-ink:#F3F0E8;--paper:#E9E5DC;--sheet:#F3F0E8;--text:#244C91;--muted:#4F5A85;--overprint:#E74F8A}
*{box-sizing:border-box}
html{background:var(--paper)}
body{margin:0;background:var(--paper);color:var(--text);font:1rem/1.5 "Atkinson Hyperlegible Next",system-ui,sans-serif}
a{color:var(--text)}
a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid var(--overprint);outline-offset:2px}
.bar{height:48px;display:flex;align-items:center;padding:0 48px;background:var(--paper)}
.wordmark{font:600 1.25rem/1 "Familjen Grotesk",system-ui,sans-serif;text-decoration:none}
.first{position:relative;height:calc(100svh - 48px);min-height:420px}
.first iframe{display:block;width:100%;height:100%;border:0;background:var(--paper)}
.message{position:absolute;left:16px;right:16px;top:72px;margin:0 auto;max-width:480px;padding:16px;background:rgba(243,240,232,.92);color:var(--text)}
.message[hidden]{display:none}
.primary{display:inline-flex;align-items:center;height:48px;padding:0 24px;background:var(--ink);color:var(--on-ink);font:600 1rem/1 "Atkinson Hyperlegible Next",system-ui,sans-serif;
  text-decoration:none;box-shadow:4px 4px 0 0 var(--overprint);transition:box-shadow 120ms ease-out,transform 120ms ease-out,background-color 120ms ease-out}
.primary:active{background:var(--ink-pressed);box-shadow:0 0 0 0 var(--overprint);transform:translate(4px,4px)}
@media (hover:hover){.primary:hover{background:var(--ink-pressed);box-shadow:0 0 0 0 var(--overprint);transform:translate(4px,4px)}}
#zm-remix{position:absolute;right:28px;bottom:28px}
.column{max-width:640px;margin:0;padding:0 48px}
h1{margin:48px 0 8px;font:600 clamp(2rem,5vw,3.5rem)/1.1 "Familjen Grotesk",system-ui,sans-serif;letter-spacing:-.01em}
h2{margin:48px 0 16px;font:600 1.75rem/1.15 "Familjen Grotesk",system-ui,sans-serif}
h3{margin:0 0 8px;font:600 1rem/1.3 "Atkinson Hyperlegible Next",system-ui,sans-serif}
.steps{margin:0;padding-left:24px}
.steps li{margin:0 0 24px}
pre{margin:0;padding:12px 16px;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--sheet);border:1px solid var(--ink);font:.875rem/1.5 "IBM Plex Mono",ui-monospace,monospace}
.copy-row{display:flex;gap:16px;align-items:center;margin:8px 0 0}
.copy{min-height:44px;padding:0 16px;border:1px solid var(--ink);border-radius:0;background:none;color:var(--text);font:600 1rem/1 "Atkinson Hyperlegible Next",system-ui,sans-serif;cursor:pointer}
.hint{color:var(--muted)}
.dash{list-style:none;margin:0;padding:0}
.dash li{padding:4px 0}
.dash li::before{content:"– ";color:var(--muted)}
details>summary{display:none}
.phone-note{display:none}
.foot{margin-top:64px;padding-bottom:48px;color:var(--muted)}
.home ul{margin-top:24px;font:600 1.25rem/1.4 "Familjen Grotesk",system-ui,sans-serif}
@media (max-width:599px){
  .bar{padding:0 16px}
  .column{padding:0 16px}
  #zm-remix{left:16px;right:20px;bottom:88px;justify-content:center} /* above the demo's 72px legend peek */
  .phone-note{display:block}
  details>summary{display:list-item;min-height:44px;padding:10px 0;font-weight:600;cursor:pointer}
}
@media (prefers-reduced-motion:reduce){.primary{transition:none}}
`;
