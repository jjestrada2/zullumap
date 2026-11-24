import { describe, expect, test } from 'vitest';
import { renderOverlay, legendRows, overlayPlaceholders } from '../src/overlay';

const legend = {
  slot: 'value', breaks: [2, 4], classCount: 3, min: 1, max: 8, hasNoData: false,
  colors: [[36, 153, 166], [244, 154, 168], [233, 94, 90]] as [number, number, number][],
};

describe('overlay placeholders (T10)', () => {
  test('interpolates the title as text, never as HTML', () => {
    const html = renderOverlay('<h1 data-zm-region="title">{{title}}</h1>', { title: '<img src=x onerror=alert(1)> & co' });
    expect(html).toBe('<h1 data-zm-region="title">&lt;img src=x onerror=alert(1)&gt; &amp; co</h1>');
  });

  test('repeats the legend block once per resolved class', () => {
    const src = '<ul>{{#legend}}<li style="background:{{color}}">{{label}}</li>{{/legend}}</ul>';
    const html = renderOverlay(src, { title: 't', legend: legendRows(legend) });
    expect(html.match(/<li/g)).toHaveLength(3);
    expect(html).toContain('background:rgb(36, 153, 166)');
    expect(html).toContain('>1–2<');
    expect(html).toContain('>4–8<');
  });

  test('renders an optional block only when its value is present (no-data swatch, height key)', () => {
    const src = '{{#noData}}<i>{{label}}</i>{{/noData}}{{#height}}<b>{{low}} to {{high}}</b>{{/height}}';
    expect(renderOverlay(src, { title: 't' })).toBe('');
    expect(renderOverlay(src, { title: 't', noData: { label: 'No data', color: 'rgb(1, 2, 3)' }, height: { low: '0', high: '80' } }))
      .toBe('<i>No data</i><b>0 to 80</b>');
  });

  test('escapes quotes so values cannot break out of attributes', () => {
    expect(renderOverlay('<p title="{{title}}"></p>', { title: '" onclick="x' })).toBe('<p title="&quot; onclick=&quot;x"></p>');
  });

  test('lists the placeholders a template uses, so check can flag unknown ones', () => {
    expect(overlayPlaceholders('{{title}} {{#legend}}{{label}}{{/legend}} {{bogus}}')).toEqual(['title', 'legend', 'label', 'bogus']);
  });
});

describe('legendRows', () => {
  test('labels each class with its value range, from the minimum to the maximum', () => {
    expect(legendRows(legend).map(r => r.label)).toEqual(['1–2', '2–4', '4–8']);
  });

  test('formats large and fractional numbers compactly and the same everywhere', () => {
    const rows = legendRows({ ...legend, breaks: [1234.5678, 50000], min: 0.123456, max: 1_250_000 });
    expect(rows.map(r => r.label)).toEqual(['0.12–1,234.57', '1,234.57–50,000', '50,000–1,250,000']);
  });
});
