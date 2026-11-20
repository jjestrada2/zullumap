import type { RGB } from './helpers';

/** Values an overlay can show. Every value is inserted as text, never HTML (eng review outside voice). */
export interface OverlayValues {
  title: string;
  legend?: LegendRow[];
  noData?: { label: string; color: string };
  height?: { low: string; high: string };
}
export interface LegendRow { color: string; label: string; from: number; to: number }

const SECTION_RE = /\{\{#([a-zA-Z]\w*)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
const VAR_RE = /\{\{([a-zA-Z]\w*)\}\}/g;
const ANY_RE = /\{\{[#/]?([a-zA-Z]\w*)\}\}/g;

/**
 * Fill an overlay.html template: `{{name}}` interpolates text; `{{#name}}…{{/name}}` repeats once per
 * row for arrays (the legend), renders once for objects and is dropped when the value is missing.
 */
export function renderOverlay(source: string, values: OverlayValues): string {
  const scope = values as unknown as Record<string, unknown>;
  const withSections = source.replace(SECTION_RE, (_, name: string, body: string) => {
    const v = scope[name];
    if (v === undefined || v === null || v === false) return '';
    const rows = Array.isArray(v) ? v : [v];
    return rows.map(row => fill(body, { ...scope, ...(row as Record<string, unknown>) })).join('');
  });
  return fill(withSections, scope);
}

function fill(s: string, scope: Record<string, unknown>): string {
  return s.replace(VAR_RE, (_, name: string) => {
    const v = scope[name];
    return v === undefined || v === null || typeof v === 'object' ? '' : escapeHtml(String(v));
  });
}

/** Every placeholder name a template uses, in order of first appearance. */
export function overlayPlaceholders(source: string): string[] {
  return [...new Set([...source.matchAll(ANY_RE)].map(m => m[1]!))];
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const formatNumber = (n: number) => NUMBER.format(n);

/** One legend row per class, labelled with its value range from the data minimum to the maximum. */
export function legendRows(legend: { breaks: number[]; colors: RGB[]; min: number; max: number }): LegendRow[] {
  const edges = [legend.min, ...legend.breaks, legend.max];
  return legend.colors.map((c, i) => ({
    color: rgbCss(c), from: edges[i]!, to: edges[i + 1]!,
    label: `${formatNumber(edges[i]!)}–${formatNumber(edges[i + 1]!)}`,
  }));
}

export const rgbCss = (c: RGB) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
