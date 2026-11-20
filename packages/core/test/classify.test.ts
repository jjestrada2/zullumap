import { describe, expect, test } from 'vitest';
import { classify, classIndex } from '../src/classify';

describe('classify', () => {
  test('quantile puts an equal number of values in each class', () => {
    const r = classify([1, 2, 3, 4, 5, 6, 7, 8], 'quantile', 4);
    expect(r.breaks).toEqual([2, 4, 6]);
    expect(r.classCount).toBe(4);
  });

  test('equal interval splits the range into equal-width classes', () => {
    const r = classify([0, 10, 20, 100], 'equal', 4);
    expect(r.breaks).toEqual([25, 50, 75]);
    expect(r.classCount).toBe(4);
  });

  test('natural breaks separates obvious clusters', () => {
    const r = classify([1, 2, 3, 50, 51, 52, 100, 101, 102], 'natural', 3);
    expect(r.breaks).toEqual([3, 52]);
    expect(r.classCount).toBe(3);
  });

  test('removes duplicate breaks and lowers the class count when values tie', () => {
    const r = classify([5, 5, 5, 5, 5, 5, 9, 9], 'quantile', 4);
    expect(new Set(r.breaks).size).toBe(r.breaks.length);
    expect(r.classCount).toBe(r.breaks.length + 1);
    expect(r.classCount).toBeLessThan(4);
    expect(r.reduced).toBe(true);
  });

  test('a single distinct value gives one class with no breaks', () => {
    const r = classify([7, 7, 7], 'natural', 5);
    expect(r.breaks).toEqual([]);
    expect(r.classCount).toBe(1);
  });

  test('is deterministic regardless of input order', () => {
    const a = classify([9, 1, 5, 3, 7, 2, 8], 'natural', 3);
    const b = classify([1, 2, 3, 5, 7, 8, 9], 'natural', 3);
    expect(a).toEqual(b);
  });

  test('rejects an empty value list', () => {
    expect(() => classify([], 'quantile', 5)).toThrow(/no numeric values/i);
  });

  test('classIndex maps a value to its class using the breaks', () => {
    const breaks = [10, 20];
    expect(classIndex(5, breaks)).toBe(0);
    expect(classIndex(10, breaks)).toBe(0);
    expect(classIndex(15, breaks)).toBe(1);
    expect(classIndex(25, breaks)).toBe(2);
  });
});
