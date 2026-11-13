// Rebuild from the reviewed preview, without a runtime geometry dependency.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('docs/previews/loading-indicator/geometry.json', root)));
const header = `// Generated from the reviewed preview geometry (material-shapes-ts 0.3.0, Apache-2.0).
// See scripts/loading-geometry.mjs and public/licenses/material-shapes/NOTICE.
type Coordinate = readonly [start: number, delta: number];
type Morph = readonly (readonly Coordinate[])[];
export const LOADING_SCALE = ${data.scale};
export const LOADING_MORPHS: readonly [Morph, ...Morph[]] = `;
const morphs = data.morphs.map((pair) => pair.start.map((cubic, i) =>
  cubic.map((value, j) => [value, pair.end[i][j] - value])));
writeFileSync(new URL('frontend/src/app/shared/ui/loading-geometry.ts', root),
  header + JSON.stringify(morphs) + ';\n');
