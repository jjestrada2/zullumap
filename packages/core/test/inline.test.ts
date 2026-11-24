import { describe, expect, test } from 'vitest';
import { serializeJsonBlock } from '../src/inline';

const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);

describe('inline JSON blocks (T3, eng outside voice #3)', () => {
  test('escapes < so a value containing </script cannot end the block', () => {
    const out = serializeJsonBlock({ title: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out)).toEqual({ title: '</script><script>alert(1)</script>' });
  });

  test('escapes the JavaScript line separators U+2028 and U+2029', () => {
    const s = `a${LS}b${PS}c`;
    const out = serializeJsonBlock({ s });
    expect(out).not.toContain(LS);
    expect(out).not.toContain(PS);
    expect(JSON.parse(out).s).toBe(s);
  });
});
