export type ClassMethod = 'quantile' | 'equal' | 'natural';

export interface Classification {
  /** Upper bounds of every class except the last, strictly ascending. */
  breaks: number[];
  /** Number of classes actually produced (breaks.length + 1). */
  classCount: number;
  /** True when fewer classes than requested were possible (ties or too few distinct values). */
  reduced: boolean;
}

/**
 * Compute class breaks for numeric values. Deterministic for a given multiset of values:
 * input order never changes the result.
 */
export function classify(values: number[], method: ClassMethod, requested: number): Classification {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) throw new Error('No numeric values to classify');
  const distinct = new Set(sorted).size;
  const k = Math.max(1, Math.min(Math.floor(requested), distinct));

  let raw: number[];
  if (k === 1) raw = [];
  else if (method === 'quantile') raw = quantileBreaks(sorted, k);
  else if (method === 'equal') raw = equalBreaks(sorted, k);
  else raw = naturalBreaks(sorted, k);

  const max = sorted[sorted.length - 1]!;
  const breaks = [...new Set(raw)].filter(b => b < max).sort((a, b) => a - b);
  const classCount = breaks.length + 1;
  return { breaks, classCount, reduced: classCount < requested };
}

/** Index of the class a value falls in: values equal to a break belong to the lower class. */
export function classIndex(value: number, breaks: number[]): number {
  let i = 0;
  while (i < breaks.length && value > breaks[i]!) i++;
  return i;
}

function quantileBreaks(sorted: number[], k: number): number[] {
  const n = sorted.length;
  const out: number[] = [];
  for (let c = 1; c < k; c++) out.push(sorted[Math.max(0, Math.floor((c * n) / k) - 1)]!);
  return out;
}

function equalBreaks(sorted: number[], k: number): number[] {
  const min = sorted[0]!, max = sorted[sorted.length - 1]!;
  const step = (max - min) / k;
  const out: number[] = [];
  for (let c = 1; c < k; c++) out.push(min + step * c);
  return out;
}

/** Jenks natural breaks (Fisher-Jenks dynamic programming on sorted values). */
function naturalBreaks(sorted: number[], k: number): number[] {
  const n = sorted.length;
  const lower: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(k + 1).fill(0));
  const variance: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(k + 1).fill(Infinity));
  for (let j = 1; j <= k; j++) { lower[1]![j] = 1; variance[1]![j] = 0; }

  for (let l = 2; l <= n; l++) {
    let s1 = 0, s2 = 0, w = 0, v = 0;
    for (let m = 1; m <= l; m++) {
      const i3 = l - m + 1;
      const val = sorted[i3 - 1]!;
      s2 += val * val; s1 += val; w += 1;
      v = s2 - (s1 * s1) / w;
      const i4 = i3 - 1;
      if (i4 !== 0) {
        for (let j = 2; j <= k; j++) {
          if (variance[l]![j]! >= v + variance[i4]![j - 1]!) {
            lower[l]![j] = i3;
            variance[l]![j] = v + variance[i4]![j - 1]!;
          }
        }
      }
    }
    lower[l]![1] = 1;
    variance[l]![1] = v;
  }

  const breaks: number[] = [];
  let idx = n;
  for (let j = k; j >= 2; j--) {
    const start = lower[idx]![j]! - 1; // first index (0-based) of class j
    breaks.unshift(sorted[start - 1]!); // upper bound of class j-1
    idx = start;
  }
  return breaks;
}
