import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));

// World-extent data shaped like Natural Earth countries: spans the dateline and reaches the South Pole.
const box = (w: number, s: number, e: number, n: number, pop: number, name: string) => ({
  type: 'Feature', properties: { pop, name },
  geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
});
const world = { type: 'FeatureCollection', features: [
  box(-170, 50, -120, 70, 40e6, 'North'), box(-80, -50, -40, 5, 200e6, 'South'), box(-10, 35, 40, 60, 80e6, 'Europe'),
  box(70, 10, 140, 50, 1400e6, 'Asia'), box(110, -40, 155, -12, 25e6, 'Oceania'), box(-180, -90, 180, -65, 1e3, 'Antarctica'),
  box(177, -19, 180, -16, 0.9e6, 'Fiji east'), box(-180, -17, -179, -16, 0.9e6, 'Fiji west'),
] };

for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const) test(`a world map opens with every country in view and visibly extruded (${label})`, async ({ page, context }) => {
  await page.setViewportSize(viewport);
  const dir = mkdtempSync(join(tmpdir(), 'zm-world-'));
  writeFileSync(join(dir, 'world.geojson'), JSON.stringify(world));
  execFileSync(process.execPath, [join(root, 'packages/cli/bin/zullumap.js'), 'render', 'risograph-choropleth@1.0.0',
    '--template-dir', join(root, 'templates/risograph-choropleth'), '--data', join(dir, 'world.geojson'),
    '--map', 'value=pop', '--map', 'height=pop', '--map', 'label=name', '--title', 'World population', '--out', join(dir, 'm'), '--no-open']);

  await context.route(/^https?:/, r => r.abort());
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(join(dir, 'm', 'index.html')).href);
  await page.waitForFunction(() => (window as any).zullumap?.motionDone === true, null, { timeout: 45_000 });
  expect(errors).toEqual([]);

  const r = await page.evaluate(() => {
    const zm = (window as any).zullumap, m = zm.map;
    const feats = JSON.parse(document.getElementById('zm-page')!.textContent!).features;
    // Every country's centre (Antarctica's northern edge) is on screen. Fiji's halves sit on the ±180° seam,
    // which is the left and right edge of any single-world map, so they're left out.
    const centres = feats.filter((f: any) => !f.properties.name.startsWith('Fiji')).map((f: any) => {
      const ring = f.geometry.coordinates[0];
      const xs = ring.map((p: number[]) => p[0]), ys = ring.map((p: number[]) => p[1]);
      const lat = f.properties.name === 'Antarctica' ? -65 : (Math.min(...ys) + Math.max(...ys)) / 2;
      return m.project([(Math.min(...xs) + Math.max(...xs)) / 2, lat]);
    });
    // Height of the tallest extrusion on screen: project Asia's centre at ground level and at its extruded top.
    const layer = zm.deck._deck.layerManager.getLayers().find((l: any) => l.id === 'prints-polygons-fill' || l.id.startsWith('prints'));
    const vp = zm.deck._deck.getViewports()[0];
    const asia = feats.find((f: any) => f.properties.name === 'Asia');
    const top = layer.props.getElevation ? zm.deck._deck.props.layers[0].props.getElevation(asia) : 0;
    const ground = vp.project([105, 30, 0]), roof = vp.project([105, 30, top]);
    const landWidth = m.project([155, 30]).x - m.project([-170, 30]).x;
    return { centres, w: innerWidth, h: innerHeight, rise: ground[1] - roof[1], copies: m.getRenderWorldCopies(), landWidth };
  });
  for (const c of r.centres) {
    expect(c.x).toBeGreaterThanOrEqual(0); expect(c.x).toBeLessThanOrEqual(r.w);
    expect(c.y).toBeGreaterThanOrEqual(0); expect(c.y).toBeLessThanOrEqual(r.h);
  }
  // Mercator balloons the poles; the inhabited world (170°W–155°E) should still span most of the screen.
  expect(r.landWidth / r.w).toBeGreaterThan(label === 'phone' ? 0.8 : 0.6);
  expect(r.copies).toBe(false); // each country drawn once, not repeated across world copies
  expect(r.rise).toBeGreaterThan(label === 'phone' ? 15 : 40); // the tallest country rises visibly off the map
});
