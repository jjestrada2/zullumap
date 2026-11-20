import { describe, expect, test } from 'vitest';
import { Window } from 'happy-dom';
import { buildPage, readPayload } from '../src/page';
import { compiled, manifest, mapping, overlay, LINK } from './fixture';

const assets = { bootstrap: 'window.__boot = 1;', runtime: { inline: 'window.__runtime = 1;' } };
const input = { title: 'Density in Bogotá', manifest, compiled, mapping, overlay, basemap: null, recipe: { link: LINK } };

function parse(html: string) {
  const w = new Window();
  w.document.write(html);
  return w.document;
}

describe('buildPage (T3: data, spec and recipe inlined as JSON blocks)', () => {
  test('inlines one JSON payload that the viewer reads back unchanged', () => {
    const doc = parse(buildPage(input, assets));
    const payload = readPayload(doc as unknown as Document);
    expect(payload.title).toBe('Density in Bogotá');
    expect(payload.features).toHaveLength(8);
    expect(payload.deck).toEqual(compiled.deck);
    expect(payload.recipe?.link).toBe(LINK);
  });

  test('a title containing </script cannot break out of the payload block', () => {
    const html = buildPage({ ...input, title: '</script><script>alert(1)</script>' }, assets);
    const doc = parse(html);
    expect(doc.querySelectorAll('script').length).toBe(3); // payload + bootstrap + runtime
    expect(readPayload(doc as unknown as Document).title).toBe('</script><script>alert(1)</script>');
  });

  test('renders the overlay with the title and one legend row per class, as text', () => {
    const payload = readPayload(parse(buildPage({ ...input, title: '<b>x</b>' }, assets)) as unknown as Document);
    expect(payload.overlayHtml).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(payload.overlayHtml.match(/<li>/g)).toHaveLength(4);
  });

  test('shows a title card without JavaScript: title and "Loading 3D map…"', () => {
    const doc = parse(buildPage(input, assets));
    const card = doc.querySelector('#zm-poster')!;
    expect(card.textContent).toContain('Density in Bogotá');
    expect(card.textContent).toContain('Loading 3D map…');
  });

  test('shows the poster image instead of the title card when one is given', () => {
    const poster = 'data:image/jpeg;base64,/9j/AAAA';
    const doc = parse(buildPage({ ...input, poster }, assets));
    expect(doc.querySelector('#zm-poster img')?.getAttribute('src')).toBe(poster);
  });

  test('refuses a poster that is not a small inline JPEG (≤200 KB)', () => {
    expect(() => buildPage({ ...input, poster: 'https://evil.example/p.jpg' }, assets)).toThrow(/poster/i);
    expect(() => buildPage({ ...input, poster: `data:image/jpeg;base64,${'A'.repeat(300_000)}` }, assets)).toThrow(/200 KB/);
  });

  test('loads the runtime from a pinned URL with an integrity hash when not inlined (D6)', () => {
    const html = buildPage(input, { bootstrap: '', runtime: { src: 'https://cdn.jsdelivr.net/npm/@zullumap/viewer@0.1.0/dist/runtime.js', integrity: 'sha384-abc' } });
    const s = parse(html).querySelector('script[src]')!;
    expect(s.getAttribute('integrity')).toBe('sha384-abc');
    expect(s.getAttribute('crossorigin')).toBe('anonymous');
  });

  test('uses the dark chrome variant when the template declares chrome: dark', () => {
    const doc = parse(buildPage({ ...input, manifest: { ...manifest, chrome: 'dark' } }, assets));
    expect(doc.documentElement.getAttribute('data-zm-chrome')).toBe('dark');
  });

  test('leaves out the remix link with --no-recipe', () => {
    const payload = readPayload(parse(buildPage({ ...input, recipe: null }, assets)) as unknown as Document);
    expect(payload.recipe).toBeNull();
  });
});
