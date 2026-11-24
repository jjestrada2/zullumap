import { z } from 'zod';
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
