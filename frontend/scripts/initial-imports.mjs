// Fails when a package that must stay out of the initial bundle is reached from `src/main.ts` by
// static imports alone (run by `npm run lint`, stage 376). A lazy `import()` — a route, a loader — starts
// a chunk of its own, so the walk stops there; type-only imports are erased. Such a package may be
// imported statically only by modules that are themselves loaded with `import()`.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Package → why it is loaded later. */
const LAZY_ONLY = {
  '@material/material-color-utilities':
    'the colour library (84 kB): the default roles are constants (npm run colors), other ones are ' +
    'computed once behind import() — core/theme/portal-accent.ts (ADR-0034)',
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const APP = join(SRC, 'app');
const ALIASES = { '@core/': 'core', '@shared/': 'shared', '@features/': 'features' };
const IMPORT =
  /(?:^|[\n;])\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g;

function resolveImport(from, specifier) {
  const alias = Object.keys(ALIASES).find((prefix) => specifier.startsWith(prefix));
  let base;
  if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
  else if (alias !== undefined) base = join(APP, ALIASES[alias], specifier.slice(alias.length));
  else return null;
  return [`${base}.ts`, join(base, 'index.ts')].find((path) => existsSync(path)) ?? null;
}

const name = (file) => relative(ROOT, file).replaceAll('\\', '/');
const lazyOnly = (specifier) =>
  Object.keys(LAZY_ONLY).find((pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`));

// breadth-first from main.ts: `via` keeps the shortest chain to every file
const start = join(SRC, 'main.ts');
const via = new Map([[start, null]]);
const queue = [start];
const found = [];
while (queue.length > 0) {
  const file = queue.shift();
  for (const match of readFileSync(file, 'utf8').matchAll(IMPORT)) {
    if (match[1] !== undefined) continue;
    const pkg = lazyOnly(match[2]);
    if (pkg !== undefined) found.push({ pkg, file });
    const target = resolveImport(file, match[2]);
    if (target !== null && !via.has(target)) {
      via.set(target, file);
      queue.push(target);
    }
  }
}

for (const { pkg, file } of found) {
  const chain = [];
  for (let step = file; step !== null; step = via.get(step)) chain.unshift(name(step));
  console.error(`${pkg} is in the initial bundle — ${LAZY_ONLY[pkg]}:`);
  console.error(`  ${chain.join('\n  -> ')}\n  -> ${pkg}`);
}
if (found.length > 0) process.exit(1);
console.log(
  `No lazy-only package among the static imports of ${String(via.size)} files reached from src/main.ts.`,
);
