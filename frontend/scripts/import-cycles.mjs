// Fails on a cycle of static imports in src/app (run by `npm run lint`). A cycle through a feature's
// barrel (parts.ts, index.ts) leaves a component `undefined` while its module is still loading, and
// Angular renders nothing (NG0919) — only in the order the app or one test happens to load it.
// Type-only imports and lazy `import()` are erased or deferred, so they cannot close a cycle.
//
// Also fails on a cycle between features (ADR-0058): features depend on each other in one direction
// only. Here a type-only import counts too — it is a dependency, even though it is erased.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'src', 'app');
const ALIASES = { '@core/': 'core', '@shared/': 'shared', '@features/': 'features' };
const IMPORT =
  /(?:^|[\n;])\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g;

function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

function resolveImport(from, specifier) {
  const alias = Object.keys(ALIASES).find((prefix) => specifier.startsWith(prefix));
  let base;
  if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
  else if (alias !== undefined) base = join(APP, ALIASES[alias], specifier.slice(alias.length));
  else return null;
  return [`${base}.ts`, join(base, 'index.ts')].find((path) => existsSync(path)) ?? null;
}

/** The feature a file belongs to, or `null` outside `features/`. */
function featureOf(file) {
  const [area, feature] = relative(APP, file).split(/[\\/]/);
  return area === 'features' ? feature : null;
}

/**
 * Feature arrows known when the check was introduced, removed by stage 370.3 (the same
 * list as PENDING_DIRECTIONS in eslint.config.js). Never add to this list.
 */
const PENDING = new Set(['homework>schedule']);

const files = sources(APP);
const graph = new Map();
const featureGraph = new Map();
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const imports = [...text.matchAll(IMPORT)]
    .map((match) => ({ typeOnly: match[1] !== undefined, target: resolveImport(file, match[2]) }))
    .filter(({ target }) => target !== null);
  graph.set(file, [...new Set(imports.filter((i) => !i.typeOnly).map((i) => i.target))]);
  const feature = featureOf(file);
  if (feature === null) continue;
  const targets = featureGraph.get(feature) ?? new Set();
  featureGraph.set(feature, targets);
  for (const { target } of imports) {
    const other = featureOf(target);
    if (other !== null && other !== feature && !PENDING.has(`${feature}>${other}`)) {
      targets.add(other);
    }
  }
}

/** Tarjan's strongly connected components: every component of two or more nodes is a cycle. */
function findCycles(nodes, edges) {
  let counter = 0;
  const index = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const cycles = [];

  function visit(node) {
    index.set(node, counter);
    low.set(node, counter++);
    stack.push(node);
    onStack.add(node);
    for (const target of edges.get(node) ?? []) {
      if (!index.has(target)) {
        visit(target);
        low.set(node, Math.min(low.get(node), low.get(target)));
      } else if (onStack.has(target)) {
        low.set(node, Math.min(low.get(node), index.get(target)));
      }
    }
    if (low.get(node) === index.get(node)) {
      const component = [];
      let member;
      do {
        member = stack.pop();
        onStack.delete(member);
        component.push(member);
      } while (member !== node);
      if (component.length > 1) cycles.push(component);
    }
  }

  for (const node of nodes) {
    if (!index.has(node)) visit(node);
  }
  return cycles;
}

const cycles = findCycles(files, graph);
for (const cycle of cycles) {
  console.error('Import cycle:');
  for (const file of cycle.sort()) console.error(`  ${relative(ROOT, file).replaceAll('\\', '/')}`);
}

const featureCycles = findCycles([...featureGraph.keys()], featureGraph);
for (const cycle of featureCycles) {
  console.error('Cycle between features (ADR-0058, the table in eslint.config.js):');
  for (const feature of cycle.sort()) {
    const others = [...featureGraph.get(feature)].filter((other) => cycle.includes(other));
    console.error(`  ${feature} -> ${others.sort().join(', ')}`);
  }
}

if (cycles.length > 0 || featureCycles.length > 0) process.exit(1);
console.log(
  `No import cycles in ${String(files.length)} files, none between ${String(featureGraph.size)} features.`,
);
