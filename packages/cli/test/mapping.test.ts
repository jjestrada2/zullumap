import { describe, expect, test } from 'vitest';
import { resolveMapping } from '../src/mapping';

const slots = { value: { type: 'number' as const, required: true }, height: { type: 'number' as const, required: false }, label: { type: 'string' as const, required: false } };

describe('resolveMapping (which column feeds each slot in a remix)', () => {
  test('--map always wins', () => {
    const r = resolveMapping({ slots, stored: { value: 'pop' }, overrides: { value: 'people' }, columns: ['pop', 'people'] });
    expect(r.mapping).toEqual({ value: 'people' });
    expect(r.notes).toEqual([]);
  });

  test('reuses a stored column when the new data has a column with that exact name, with a note', () => {
    const r = resolveMapping({ slots, stored: { value: 'pop', height: 'pop' }, overrides: {}, columns: ['pop', 'name'] });
    expect(r.mapping).toEqual({ value: 'pop', height: 'pop' });
    expect(r.notes).toEqual(['Using column "pop" for value, as the original map did', 'Using column "pop" for height, as the original map did']);
  });

  test('a required slot with no usable column is an error naming the original column and the new columns', () => {
    expect(() => resolveMapping({ slots, stored: { value: 'pop' }, overrides: {}, columns: ['density', 'name'] }))
      .toThrow('Map the value slot to a column: --map value=<column> (the original map used "pop"; your data has: density, name)');
  });

  test('remix links carry no column names, so required slots need --map', () => {
    expect(() => resolveMapping({ slots, stored: undefined, overrides: {}, columns: ['density'] }))
      .toThrow('Map the value slot to a column: --map value=<column> (your data has: density)');
  });

  test('optional slots without a matching column are left out quietly', () => {
    const r = resolveMapping({ slots, stored: { value: 'pop', label: 'barrio' }, overrides: {}, columns: ['pop'] });
    expect(r.mapping).toEqual({ value: 'pop' });
    expect(r.notes).toEqual(['Using column "pop" for value, as the original map did']);
  });
});
