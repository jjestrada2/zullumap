import type { PagePayload } from './payload';
import { qrSvgPath } from './qr';
import { remixTexts } from './remix';

const CSS = `
:host{all:initial}
.card{position:fixed;inset:0;display:none;flex-direction:column;justify-content:center;gap:24px;box-sizing:border-box;
  background:#E9E5DC;color:#244C91;font-family:"Atkinson Hyperlegible Next",system-ui,sans-serif}
.card.on{display:flex}
.title{margin:0;font:600 22px/1.15 "Familjen Grotesk",system-ui,sans-serif}
.row{display:flex;gap:20px;align-items:center}
.qr{flex:none;width:180px;height:180px;background:#F3F0E8;box-shadow:4px 4px 0 0 #E74F8A}
.qr path{fill:#244C91}
.url{margin:0;font:600 24px/1.2 "Familjen Grotesk",system-ui,sans-serif}
.url span{white-space:nowrap}
.chip{margin:12px 0 0;font:13px/1.2 "Atkinson Hyperlegible Next",system-ui,sans-serif}
.cta{margin:8px 0 0;font:16px/1.4 "Atkinson Hyperlegible Next",system-ui,sans-serif;color:#4F5A85}
`;

/**
 * Trailer end card (design D5): title, the short template URL as the largest text, the remix QR
 * (≥300 px wide on a 1080 px video) beside it, and the attribution chip below the URL.
 */
export function mountEndCard(p: PagePayload, safe: { safeTop: number; safeBottom: number }) {
  const host = document.createElement('div');
  host.id = 'zm-endcard';
  host.setAttribute('style', 'position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none');
  const root = host.attachShadow({ mode: 'open' });
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = `calc(${safe.safeTop * 100}% + 24px) 24px calc(${safe.safeBottom * 100}% + 24px)`;

  const title = Object.assign(document.createElement('p'), { className: 'title', textContent: p.title });
  card.append(title);
  if (p.recipe) {
    const t = remixTexts({ link: p.recipe.link, manifest: p.manifest });
    const short = t.templateUrl.replace(/^https?:\/\//, '').replace(/@\d+\.\d+\.\d+$/, '');
    const { viewBox, d } = qrSvgPath(p.recipe.link);
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'qr');
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `QR code for ${p.recipe.link}`);
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
    const text = document.createElement('div');
    text.append(
      urlWithBreaks(short),
      Object.assign(document.createElement('p'), { className: 'chip', textContent: 'made with zullumap · remix' }),
      Object.assign(document.createElement('p'), { className: 'cta', textContent: 'Scan to remix this map with your data' }),
    );
    const row = document.createElement('div');
    row.className = 'row';
    row.append(svg, text);
    card.append(row);
  } else {
    card.append(Object.assign(document.createElement('p'), { className: 'chip', textContent: 'made with zullumap' }));
  }
  root.innerHTML = `<style>${CSS}</style>`;
  root.append(card);
  document.body.append(host);
  return {
    show: () => new Promise<void>(resolve => {
      card.classList.add('on');
      void document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }),
  };
}

/** The short URL, allowed to wrap only after slashes (never at the hyphen in a template id). */
function urlWithBreaks(url: string): HTMLElement {
  const p = Object.assign(document.createElement('p'), { className: 'url' });
  url.split(/(?<=\/)/).forEach((part, i) => {
    if (i) p.append(document.createElement('wbr'));
    p.append(Object.assign(document.createElement('span'), { textContent: part }));
  });
  return p;
}
