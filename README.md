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

Then record a 4:5 fly-through video for LinkedIn (about 2 minutes on a laptop; the first run sets up
the recording browser and ffmpeg):

```bash
node packages/cli/bin/zullumap.js trailer my-map
```

It saves `my-map/trailer.mp4` (12 s camera path + 3 s end card with the remix QR code) and adds the
opening view to the map page as its loading poster. `--size 1080x1920`, `--duration` and `--fps` adjust it.

Remix someone's map with your own data: point at their map folder, their remix link or their published
map page, and give your data and title. Template, colors, class method and count, height scale and pitch
come from the original; class breaks and framing are re-fitted to your data:

```bash
node packages/cli/bin/zullumap.js remix my-map --template-dir templates/risograph-choropleth \
  --data mine.geojson --title "Density in Medellín"
```

Columns with the same names as the original's are reused; otherwise map them with `--map value=<column>`.
The page goes to a folder named after the title (`density-in-medellin/`) unless you pass `--out`.

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
