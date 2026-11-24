import { remixTexts } from '@zullumap/viewer/src/remix';
import { pageState, type RulesLike } from './state';

interface Config { id: string; version: string; host: string; manifest: RulesLike & Parameters<typeof remixTexts>[0]['manifest'] }

const cfg = JSON.parse(document.getElementById('zm-template-page')!.textContent!) as Config;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const frame = $<HTMLIFrameElement>('zm-demo');
const phone = matchMedia('(max-width: 599px)');
let link = '';

/** Show the link's look in the demo and put the link into the remix steps (design D1, D3, re-review D9). */
function apply() {
  const s = pageState({ hash: location.hash, search: location.search, template: cfg, manifest: cfg.manifest, host: cfg.host });
  link = s.link;
  const src = `${frame.dataset.demo}#${s.fragment}`;
  if (frame.getAttribute('src') !== src) frame.setAttribute('src', src);
  const msg = $('zm-message');
  msg.textContent = s.messages.join(' ');
  msg.hidden = !s.messages.length;
  const t = remixTexts({ link, manifest: cfg.manifest });
  $('zm-prompt').textContent = t.prompt;
  $('zm-command').textContent = t.command;
  $('zm-community').textContent = `${t.command} --data your-data.geojson --title "Your title"`;
}

/** Copy, showing "Copied" for 2 s; if the clipboard is blocked, select the text and say how (design re-review D9). */
async function copy(text: string, button: HTMLElement, target?: HTMLElement, hint?: HTMLElement) {
  const label = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = button.id === 'zm-remix' ? 'Link copied' : 'Copied';
    setTimeout(() => { button.textContent = label; }, 2000);
  } catch {
    if (target) {
      const range = document.createRange();
      range.selectNodeContents(target);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
    }
    if (hint) hint.textContent = 'Press Ctrl/Cmd+C to copy';
  }
}

for (const b of document.querySelectorAll<HTMLButtonElement>('button[data-copy]')) {
  b.addEventListener('click', () => {
    const pre = $(b.dataset.copy!);
    void copy(pre.textContent ?? '', b, pre, b.parentElement?.querySelector<HTMLElement>('.hint') ?? undefined);
  });
}

// Phones: the first-screen button opens the share sheet with the remix link (design re-review D6);
// laptops: it jumps to the remix steps.
$('zm-remix').addEventListener('click', e => {
  if (phone.matches) {
    e.preventDefault();
    if (navigator.share) navigator.share({ title: document.title, url: link }).catch(() => { /* cancelled: do nothing */ });
    else void copy(link, $('zm-remix'));
  } else {
    // Scroll without touching the URL: its #r=… part holds the remix choices.
    e.preventDefault();
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('remix').scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    $('remix-title').focus({ preventScroll: true });
  }
});

// Phones: the remix steps start collapsed under "Remix now" (design D4).
if (phone.matches) $<HTMLDetailsElement>('remix-now').open = false;

// Scrolling the page hands gestures back to the page, so the demo map never traps scrolling (design D9).
let queued = false;
addEventListener('scroll', () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; frame.contentWindow?.postMessage({ zm: 'release' }, '*'); });
}, { passive: true });

addEventListener('hashchange', apply);
apply();
