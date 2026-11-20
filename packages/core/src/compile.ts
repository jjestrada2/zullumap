import { classify, type ClassMethod } from './classify';
import { prepareData } from './data';
import { resampleRamp, type RGB } from './helpers';
import { manifestSchema, validateTemplate, type TemplateManifest } from './template';

const COLOR_PROPS = new Set(['getFillColor', 'getLineColor', 'getColor', 'getSourceColor', 'getTargetColor']);
const NUMBER_PROPS = new Set(['getElevation', 'getRadius', 'getWidth', 'getHeight']);
const SLOT_RE = /^\{\{slot:([a-zA-Z][\w-]*)\}\}$/;
const DEFAULT_RAMP = ['#2499A6', '#F49AA8', '#E95E5A', '#E9B24F'];

export interface CompileInput {
  manifest: unknown;
  deck: unknown;
  /** Parsed GeoJSON FeatureCollection. */
  data: unknown;
  /** slot name → data column. */
  mapping: Record<string, string>;
  /** Overrides; each must respect the template's rules. */
  options?: { method?: ClassMethod; classCount?: number; heightScale?: number; pitch?: number };
  /** overlay.html, validated along with the rest of the template when given. */
  overlay?: string;
}

export interface Legend {
  slot: string; breaks: number[]; classCount: number; colors: RGB[];
  /** Data range of the value slot, for the first and last legend labels. */
  min: number; max: number;
  /** Some features have no value: the legend shows a "no data" swatch (design D11). */
  hasNoData: boolean;
  /** Height key, when a height slot is mapped (design D11). */
  height?: { slot: string; low: number; high: number };
}

export interface Choices { method: ClassMethod; classCount: number; heightScale?: number; pitch?: number }

export interface CompileResult {
  deck: { layers: unknown[] } & Record<string, unknown>;
  features: { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown }[];
  legend: Legend | null;
  choices: Choices;
  warnings: string[];
}

/** Template + data + choices → resolved deck.gl JSON spec referencing named accessor helpers (D4, D14). */
export function compile(input: CompileInput): CompileResult {
  const check = validateTemplate({ manifest: input.manifest, deck: input.deck, overlay: input.overlay ?? '<div data-zm-region="title"></div><div data-zm-region="legend"></div>' });
  if (!check.ok) throw new Error(`Invalid template:\n- ${check.errors.join('\n- ')}`);
  const m = manifestSchema.parse(input.manifest);
  const choices = resolveChoices(m, input.options ?? {});

  for (const [slot, def] of Object.entries(m.slots)) {
    if (def.required && !input.mapping[slot]) throw new Error(`The ${slot} slot is required; map it to a data column`);
  }

  // Which slots feed which kind of prop decides validation (heights can't be negative).
  const usage = slotUsage(input.deck);
  const numeric = Object.keys(input.mapping)
    .filter(s => m.slots[s]?.type === 'number')
    .map(s => ({ slot: s, column: input.mapping[s]!, nonNegative: usage.number.has(s) }));
  const prepared = prepareData(input.data, { geometry: m.geometry, numeric });

  const features = prepared.features.map((f, i) => ({
    type: 'Feature' as const,
    geometry: f.geometry,
    properties: { ...(f.properties ?? {}), __zm: Object.fromEntries(numeric.map(n => [n.slot, prepared.values[n.slot]![i] ?? null])) },
  }));

  let legend: CompileResult['legend'] = null;
  let heightKey: Legend['height'];
  const deck = mapStrings(structuredClone(input.deck), (value, key) => {
    const slot = SLOT_RE.exec(value)?.[1];
    if (!slot) return value;
    if (!input.mapping[slot]) return undefined; // optional slot not mapped: drop the prop
    const vals = (prepared.values[slot] ?? []).filter((v): v is number => v !== null);
    if (COLOR_PROPS.has(key)) {
      const c = classify(vals, choices.method, choices.classCount);
      const colors = resampleRamp(m.ramp ?? DEFAULT_RAMP, c.classCount);
      const all = prepared.values[slot] ?? [];
      legend ??= { slot, breaks: c.breaks, classCount: c.classCount, colors, min: Math.min(...vals), max: Math.max(...vals), hasNoData: all.some(v => v === null) };
      return { '@@function': 'zmClassColor', slot, breaks: c.breaks, colors };
    }
    if (NUMBER_PROPS.has(key)) {
      heightKey ??= { slot, low: Math.min(...vals), high: Math.max(...vals) };
      return { '@@function': 'zmHeight', slot, max: Math.max(...vals), scale: choices.heightScale ?? 1 };
    }
    throw new Error(`Slot "${slot}" is used in ${key}, which zullumap can't drive from data yet`);
  }) as CompileResult['deck'];

  // `legend` is assigned inside the callback above, which TypeScript's narrowing can't see.
  const resolved = legend as CompileResult['legend'];
  if (resolved && heightKey) resolved.height = heightKey;
  if (resolved && resolved.classCount < choices.classCount) {
    prepared.warnings.push(`Only ${resolved.classCount} classes were possible (requested ${choices.classCount})`);
  }
  return { deck, features, legend, choices, warnings: prepared.warnings };
}

function resolveChoices(m: TemplateManifest, o: NonNullable<CompileInput['options']>): Choices {
  const r = m.rules;
  const method = o.method ?? r.classMethods[0]!;
  if (!r.classMethods.includes(method)) {
    throw new Error(`method "${method}" is not allowed by this template (allowed: ${r.classMethods.join(', ')})`);
  }
  const classCount = inRange('classCount', o.classCount ?? r.classCount.default ?? r.classCount.min, r.classCount);
  const choices: Choices = { method, classCount };
  if (r.heightScale) choices.heightScale = inRange('heightScale', o.heightScale ?? r.heightScale.default ?? r.heightScale.max, r.heightScale);
  choices.pitch = inRange('pitch', o.pitch ?? r.pitch.default ?? r.pitch.min, r.pitch);
  return choices;
}

function inRange(name: string, v: number, r: { min: number; max: number }): number {
  if (v < r.min || v > r.max) throw new Error(`${name} ${v} is outside this template's allowed range ${r.min}–${r.max}`);
  return v;
}

function slotUsage(deck: unknown) {
  const number = new Set<string>();
  mapStrings(structuredClone(deck), (value, key) => {
    const slot = SLOT_RE.exec(value)?.[1];
    if (slot && NUMBER_PROPS.has(key)) number.add(slot);
    return value;
  });
  return { number };
}

/** Rebuild a JSON tree, replacing string values; returning undefined drops the property. */
function mapStrings(node: unknown, fn: (value: string, key: string) => unknown, key = ''): unknown {
  if (typeof node === 'string') return fn(node, key);
  if (Array.isArray(node)) return node.map(v => mapStrings(v, fn, key));
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      const nv = mapStrings(v, fn, k);
      if (nv !== undefined) out[k] = nv;
    }
    return out;
  }
  return node;
}
