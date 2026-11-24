const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

/**
 * Serialize data for an inline `<script type="application/json">` block (eng review D5, outside voice #3).
 * `<` is escaped so no value can close the script element; U+2028/2029 are escaped for old parsers.
 */
export function serializeJsonBlock(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll(LINE_SEP, '\\u2028')
    .replaceAll(PARA_SEP, '\\u2029');
}
