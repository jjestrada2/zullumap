import { decodeRecipeFragment, type RecipeChoices, type TemplateRef } from '@zullumap/core/src/recipe';

type Range = { min: number; max: number };
export interface RulesLike {
  rules: { classMethods: ('quantile' | 'equal' | 'natural')[]; classCount: Range; heightScale?: Range; pitch: Range };
}

const DAMAGED = "This remix link is damaged — here's the template's default look";
const MISSING = 'This version is gone — showing the newest';

/** What a template page shows for its URL: the link's choices, or the default look with a message (design D3, re-review D9). */
export function pageState(a: { hash: string; search: string; template: TemplateRef; manifest: RulesLike; host: string }) {
  const messages: string[] = [];
  if (new URLSearchParams(a.search).has('missing')) messages.push(MISSING);
  let choices: RecipeChoices = {};
  let fragment = 'r=0';
  if (a.hash.replace(/^#/, '')) {
    try {
      const d = decodeRecipeFragment(a.hash);
      if (!allowed(d.choices, a.manifest)) throw new Error('outside the template rules');
      choices = d.choices;
      fragment = a.hash.replace(/^#/, '');
    } catch {
      messages.push(DAMAGED);
    }
  }
  return { choices, fragment, link: `${a.host}/t/${a.template.id}@${a.template.version}#${fragment}`, messages };
}

function allowed(c: RecipeChoices, m: RulesLike): boolean {
  const r = m.rules;
  const within = (v: number | undefined, range: Range | undefined) => v === undefined || (range !== undefined && v >= range.min && v <= range.max);
  return (c.method === undefined || r.classMethods.includes(c.method))
    && within(c.classCount, r.classCount) && within(c.heightScale, r.heightScale) && within(c.pitch, r.pitch);
}
