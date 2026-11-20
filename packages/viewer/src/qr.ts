import qrcode from 'qrcode-generator';

/** QR modules for a remix link at error correction M (eng review D12). */
export function qrMatrix(text: string): { size: number; dark: (r: number, c: number) => boolean } {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  return { size: qr.getModuleCount(), dark: (r, c) => qr.isDark(r, c) };
}

/** One SVG path of dark modules, with the standard 4-module quiet zone. */
export function qrSvgPath(text: string): { viewBox: string; d: string } {
  const m = qrMatrix(text);
  let d = '';
  for (let r = 0; r < m.size; r++) for (let c = 0; c < m.size; c++) if (m.dark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
  return { viewBox: `0 0 ${m.size + 8} ${m.size + 8}`, d };
}
