import { describe, expect, test } from 'vitest';
import { encodeRecipeLink, decodeRecipeLink, CORE_MAJOR } from '../src/recipe';

const GALLERY = 'https://jjestrada2.github.io/zullumap';
const defaults = { method: 'quantile', classCount: 5, heightScale: 3000, pitch: 50 } as const;
const template = { id: 'risograph-choropleth', version: '1.0.0' };

describe('recipe link', () => {
  test('round-trips the template and every choice that differs from the defaults', () => {
    const choices = { method: 'natural', classCount: 4, heightScale: 3000, pitch: 60 } as const;
    const link = encodeRecipeLink({ host: GALLERY, template, choices, defaults });
    const back = decodeRecipeLink(link, { acceptedHosts: [GALLERY] });
    expect(back.template).toEqual(template);
    expect(back.choices).toEqual({ method: 'natural', classCount: 4, pitch: 60 });
    expect(back.coreMajor).toBe(CORE_MAJOR);
  });

  test('stores only non-default choices, so a default map gets the shortest link', () => {
    const link = encodeRecipeLink({ host: GALLERY, template, choices: defaults, defaults });
    expect(decodeRecipeLink(link, { acceptedHosts: [GALLERY] }).choices).toEqual({});
  });

  test('stays within the 100-character QR budget (design D12)', () => {
    const choices = { method: 'natural', classCount: 7, heightScale: 4999, pitch: 69 } as const;
    const link = encodeRecipeLink({ host: GALLERY, template: { id: 'risograph-choropleth', version: '12.10.3' }, choices, defaults });
    expect(link.length).toBeLessThanOrEqual(100);
  });

  test('refuses to encode a link longer than 100 characters', () => {
    const long = { id: 'a-very-long-template-name-that-keeps-going-and-going-forever-and-ever', version: '1.0.0' };
    expect(() => encodeRecipeLink({ host: GALLERY, template: long, choices: defaults, defaults })).toThrow(/100/);
  });

  test('rejects links from hosts that are not accepted', () => {
    const link = encodeRecipeLink({ host: GALLERY, template, choices: defaults, defaults });
    expect(() => decodeRecipeLink(link.replace('jjestrada2.github.io', 'evil.example'), { acceptedHosts: [GALLERY] })).toThrow(/unsupported/i);
  });

  test('accepts a legacy gallery host listed in acceptedHosts', () => {
    const link = encodeRecipeLink({ host: GALLERY, template, choices: defaults, defaults });
    expect(decodeRecipeLink(link, { acceptedHosts: ['https://zullumap.dev', GALLERY] }).template.id).toBe(template.id);
  });

  test('reports a damaged recipe fragment clearly', () => {
    const link = encodeRecipeLink({ host: GALLERY, template, choices: defaults, defaults });
    expect(() => decodeRecipeLink(link.replace(/#r=.*/, '#r=%%%'), { acceptedHosts: [GALLERY] })).toThrow(/damaged/i);
  });

  test('warns when the link was made by a different core major version (design D13)', () => {
    const link = encodeRecipeLink({ host: GALLERY, template, choices: defaults, defaults, coreMajor: CORE_MAJOR + 1 });
    expect(decodeRecipeLink(link, { acceptedHosts: [GALLERY] }).warnings.join(' ')).toMatch(/version/i);
  });
});
