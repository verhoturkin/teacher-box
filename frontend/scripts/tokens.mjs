// Fails on a `--tb-*` custom property that is declared but never read (run by `npm run lint`).
// Declared: `--tb-x:` in styles, components or `teacher-box-preset.ts`. Read: any other mention
// of the name (`var(--tb-x)`, `getPropertyValue('--tb-x')`, a mention in a string or comment).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSIONS = ['.ts', '.scss', '.css', '.html'];
const TOKEN = /--tb-[a-z0-9]+(?:-[a-z0-9]+)*/g;

function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return EXTENSIONS.some((ext) => entry.name.endsWith(ext)) && !entry.name.endsWith('.spec.ts')
      ? [path]
      : [];
  });
}

const declared = new Map();
const read = new Set();
for (const file of sources(join(ROOT, 'src'))) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(TOKEN)) {
    const isDeclaration = /^\s*:/.test(text.slice(match.index + match[0].length));
    if (isDeclaration) {
      if (!declared.has(match[0])) declared.set(match[0], relative(ROOT, file));
    } else read.add(match[0]);
  }
}

const unused = [...declared].filter(([name]) => !read.has(name));
if (unused.length > 0) {
  console.error('Custom properties declared but never read — remove them:');
  for (const [name, file] of unused) console.error(`  ${name}  (${file})`);
  process.exit(1);
}
console.log(`tokens: ${declared.size} custom properties, all read`);
