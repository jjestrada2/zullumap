import { describe, expect, test } from 'vitest';
import { qrMatrix, qrSvgPath } from '../src/qr';

const LONGEST = 'https://jjestrada2.github.io/zullumap/t/risograph-choropleth@12.10.3#r=0;mn;c7;h4999;p69x';

describe('remix QR code (eng review D12)', () => {
  test('a 100-character link fits QR version 6 (41×41) at error correction M', () => {
    const link = LONGEST.padEnd(100, 'x').slice(0, 100);
    expect(qrMatrix(link).size).toBeLessThanOrEqual(41);
  });

  test('is deterministic', () => {
    expect(qrSvgPath(LONGEST)).toEqual(qrSvgPath(LONGEST));
  });

  test('draws dark modules as a single SVG path inside a 4-module quiet zone', () => {
    const { viewBox, d } = qrSvgPath('https://example.org');
    const { size } = qrMatrix('https://example.org');
    expect(viewBox).toBe(`0 0 ${size + 8} ${size + 8}`);
    expect(d).toMatch(/^M4 4h1v1h-1z/); // top-left finder pattern starts at the quiet-zone edge
  });
});
