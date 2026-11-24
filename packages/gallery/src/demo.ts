import { compile, decodeRecipeFragment, type CompileResult } from '@zullumap/core';
import { makePayload } from '@zullumap/viewer/src/page';

interface DemoTemplate {
  manifest: unknown; deck: unknown; overlay: string; basemap: Record<string, unknown> | null;
  title: string; mapping: Record<string, string>; data: unknown;
}

// Runs inside the template page's demo frame, before the viewer runtime: compile the preview data with the
// link's choices (falling back to the template's defaults) and hand the result to the viewer as its payload.
const t = (window as unknown as { __zmTemplate: DemoTemplate }).__zmTemplate;
const base = { manifest: t.manifest, deck: t.deck, data: t.data, mapping: t.mapping, overlay: t.overlay };
let compiled: CompileResult;
try {
  compiled = compile({ ...base, options: decodeRecipeFragment(location.hash).choices });
} catch {
  compiled = compile(base); // damaged or disallowed link: the template page explains; the demo shows the default look
}
const payload = makePayload({ title: t.title, manifest: t.manifest, compiled, mapping: t.mapping, overlay: t.overlay, basemap: t.basemap, recipe: null }, { demo: true });
const block = document.createElement('script');
block.type = 'application/json';
block.id = 'zm-page';
block.textContent = JSON.stringify(payload);
document.body.append(block);
addEventListener('hashchange', () => location.reload());
