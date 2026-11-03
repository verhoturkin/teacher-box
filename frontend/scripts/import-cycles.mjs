// Fails on a cycle of static imports in src/app (run by `npm run lint`). A cycle through a feature's
// barrel (parts.ts, index.ts) leaves a component `undefined` while its module is still loading, and
// Angular renders nothing (NG0919) — only in the order the app or one test happens to load it.
// Type-only imports and lazy `import()` are erased or deferred, so they cannot close a cycle.
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

const files = sources(APP);
const graph = new Map(
  files.map((file) => {
    const text = readFileSync(file, 'utf8');
    const targets = [...text.matchAll(IMPORT)]
      .filter((match) => match[1] === undefined)
      .map((match) => resolveImport(file, match[2]))
      .filter((target) => target !== null);
    return [file, [...new Set(targets)]];
  }),
);

// Tarjan's strongly connected components: every component of two or more files is a cycle.
let counter = 0;
const index = new Map();
const low = new Map();
const stack = [];
const onStack = new Set();
const cycles = [];

function visit(file) {
  index.set(file, counter);
  low.set(file, counter++);
  stack.push(file);
  onStack.add(file);
  for (const target of graph.get(file) ?? []) {
    if (!index.has(target)) {
      visit(target);
      low.set(file, Math.min(low.get(file), low.get(target)));
    } else if (onStack.has(target)) {
      low.set(file, Math.min(low.get(file), index.get(target)));
    }
  }
  if (low.get(file) === index.get(file)) {
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== file);
    if (component.length > 1) cycles.push(component);
  }
}

for (const file of files) {
  if (!index.has(file)) visit(file);
}

if (cycles.length > 0) {
  for (const cycle of cycles) {
    console.error('Import cycle:');
    for (const file of cycle.sort())
      console.error(`  ${relative(ROOT, file).replaceAll('\\', '/')}`);
  }
  process.exit(1);
}
console.log(`No import cycles in ${String(files.length)} files.`);
