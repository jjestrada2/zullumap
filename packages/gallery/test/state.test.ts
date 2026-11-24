import { describe, expect, test } from 'vitest';
import { pageState } from '../src/state';

const manifest = {
  rules: { classMethods: ['quantile', 'natural'] as ('quantile' | 'natural' | 'equal')[], classCount: { min: 2, max: 7 }, heightScale: { min: 0, max: 0.5 }, pitch: { min: 0, max: 70 } },
};
const base = { template: { id: 'risograph-choropleth', version: '1.0.0' }, manifest, host: 'https://jjestrada2.github.io/zullumap' };

describe('pageState: what a template page shows for its URL', () => {
  test('no #r= link: the default look, and a default remix link', () => {
    expect(pageState({ ...base, hash: '', search: '' })).toEqual({
      choices: {}, fragment: 'r=0', link: 'https://jjestrada2.github.io/zullumap/t/risograph-choropleth@1.0.0#r=0', messages: [],
    });
  });

  test('a remix link: its choices, and the same link for the remix command', () => {
    const s = pageState({ ...base, hash: '#r=0;mn;c5', search: '' });
    expect(s.choices).toEqual({ method: 'natural', classCount: 5 });
    expect(s.link).toBe('https://jjestrada2.github.io/zullumap/t/risograph-choropleth@1.0.0#r=0;mn;c5');
    expect(s.messages).toEqual([]);
  });

  test('a damaged link: the default look, with the design message', () => {
    const s = pageState({ ...base, hash: '#r=%%%', search: '' });
    expect(s).toMatchObject({ choices: {}, fragment: 'r=0', messages: ["This remix link is damaged — here's the template's default look"] });
  });

  test('choices this template does not allow are treated as damaged', () => {
    for (const hash of ['#r=0;c12', '#r=0;me', '#r=0;h0.9', '#r=0;p80']) {
      expect(pageState({ ...base, hash, search: '' }).messages).toEqual(["This remix link is damaged — here's the template's default look"]);
    }
  });

  test('a missing version (redirected by 404.html): says so, keeps the link choices', () => {
    const s = pageState({ ...base, hash: '#r=0;c5', search: '?missing=9.9.9' });
    expect(s.messages).toEqual(['This version is gone — showing the newest']);
    expect(s.choices).toEqual({ classCount: 5 });
  });
});
