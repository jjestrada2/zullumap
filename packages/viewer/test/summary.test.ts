import { describe, expect, test } from 'vitest';
import { screenReaderSummary } from '../src/summary';
import { compiled, mapping } from './fixture';

const base = { title: 'Density in Bogotá', legend: compiled.legend!, features: compiled.features, mapping, geometry: 'polygon' as const };

describe('screen-reader summary (design D10)', () => {
  test('states the title, what color means and every class range', () => {
    const s = screenReaderSummary(base);
    expect(s.heading).toBe('Density in Bogotá');
    expect(s.lines[0]).toBe('Color shows pop in 4 classes: 1–2, 2–4, 4–6, 6–8.');
  });

  test('states what height means with the low and high values', () => {
    expect(screenReaderSummary(base).lines).toContain('Height shows h, from 10 to 80.');
  });

  test('lists the top 5 features by value, named from the label slot', () => {
    expect(screenReaderSummary(base).top).toEqual(['Barrio 8: 8', 'Barrio 7: 7', 'Barrio 6: 6', 'Barrio 5: 5', 'Barrio 4: 4']);
  });

  test('leaves the top-5 list out when no label slot is mapped', () => {
    expect(screenReaderSummary({ ...base, mapping: { value: 'pop' } }).top).toEqual([]);
  });

  test('mentions features without data', () => {
    expect(screenReaderSummary({ ...base, legend: { ...base.legend, hasNoData: true } }).lines.join(' ')).toMatch(/no data/i);
  });
});
