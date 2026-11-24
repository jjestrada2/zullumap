import type { CompileResult, Legend, TemplateManifest } from '@zullumap/core';

/** Everything a map page needs, inlined as one JSON block (eng review D5). */
export interface PagePayload {
  title: string;
  manifest: Pick<TemplateManifest, 'id' | 'version' | 'author' | 'license' | 'geometry' | 'slots' | 'rules' | 'loading' | 'chrome' | 'inks' | 'ramp'>;
  deck: CompileResult['deck'];
  features: CompileResult['features'];
  legend: Legend | null;
  choices: CompileResult['choices'];
  /** slot → data column. */
  mapping: Record<string, string>;
  /** overlay.html with placeholders filled (text-only). */
  overlayHtml: string;
  /** MapLibre style, or null for `basemap: none` (paper background only). */
  basemap: Record<string, unknown> | null;
  /** Remix link; null with --no-recipe. */
  recipe: { link: string } | null;
  /** Live demo embedded in a template page: no chip or remix button, and the map waits for a tap (design D9). */
  demo?: boolean;
}

export const PAYLOAD_ID = 'zm-page';
