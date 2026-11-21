import { z } from 'zod';

const range = z.object({ min: z.number(), max: z.number(), default: z.number().optional() })
  .refine(r => r.min <= r.max, { message: 'min must be <= max' })
  .refine(r => r.default === undefined || (r.default >= r.min && r.default <= r.max), { message: 'default must be within min..max' });

const slot = z.object({ type: z.enum(['number', 'string']), required: z.boolean() });

/** Single source of truth for the template manifest; types are derived from it (eng review red flag #8). */
export const manifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be kebab-case'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'version must be semver (e.g. 1.0.0)'),
  author: z.string().min(1),
  license: z.string().min(1),
  geometry: z.enum(['polygon', 'point', 'line']),
  slots: z.record(z.string(), slot),
  title: z.object({ maxLength: z.number().int().positive() }),
  rules: z.object({
    classMethods: z.array(z.enum(['quantile', 'equal', 'natural'])).min(1),
    classCount: range,
    /** Tallest feature's height as a share of the data's width (0.12 = 12%); the same look at any extent. */
    heightScale: range.optional(),
    zoom: range,
    pitch: range,
  }),
  ramp: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).min(2).optional(),
  /** Names of the ramp's inks, in print order, for "Printing the pink layer…" (ink-pass loading). */
  inks: z.array(z.string().min(1)).optional(),
  loading: z.enum(['ink-pass', 'bar']).default('bar'),
  chrome: z.enum(['light', 'dark']).default('light'),
}).superRefine((m, ctx) => {
  if (m.loading === 'ink-pass' && !m.ramp) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ramp'], message: 'ink-pass loading needs a ramp (the ink order)' });
  }
  if (m.inks && m.inks.length !== m.ramp?.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['inks'], message: 'inks must name each ramp color, in the same order' });
  }
});

export type TemplateManifest = z.infer<typeof manifestSchema>;

export interface TemplateFiles {
  manifest: unknown;
  /** Parsed deck.json. */
  deck: unknown;
  /** overlay.html source. */
  overlay: string;
}

export interface ValidationResult { ok: boolean; errors: string[] }

const SLOT_RE = /^\{\{slot:([a-zA-Z][\w-]*)\}\}$/;
const REQUIRED_REGIONS = ['title', 'legend'];

/** Static checks run by `zullumap check` and on every template load (design D3, D4; eng outside voice #5). */
export function validateTemplate(t: TemplateFiles): ValidationResult {
  const errors: string[] = [];

  const parsed = manifestSchema.safeParse(t.manifest);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(`manifest.${issue.path.join('.')}: ${issue.message}`);
  }
  const slots = parsed.success ? Object.keys(parsed.data.slots) : [];

  walkStrings(t.deck, (value, path) => {
    // Keys and values are both visited; only `@@type` (naming a registered layer class) is allowed.
    if (value.startsWith('@@') && value !== '@@type') {
      errors.push(`deck.json ${path.join('.')}: raw @@ expressions are not allowed; use a {{slot:name}} placeholder`);
    }
    const m = SLOT_RE.exec(value);
    if (m && parsed.success && !slots.includes(m[1]!)) {
      errors.push(`deck.json ${path.join('.')}: unknown slot "${m[1]}" (declared: ${slots.join(', ')})`);
    }
  });

  if (/<script\b/i.test(t.overlay)) errors.push('overlay.html: <script> tags are not allowed; put code in effects.js');
  if (/\son[a-z]+\s*=/i.test(t.overlay)) errors.push('overlay.html: inline event handlers (on...=) are not allowed');
  if (/javascript:/i.test(t.overlay)) errors.push('overlay.html: javascript: URLs are not allowed');
  for (const region of REQUIRED_REGIONS) {
    if (!new RegExp(`data-zm-region=["']${region}["']`).test(t.overlay)) {
      errors.push(`overlay.html: missing data-zm-region="${region}" marker`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function walkStrings(node: unknown, visit: (value: string, path: (string | number)[]) => void, path: (string | number)[] = []): void {
  if (typeof node === 'string') visit(node, path);
  else if (Array.isArray(node)) node.forEach((v, i) => walkStrings(v, visit, [...path, i]));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      visit(k, [...path, k]);
      walkStrings(v, visit, [...path, k]);
    }
  }
}
