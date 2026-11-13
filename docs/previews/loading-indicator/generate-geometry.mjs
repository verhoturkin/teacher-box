// Usage: node generate-geometry.mjs /absolute/path/to/material-shapes-ts/dist/index.js
// Requires material-shapes-ts 0.3.0. No dependency is added to the application.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { MaterialShapes, Morph } = await import(pathToFileURL(process.argv[2]).href);
const names = ['SoftBurst', 'Cookie9Sided', 'Pentagon', 'Pill', 'Sunny', 'Cookie4Sided', 'Oval'];
const polygons = names.map((name) => MaterialShapes[name].normalized());
const pack = (cubics) => cubics.map((cubic) => cubic.points.map((value) => +value.toFixed(7)));
let scale = 1;
for (const polygon of polygons) {
  const bounds = polygon.calculateBounds();
  const max = polygon.calculateMaxBounds();
  scale = Math.min(scale, Math.max(
    (bounds[2] - bounds[0]) / (max[2] - max[0]),
    (bounds[3] - bounds[1]) / (max[3] - max[1]),
  ));
}
const morphs = polygons.map((polygon, index) => {
  const morph = new Morph(polygon, polygons[(index + 1) % polygons.length]);
  return { start: pack(morph.asCubics(0)), end: pack(morph.asCubics(1)) };
});
const geometry = { names, scale: scale * 38 / 48, shapes: polygons.map((p) => pack(p.cubics)), morphs };
writeFileSync(new URL('./geometry.json', import.meta.url), JSON.stringify(geometry) + '\n');
