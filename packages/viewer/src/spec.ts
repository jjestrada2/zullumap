/** Layer classes a template's deck.json may name with `@@type`. */
export const LAYER_TYPES = ['GeoJsonLayer', 'PolygonLayer', 'ColumnLayer', 'ScatterplotLayer', 'PathLayer', 'ArcLayer', 'TextLayer'] as const;
/** Named accessor helpers from core (eng review D14); nothing else may be called. */
export const HELPER_NAMES = ['zmClassColor', 'zmHeight'] as const;

type Spec = { layers: Record<string, unknown>[] } & Record<string, unknown>;

/**
 * Check a compiled deck spec before it reaches deck.gl's JSON converter, which would otherwise
 * compile `@@=` strings into code, and give layers without their own data the map's features.
 */
export function prepareSpec(deck: unknown, features: unknown): Spec {
  walk(deck, []);
  const spec = structuredClone(deck) as Spec;
  if (!Array.isArray(spec?.layers)) throw new Error('The map spec has no layers');
  spec.layers = spec.layers.map(l => ('data' in l ? l : { ...l, data: features }));
  return spec;
}

function walk(node: unknown, path: string[]): void {
  if (typeof node === 'string') {
    if (node.startsWith('@@')) throw new Error(`${path.join('.')}: "${node.slice(0, 20)}" is not allowed in a map spec`);
    return;
  }
  if (Array.isArray(node)) return node.forEach((v, i) => walk(v, [...path, String(i)]));
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    const here = [...path, k];
    if (k === '@@type') {
      if (!(LAYER_TYPES as readonly unknown[]).includes(v)) throw new Error(`${here.join('.')}: layer type ${String(v)} is not allowed`);
    } else if (k === '@@function') {
      if (!(HELPER_NAMES as readonly unknown[]).includes(v)) throw new Error(`${here.join('.')}: function ${String(v)} is not allowed`);
    } else if (k.startsWith('@@')) {
      throw new Error(`${here.join('.')}: key ${k} is not allowed in a map spec`);
    } else {
      walk(v, here);
    }
  }
}
