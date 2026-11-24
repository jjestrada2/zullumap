import { z } from 'zod';
import type { ClassMethod } from './classify';

/** Major version of core's classification formulas; bump only when results would change (design D13). */
export const CORE_MAJOR = 0;
/** QR code budget: version 6 at error-correction level M (design D12). */
export const MAX_LINK_LENGTH = 100;

export interface RecipeChoices { method?: ClassMethod; classCount?: number; heightScale?: number; pitch?: number }
export interface TemplateRef { id: string; version: string }

const METHOD_CODE: Record<ClassMethod, string> = { quantile: 'q', equal: 'e', natural: 'n' };
const CODE_METHOD = Object.fromEntries(Object.entries(METHOD_CODE).map(([k, v]) => [v, k])) as Record<string, ClassMethod>;
const FRAGMENT_RE = /^(\d+)((?:;[mchp][a-z0-9.]+)*)$/;
const TEMPLATE_RE = /\/t\/([a-z0-9]+(?:-[a-z0-9]+)*)@(\d+\.\d+\.\d+)$/;

/**
 * Build the short remix link printed as a QR code: `<host>/t/<id>@<version>#r=<coreMajor>;<choices>`.
 * Only choices that differ from the template defaults are stored; the title and column names never are.
 */
export function encodeRecipeLink(args: {
  host: string; template: TemplateRef; choices: RecipeChoices; defaults: RecipeChoices; coreMajor?: number;
}): string {
  const { host, template, choices, defaults } = args;
  const parts = [String(args.coreMajor ?? CORE_MAJOR)];
  if (choices.method && choices.method !== defaults.method) parts.push(`m${METHOD_CODE[choices.method]}`);
  if (choices.classCount !== undefined && choices.classCount !== defaults.classCount) parts.push(`c${choices.classCount}`);
  if (choices.heightScale !== undefined && choices.heightScale !== defaults.heightScale) parts.push(`h${choices.heightScale}`);
  if (choices.pitch !== undefined && choices.pitch !== defaults.pitch) parts.push(`p${choices.pitch}`);
  const link = `${host.replace(/\/$/, '')}/t/${template.id}@${template.version}#r=${parts.join(';')}`;
  if (link.length > MAX_LINK_LENGTH) {
    throw new Error(`Remix link is ${link.length} characters; the QR code allows at most ${MAX_LINK_LENGTH}`);
  }
  return link;
}

/** Parse a remix link locally (no network). Only links on accepted gallery hosts are allowed. */
export function decodeRecipeLink(link: string, opts: { acceptedHosts: string[] }): {
  template: TemplateRef; choices: RecipeChoices; coreMajor: number; warnings: string[];
} {
  const [base = '', fragment = ''] = link.split('#');
  const host = opts.acceptedHosts.map(h => h.replace(/\/$/, '')).find(h => base.startsWith(`${h}/t/`));
  const t = TEMPLATE_RE.exec(base);
  if (!host || !t) {
    throw new Error('Unsupported input: pass a zullumap map page, a recipe link or a map page URL');
  }
  const m = FRAGMENT_RE.exec(fragment.replace(/^r=/, ''));
  if (!fragment.startsWith('r=') || !m) {
    throw new Error("This remix link is damaged; showing the template's default look instead");
  }
  const coreMajor = Number(m[1]);
  const choices: RecipeChoices = {};
  for (const part of m[2]!.split(';').filter(Boolean)) {
    const key = part[0], val = part.slice(1);
    if (key === 'm') {
      const method = CODE_METHOD[val];
      if (!method) throw new Error('This remix link is damaged (unknown method)');
      choices.method = method;
    } else if (key === 'c') choices.classCount = Number(val);
    else if (key === 'h') choices.heightScale = Number(val);
    else if (key === 'p') choices.pitch = Number(val);
  }
  const warnings = coreMajor === CORE_MAJOR ? [] : [
    `This link was made with zullumap core version ${coreMajor}.x; you have ${CORE_MAJOR}.x, so class breaks may differ slightly`,
  ];
  return { template: { id: t[1]!, version: t[2]! }, choices, coreMajor, warnings };
}

/** recipe.json written next to every map page (design: "recipe.json and privacy"). Never holds file paths. */
export const recipeFileSchema = z.object({
  template: z.object({ id: z.string(), version: z.string(), author: z.string().optional(), license: z.string().optional() }),
  coreMajor: z.number().int().nonnegative(),
  choices: z.object({
    method: z.enum(['quantile', 'equal', 'natural']), classCount: z.number().int().positive(),
    heightScale: z.number().optional(), pitch: z.number().optional(),
  }),
  mapping: z.record(z.string(), z.string()),
  title: z.string(),
  link: z.string().optional(),
  basemapAttribution: z.array(z.string()).optional(),
});
export type RecipeFile = z.infer<typeof recipeFileSchema>;
