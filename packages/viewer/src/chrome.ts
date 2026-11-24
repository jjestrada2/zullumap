import type { PagePayload } from './payload';
import { remixTexts } from './remix';

/**
 * zullumap's own map-page parts (design re-review D5): attribution chip, credits line, "Remix this map"
 * button, phone bottom sheet and remix panel. They live in their own shadow root, drawn after the
 * template overlay, so template CSS can't restyle, hide or cover them (design D6, DT6).
 */

const PHONE_MAX = 599;

const CHROME_CSS = `
:host{--ink:#244C91;--ink-pressed:#173B78;--on-ink:#F3F0E8;--sheet:#F3F0E8;--panel:rgba(243,240,232,.92);--fg:#244C91;--muted:#4F5A85;
  --overprint:#E74F8A;--body:"Atkinson Hyperlegible Next",system-ui,sans-serif;--display:"Familjen Grotesk",system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,monospace}
:host([data-chrome=dark]){--sheet:#1C2233;--panel:rgba(28,34,51,.92);--fg:#F3F0E8;--muted:#C9CCD8}
*{box-sizing:border-box}
.chip,.primary,.sheet,.panel,.credits{pointer-events:auto}
.chip{position:absolute;top:16px;right:16px;padding:6px 10px;background:var(--panel);color:var(--fg);font:13px/1.2 var(--body);text-decoration:none}
a.chip::after{content:"";position:absolute;inset:-8px}
@media (hover:hover){a.chip:hover{text-decoration:underline}}
a:focus-visible,button:focus-visible{outline:2px solid var(--overprint);outline-offset:2px}
.primary{height:48px;padding:0 24px;border:0;border-radius:0;background:var(--ink);color:var(--on-ink);font:600 1rem/1 var(--body);cursor:pointer;
  box-shadow:4px 4px 0 0 var(--overprint);transition:box-shadow 120ms ease-out,transform 120ms ease-out,background-color 120ms ease-out}
.primary:active{background:var(--ink-pressed);box-shadow:0 0 0 0 var(--overprint);transform:translate(4px,4px)}
@media (hover:hover){.primary:hover{background:var(--ink-pressed);box-shadow:0 0 0 0 var(--overprint);transform:translate(4px,4px)}}
.desktop-remix{position:absolute;right:28px;bottom:28px}
.credits{position:absolute;left:24px;bottom:4px;max-width:calc(100% - 280px);margin:0;padding:2px 6px;background:var(--panel);color:var(--muted);font:12px/1.4 var(--body)}
.credits a{color:inherit}
.credits.capture{bottom:calc(15% + 8px);left:16px;max-width:calc(100% - 32px);font-size:10px}
.sheet{position:absolute;left:0;right:0;bottom:0;padding:0 16px 16px;background:var(--sheet);color:var(--fg);border-radius:2px 2px 0 0;
  transform:translateY(calc(100% - 72px));transition:transform 600ms ease-out;max-height:80vh;overflow:auto}
.sheet.open{transform:none}
.grab{display:block;width:100%;height:44px;margin:0;padding:0;border:0;background:none;cursor:pointer}
.grab span{display:block;width:32px;height:4px;margin:0 auto;background:var(--ink);opacity:.4}
:host([data-chrome=dark]) .grab span{background:var(--fg)}
.sheet .credits{position:static;max-width:none;margin:16px 0 0;padding:0;background:none}
.sheet .primary{display:block;width:calc(100% - 4px);margin-top:24px}
.panel{position:absolute;top:0;right:0;bottom:0;width:min(400px,100%);padding:24px;overflow:auto;background:var(--sheet);color:var(--fg);border-left:1px solid var(--ink);font:1rem/1.5 var(--body)}
.panel[hidden]{display:none}
.panel h2{margin:0 0 16px;font:600 1.25rem/1.15 var(--display)}
.panel h3{margin:24px 0 8px;font:600 1rem/1.3 var(--body)}
.panel pre{margin:0 0 8px;padding:12px;white-space:pre-wrap;word-break:break-all;background:var(--panel);border:1px solid var(--ink);font:0.875rem/1.5 var(--mono)}
.panel p{margin:8px 0}
.panel a{color:var(--fg);font-weight:600}
.explore{position:absolute;left:50%;bottom:88px;transform:translateX(-50%);min-height:44px;padding:0 16px;border:0;border-radius:0;
  background:var(--panel);color:var(--fg);font:600 1rem/1 var(--body);cursor:pointer;pointer-events:auto}
.explore[hidden]{display:none}
.copy{min-height:44px;padding:0 16px;border:1px solid var(--ink);border-radius:0;background:none;color:var(--fg);font:600 1rem/1 var(--body);cursor:pointer}
.note{color:var(--muted)}
.close{position:absolute;top:12px;right:12px;min-width:44px;min-height:44px;border:0;background:none;color:var(--fg);font:600 1rem/1 var(--body);cursor:pointer}
.panel .primary{width:calc(100% - 4px);margin-bottom:8px}
@media (max-width:${PHONE_MAX}px){
  .explore{bottom:160px} /* above the template page's Remix button */
  .panel{top:auto;left:0;width:auto;max-height:85vh;border-left:0;border-top:1px solid var(--ink);border-radius:2px 2px 0 0;padding:24px 16px}
}
@media (prefers-reduced-motion:reduce){.sheet,.primary{transition:none}}
`;

/** Positioning reset applied to template regions moved into the bottom sheet. */
const SHEET_REGION_CSS = `[data-zm-region]{position:static!important;inset:auto!important;transform:none!important;margin:0!important;padding:0!important;background:none!important;width:auto!important;max-width:none!important}`;

export interface Chrome {
  /** Move template regions between the map (desktop) and the bottom sheet (phones). */
  layout(phone: boolean): void;
  /** Trailer layout: only the credits line, just above LinkedIn's bottom safe zone (design D5). The chip is on the end card. */
  captureLayout(): void;
  setCredits(nodes: Node[]): void;
  /** Demo maps embedded in a page: show or hide the "Tap to explore" hint (design D9). */
  setExploreHint(text: string | null, onActivate: () => void): void;
}

export function mountChrome(args: {
  payload: PagePayload;
  /** The template overlay's shadow root, whose legend moves into the sheet on phones. */
  overlayRoot: ShadowRoot;
  /** Template CSS, re-applied to the legend while it sits in the sheet. */
  templateStyles: string;
}): Chrome {
  const { payload, overlayRoot } = args;
  const host = document.createElement('div');
  host.id = 'zm-chrome';
  host.dataset.chrome = payload.manifest.chrome;
  host.setAttribute('style', 'position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;visibility:visible!important;opacity:1!important;transform:none!important;filter:none!important');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CHROME_CSS}</style>`;

  const texts = payload.recipe ? remixTexts({ link: payload.recipe.link, manifest: payload.manifest }) : null;

  // Attribution chip (design D6).
  const chip = el(texts ? 'a' : 'span', 'chip', texts ? 'made with zullumap · remix' : 'made with zullumap');
  if (texts && chip instanceof HTMLAnchorElement) { chip.href = texts.templateUrl; chip.target = '_blank'; chip.rel = 'noopener'; }
  if (!payload.demo) root.append(chip);

  const credits = el('p', 'credits');
  const desktopRemix = texts ? button('primary desktop-remix', 'Remix this map') : null;

  // Phone bottom sheet (design D2): grab bar, legend (in a nested shadow root keeping the template's styles), credits, button.
  const sheet = el('section', 'sheet');
  sheet.setAttribute('role', 'region');
  sheet.setAttribute('aria-label', 'Map legend and remix');
  const grab = button('grab', '');
  grab.setAttribute('aria-label', 'Show legend');
  grab.setAttribute('aria-expanded', 'false');
  grab.append(el('span'));
  grab.addEventListener('click', () => {
    const open = sheet.classList.toggle('open');
    grab.setAttribute('aria-expanded', String(open));
  });
  const legendHost = el('div');
  const legendRoot = legendHost.attachShadow({ mode: 'open' });
  legendRoot.innerHTML = `<style>${args.templateStyles}</style><style>${SHEET_REGION_CSS}</style>`;
  const sheetRemix = texts ? button('primary', 'Remix this map') : null;
  sheet.append(grab, legendHost);

  const panel = texts ? remixPanel(texts, payload.title) : null;
  let opener: HTMLElement | null = null;
  const openPanel = (from: HTMLElement) => {
    if (!panel) return;
    opener = from;
    panel.hidden = false;
    panel.querySelector<HTMLElement>('h2')?.focus();
  };
  const closePanel = () => {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    opener?.focus();
  };
  desktopRemix?.addEventListener('click', () => openPanel(desktopRemix));
  sheetRemix?.addEventListener('click', () => openPanel(sheetRemix));
  panel?.querySelector('.close')?.addEventListener('click', closePanel);
  addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });

  const hint = button('explore', '');
  hint.hidden = true;

  document.body.append(host);

  const legend = () => overlayRoot.querySelector('[data-zm-region=legend]') ?? legendRoot.querySelector('[data-zm-region=legend]');
  let phoneNow: boolean | null = null;

  return {
    layout(phone) {
      if (phone === phoneNow) return;
      phoneNow = phone;
      const lg = legend();
      for (const n of [chip, credits, sheet, desktopRemix, panel]) n?.remove();
      const chips = payload.demo ? [] : [chip];
      if (phone) {
        if (lg) legendRoot.append(lg);
        sheet.append(credits);
        if (sheetRemix) sheet.append(sheetRemix);
        root.append(...chips, sheet);
      } else {
        if (lg) overlayRoot.append(lg);
        root.append(...chips, credits);
        if (desktopRemix) root.append(desktopRemix);
      }
      if (panel) root.append(panel);
    },
    captureLayout() {
      for (const n of [chip, sheet, desktopRemix, panel]) n?.remove();
      credits.classList.add('capture');
      root.append(credits);
    },
    setExploreHint(text, onActivate) {
      hint.textContent = text ?? '';
      hint.hidden = !text;
      hint.onclick = text ? () => onActivate() : null;
      if (text && !hint.isConnected) root.append(hint);
    },
    setCredits(nodes) {
      credits.replaceChildren(...nodes);
    },
  };
}

function remixPanel(t: ReturnType<typeof remixTexts>, title: string): HTMLElement {
  const panel = el('div', 'panel');
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'zm-remix-title');
  const h2 = el('h2', '', 'Remix this map');
  h2.id = 'zm-remix-title';
  h2.tabIndex = -1;
  const close = button('close', 'Close');

  const phone = matchMedia(`(max-width:${PHONE_MAX}px)`).matches;
  const parts: Node[] = [h2, close];
  if (phone) {
    const share = button('primary', 'Remix on my laptop');
    share.addEventListener('click', async () => {
      if (navigator.share) {
        try { await navigator.share({ title, url: t.link }); } catch { /* cancelled: do nothing (design re-review D9) */ }
      } else {
        await copy(t.link, share, null);
      }
    });
    parts.push(share, el('p', 'note', 'Love this look? Send the link to your laptop and remix it there.'));
  }
  parts.push(
    el('h3', '', 'Ask your agent'), ...copyBlock(t.prompt),
    el('h3', '', 'Or run it yourself'), ...copyBlock(t.command),
    el('h3', '', 'What your data needs'), el('p', '', t.dataNeeds),
  );
  const see = el('a', '', 'See the template →') as HTMLAnchorElement;
  see.href = t.templateUrl; see.target = '_blank'; see.rel = 'noopener';
  parts.push(el('p', '', '', [see]));
  panel.append(...parts);
  return panel;
}

function copyBlock(text: string): Node[] {
  const pre = el('pre', '', text);
  const b = button('copy', 'Copy');
  const hint = el('p', 'note');
  b.addEventListener('click', () => copy(text, b, { pre, hint }));
  return [pre, b, hint];
}

/** Copy, showing "Copied" for 2 s; if the clipboard is blocked, select the text and say how (design re-review D9). */
async function copy(text: string, b: HTMLButtonElement, fallback: { pre: HTMLElement; hint: HTMLElement } | null) {
  const label = b.textContent;
  try {
    await navigator.clipboard.writeText(text);
    b.textContent = 'Copied';
    setTimeout(() => { b.textContent = label; }, 2000);
  } catch {
    if (fallback) {
      const range = document.createRange();
      range.selectNodeContents(fallback.pre);
      const sel = getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      fallback.hint.textContent = 'Press Ctrl/Cmd+C to copy';
    }
  }
}

function el(tag: string, cls = '', text = '', children: Node[] = []): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  e.append(...children);
  return e;
}

function button(cls: string, text: string): HTMLButtonElement {
  const b = el('button', cls, text) as HTMLButtonElement;
  b.type = 'button';
  return b;
}

/** Keep only text and plain http(s) links from a basemap attribution string. */
export function attributionNodes(html: string): Node[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out: Node[] = [];
  const visit = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) out.push(document.createTextNode(n.textContent ?? ''));
    else if (n instanceof HTMLAnchorElement && /^https?:/i.test(n.getAttribute('href') ?? '')) {
      const a = document.createElement('a');
      a.href = n.getAttribute('href')!; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = n.textContent;
      out.push(a);
    } else n.childNodes.forEach(visit);
  };
  doc.body.childNodes.forEach(visit);
  return out;
}
