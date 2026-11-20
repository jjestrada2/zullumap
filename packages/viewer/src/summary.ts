import { formatNumber, legendRows } from '@zullumap/core/src/overlay';
import type { Legend } from '@zullumap/core/src/compile';

interface Feature { properties: Record<string, unknown> }

/** Text summary for screen readers: title, what color and height mean, class ranges, top 5 (design D10). */
export function screenReaderSummary(args: {
  title: string; legend: Legend; features: Feature[]; mapping: Record<string, string>; geometry: 'polygon' | 'point' | 'line';
}): { heading: string; lines: string[]; top: string[] } {
  const { legend, mapping } = args;
  const valueCol = mapping[legend.slot] ?? legend.slot;
  const ranges = legendRows(legend).map(r => r.label).join(', ');
  const lines = [`Color shows ${valueCol} in ${legend.classCount} classes: ${ranges}.`];
  if (legend.height) {
    lines.push(`Height shows ${mapping[legend.height.slot] ?? legend.height.slot}, from ${formatNumber(legend.height.low)} to ${formatNumber(legend.height.high)}.`);
  }
  if (legend.hasNoData) lines.push('Grey areas have no data.');

  const labelCol = mapping.label;
  const top = !labelCol ? [] : args.features
    .map(f => ({ name: f.properties[labelCol], v: (f.properties.__zm as Record<string, number | null> | undefined)?.[legend.slot] }))
    .filter((x): x is { name: unknown; v: number } => typeof x.v === 'number' && x.name !== undefined && x.name !== null && x.name !== '')
    .sort((a, b) => b.v - a.v)
    .slice(0, 5)
    .map(x => `${String(x.name)}: ${formatNumber(x.v)}`);
  return { heading: args.title, lines, top };
}
