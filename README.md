# zullumap

Remixable 3D map templates for agents and people: give a template your GeoJSON and get an interactive
deck.gl + MapLibre map page you can open by double-click and share. Early preview, not on npm yet.

## Try it

```bash
npm install
npm run build
node packages/cli/bin/zullumap.js render risograph-choropleth@1.0.0 \
  --template-dir templates/risograph-choropleth \
  --data examples/bogota-grid.geojson \
  --map value=density --map height=density --map label=cell \
  --title "Density in Bogotá (synthetic)" --out my-map
```

`--map` connects the template's slots to your data's columns: `value` (number, color), `height` (number,
optional) and `label` (text, optional). `--options choices.json` overrides class method, class count,
height scale or pitch within the template's rules; `--no-recipe` leaves out the remix link.
`examples/bogota-grid.geojson` is synthetic data for trying templates, not real population.

## Develop

```bash
npm test            # unit tests (Vitest)
npm run test:e2e    # browser tests (Playwright)
npm run typecheck
```

Design: [docs/designs/agent-first-map-templates.md](docs/designs/agent-first-map-templates.md) · visual system: [DESIGN.md](DESIGN.md)
