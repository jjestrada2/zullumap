import maplibregl from 'maplibre-gl';
import maplibreCss from 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { JSONConverter, JSONConfiguration } from '@deck.gl/json';
import { ArcLayer, ColumnLayer, GeoJsonLayer, PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import { accessorHelpers } from '@zullumap/core/src/helpers';
import { cameraAt, type Camera } from './camera';
import { attributionNodes, mountChrome } from './chrome';
import { mountEndCard } from './endcard';
import { featuresThroughStep, inkSteps, openingMotion, INK_STEP_MS, ORBIT_MS, TILT_MS } from './motion';
import { PAYLOAD_ID, type PagePayload } from './payload';
import { prepareSpec } from './spec';
import { screenReaderSummary } from './summary';

interface Boot { ready(): void; fail(kind: 'webgl' | 'offline'): void; webgl: boolean; started: boolean }
declare global { interface Window { __zmBoot?: Boot; zullumap?: unknown } }

const PHONE = '(max-width: 599px)';
const PHONE_CHIP_STRIP = 52;
const OPEN_BEARING = -15;
const ORBIT_SWEEP = 30;
const TILT_FROM = 15;
const PAPER = '#E9E5DC';
/** `?zm-capture`: trailer recording. Camera is driven frame by frame and the overlay sits inside LinkedIn's safe zones (design D5). */
const CAPTURE = new URLSearchParams(location.search).has('zm-capture');
/** LinkedIn covers the top 8% and bottom 15% of a 4:5 video with buttons and the caption (design D5). */
const SAFE_TOP = 0.08, SAFE_BOTTOM = 0.15;

/** Default title label and legend, used when a template doesn't style its own (DESIGN.md). Low specificity on purpose. */
const OVERLAY_DEFAULT_CSS = `
:where([data-zm-region=title]){position:absolute;top:16px;left:16px;margin:0;max-width:min(560px,calc(100% - 240px));padding:12px 16px;
  background:rgba(243,240,232,.92);border:1px solid #244C91;color:#244C91;font:600 1.25rem/1.15 "Familjen Grotesk",system-ui,sans-serif}
:where([data-zm-region=legend]){position:absolute;left:24px;bottom:48px;margin:0;padding:12px 16px;list-style:none;
  background:rgba(243,240,232,.92);color:#244C91;font:0.875rem/1.4 "IBM Plex Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums}
:where([data-zm-region=legend] li){display:flex;gap:8px;align-items:center;padding:2px 0}
:where([data-zm-region=legend] i){display:inline-block;width:16px;height:12px}
:where([data-zm-region=credits],[data-zm-region=remix]){display:none}
@media (max-width:599px){:where([data-zm-region=title]){top:0;max-width:calc(100% - 32px)}}
`;

function start() {
  const boot = window.__zmBoot;
  if (boot) boot.started = true;
  if (boot && !boot.webgl) return; // the bootstrap already shows the no-WebGL message over the poster

  const payload = JSON.parse(document.getElementById(PAYLOAD_ID)!.textContent!) as PagePayload;
  const sheet = new CSSStyleSheet();
  // On phones the overlay starts below the chip's strip, so a template's top-left title never sits under the chip.
  sheet.replaceSync(maplibreCss + '#zm-map canvas:focus-visible{outline:2px solid #E74F8A;outline-offset:-2px}' +
    `#zm-overlay{top:0}@media ${PHONE}{#zm-overlay{top:${PHONE_CHIP_STRIP}px!important}}` +
    (CAPTURE ? `#zm-overlay{top:${SAFE_TOP * 100}%!important;bottom:${SAFE_BOTTOM * 100}%!important}` : ''));
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

  // Template overlay in its own shadow root: its CSS can't reach the page or zullumap's chrome.
  const overlayHost = document.createElement('div');
  overlayHost.id = 'zm-overlay';
  overlayHost.setAttribute('style', 'position:fixed!important;right:0;bottom:0;left:0;z-index:10!important;pointer-events:none');
  const overlayRoot = overlayHost.attachShadow({ mode: 'open' });
  overlayRoot.innerHTML = `<style>${OVERLAY_DEFAULT_CSS}</style>${payload.overlayHtml}`;
  const templateStyles = OVERLAY_DEFAULT_CSS + [...overlayRoot.querySelectorAll('style')].slice(1).map(s => s.textContent).join('\n');
  document.body.append(overlayHost);

  const chrome = mountChrome({ payload, overlayRoot, templateStyles });
  const phone = matchMedia(PHONE);
  if (CAPTURE) chrome.captureLayout();
  else {
    chrome.layout(phone.matches);
    phone.addEventListener('change', e => chrome.layout(e.matches));
  }
  mountSummary(payload);

  const fc = { type: 'FeatureCollection', features: payload.features };
  const motion = CAPTURE ? { print: false, camera: 'none' as const }
    : openingMotion({ loading: payload.manifest.loading, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
  const { rules } = payload.manifest;
  const pitch = payload.choices.pitch ?? rules.pitch.default ?? rules.pitch.min;
  const startPitch = motion.camera === 'tilt' ? Math.max(rules.pitch.min, pitch - TILT_FROM) : pitch;
  const startBearing = motion.camera === 'orbit' ? OPEN_BEARING - ORBIT_SWEEP : OPEN_BEARING;

  const map = new maplibregl.Map({
    container: 'zm-map',
    style: (payload.basemap ?? { version: 8, sources: {}, layers: [{ id: 'paper', type: 'background', paint: { 'background-color': PAPER } }] }) as maplibregl.StyleSpecification,
    bounds: bbox(payload.features),
    fitBoundsOptions: { padding: fitPadding(phone.matches, overlayRoot), pitch: startPitch, bearing: startBearing },
    minZoom: rules.zoom.min, maxZoom: rules.zoom.max, maxPitch: Math.max(rules.pitch.max, pitch),
    attributionControl: false,
    canvasContextAttributes: { preserveDrawingBuffer: CAPTURE },
  });
  map.getCanvas().setAttribute('aria-label', `3D map: ${payload.title}. Arrow keys pan, plus and minus zoom.`);
  map.on('webglcontextlost', () => boot?.fail('webgl'));

  const converter = new JSONConverter({
    configuration: new JSONConfiguration({
      classes: { GeoJsonLayer, PolygonLayer, ColumnLayer, ScatterplotLayer, PathLayer, ArcLayer, TextLayer },
      functions: accessorHelpers,
      convertFunction: () => { throw new Error('Expressions are not allowed in zullumap map specs'); },
    }),
  });
  const layers = (converter.convert(prepareSpec(payload.deck, fc)) as { layers: Layer[] }).layers;
  const steps = motion.print && payload.legend ? inkSteps({ classCount: payload.legend.classCount, inks: payload.manifest.inks }) : [];
  const layersAtStep = (step: number) => layers.map(l => l.clone({ data: { ...fc, features: featuresThroughStep(payload.features, payload.legend!, step) } } as never));

  let deckDraws = 0;
  const deck = new MapboxOverlay({ interleaved: true, layers: steps.length ? layersAtStep(-1) : layers, onAfterRender: () => { deckDraws++; } });
  map.addControl(deck as unknown as maplibregl.IControl);

  const api = {
    map, deck, isReady: false, motionDone: false,
    stopMotion: () => { cancelled = true; map.stop(); },
    ready: null as unknown as Promise<void>,
    /** Trailer: move the camera to time t (0..1) along the fly-through and resolve once the frame is fully drawn. */
    renderFrame: (t: number) => new Promise<void>(resolve => {
      const before = deckDraws;
      map.once('idle', () => {
        const wait = () => (deckDraws > before ? requestAnimationFrame(() => resolve()) : requestAnimationFrame(wait));
        wait();
      });
      map.jumpTo(cameraAt(t, openView, { maxPitch: map.getMaxPitch(), maxZoom: map.getMaxZoom() }));
      map.triggerRepaint();
    }),
    /** Trailer poster: hide the overlay and zullumap's chrome to save a clean opening view. */
    setDecorations: (visible: boolean) => {
      for (const id of ['zm-overlay', 'zm-chrome']) document.getElementById(id)?.style.setProperty('visibility', visible ? 'visible' : 'hidden', 'important');
    },
    showEndCard: () => endCard.show(),
  };
  const endCard = mountEndCard(payload, { safeTop: SAFE_TOP, safeBottom: SAFE_BOTTOM });
  let openView: Camera;
  let cancelled = false;
  for (const type of ['pointerdown', 'wheel', 'keydown', 'touchstart'] as const) {
    addEventListener(type, () => { if (!api.motionDone) api.stopMotion(); }, { capture: true, passive: true });
  }
  window.zullumap = api;

  api.ready = new Promise<void>(resolve => {
    map.once('load', () => {
      chrome.setCredits(credits(payload, map));
      if (CAPTURE) frameForTrailer(map, bbox(payload.features), overlayRoot);
      const c = map.getCenter();
      openView = { center: [c.lng, c.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
      map.once('idle', () => requestAnimationFrame(() => {
        boot?.ready();
        if (CAPTURE) document.getElementById('zm-poster')?.remove(); // no fade in recorded frames or the poster
        api.isReady = true;
        resolve();
        void runMotion();
      }));
    });
  });

  async function runMotion() {
    const status = document.getElementById('zm-status');
    for (const [i, s] of steps.entries()) {
      if (cancelled) break;
      if (status) status.textContent = s.message;
      deck.setProps({ layers: layersAtStep(i) });
      await sleep(INK_STEP_MS);
    }
    if (steps.length) {
      deck.setProps({ layers });
      if (status) status.textContent = '';
    }
    if (!cancelled && motion.camera === 'tilt') { map.easeTo({ pitch, duration: TILT_MS, easing: easeInOut }); await sleep(TILT_MS); }
    if (!cancelled && motion.camera === 'orbit') { map.easeTo({ bearing: OPEN_BEARING, duration: ORBIT_MS, easing: easeInOut }); await sleep(ORBIT_MS); }
    api.motionDone = true;
  }
}

/**
 * Trailer framing: fit the data either above the legend or beside it, whichever shows it bigger,
 * always below the title and inside the safe zones.
 */
function frameForTrailer(map: maplibregl.Map, bounds: [[number, number], [number, number]], overlay: ShadowRoot) {
  const rect = (r: string) => overlay.querySelector(`[data-zm-region=${r}]`)?.getBoundingClientRect();
  const title = rect('title'), legend = rect('legend');
  const top = Math.round(title?.height ? title.bottom + 16 : innerHeight * SAFE_TOP + 16);
  const safeBottom = Math.round(innerHeight * SAFE_BOTTOM + 16);
  const options = [{ top, bottom: legend?.height ? Math.round(innerHeight - legend.top + 16) : safeBottom, left: 24, right: 24 }];
  if (legend?.height) options.push({ top, bottom: safeBottom, left: Math.round(legend.right + 16), right: 24 });
  const opts = { pitch: map.getPitch(), bearing: map.getBearing() };
  const best = options
    .map(padding => map.cameraForBounds(bounds, { ...opts, padding }))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .sort((a, b) => (b.zoom ?? 0) - (a.zoom ?? 0))[0];
  if (best) map.jumpTo({ ...best, ...opts });
}

function fitPadding(phone: boolean, overlay: ShadowRoot) {
  if (CAPTURE) {
    // Frame the data between the template's title and legend, wherever the template put them.
    const title = overlay.querySelector('[data-zm-region=title]')?.getBoundingClientRect();
    const legend = overlay.querySelector('[data-zm-region=legend]')?.getBoundingClientRect();
    const top = title?.height ? title.bottom + 16 : innerHeight * SAFE_TOP + 16;
    const bottom = legend?.height ? innerHeight - legend.top + 16 : innerHeight * SAFE_BOTTOM + 16;
    return { top: Math.round(top), bottom: Math.round(bottom), left: 24, right: 24 };
  }
  return phone ? { top: 120, bottom: 96, left: 16, right: 16 } : { top: 96, bottom: 120, left: 48, right: 48 };
}

function credits(p: PagePayload, map: maplibregl.Map): Node[] {
  const parts: Node[] = [document.createTextNode(`Template ${p.manifest.id}@${p.manifest.version} by ${p.manifest.author} (${p.manifest.license})`)];
  const sources = (map.getStyle()?.sources ?? {}) as Record<string, { attribution?: string }>;
  for (const s of Object.values(sources)) {
    if (s.attribution) parts.push(document.createTextNode(' · '), ...attributionNodes(s.attribution));
  }
  parts.push(document.createTextNode(' · '), link('MapLibre', 'https://maplibre.org'), document.createTextNode(' · '), link('deck.gl', 'https://deck.gl'));
  return parts;
}

function link(text: string, href: string) {
  const a = document.createElement('a');
  a.textContent = text; a.href = href; a.target = '_blank'; a.rel = 'noopener';
  return a;
}

/** Visually hidden summary for screen readers (design D10). */
function mountSummary(p: PagePayload) {
  if (!p.legend) return;
  const s = screenReaderSummary({ title: p.title, legend: p.legend, features: p.features, mapping: p.mapping, geometry: p.manifest.geometry });
  const region = document.createElement('section');
  region.id = 'zm-summary';
  region.setAttribute('aria-label', 'Map summary');
  region.setAttribute('style', 'position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0');
  const h = document.createElement('h2');
  h.textContent = s.heading;
  region.append(h, ...s.lines.map(t => Object.assign(document.createElement('p'), { textContent: t })));
  if (s.top.length) {
    const ol = document.createElement('ol');
    ol.append(...s.top.map(t => Object.assign(document.createElement('li'), { textContent: t })));
    region.append(Object.assign(document.createElement('p'), { textContent: 'Highest values:' }), ol);
  }
  document.body.prepend(region);
}

function bbox(features: PagePayload['features']): [[number, number], [number, number]] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const visit = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      const [x, y] = c as number[];
      w = Math.min(w, x!); e = Math.max(e, x!); s = Math.min(s, y!); n = Math.max(n, y!);
    } else if (Array.isArray(c)) c.forEach(visit);
  };
  for (const f of features) visit((f.geometry as { coordinates?: unknown })?.coordinates);
  return [[w, s], [e, n]];
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

start();
