// Writes examples/bogota-grid.geojson: SYNTHETIC data (not real population) for trying templates.
import { writeFileSync } from 'node:fs';
const N = 40, STEP = 0.006, C = [-74.08, 4.65], features = [];
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  const x = C[0] + (i - N / 2) * STEP, y = C[1] + (j - N / 2) * STEP, s = STEP * 0.46;
  const d = Math.hypot(i - N / 2, (j - N / 2) * 1.6) / (N / 2);
  const v = Math.max(0, Math.exp(-d * d * 3) + Math.sin(i * 1.7) * Math.cos(j * 1.3) * 0.08) * 30000;
  const r = (n) => Math.round(n * 1e6) / 1e6;
  features.push({ type: 'Feature', properties: { cell: `${i}-${j}`, density: Math.round(v) },
    geometry: { type: 'Polygon', coordinates: [[[r(x - s), r(y - s)], [r(x + s), r(y - s)], [r(x + s), r(y + s)], [r(x - s), r(y + s)], [r(x - s), r(y - s)]]] } });
}
writeFileSync(new URL('./bogota-grid.geojson', import.meta.url), JSON.stringify({ type: 'FeatureCollection', features }));
