// Fails on a `font: var(--tb-type-<role>)` whose rule has no `letter-spacing: var(--tb-tracking-<role>)`
// (run by `npm run lint`, 457.2). The `font` shorthand resets no tracking, so without the pair a role
// inherits its parent's. A deliberate other value takes `tracking-ok: <reason>` in the same rule.
// Covers `.scss` and inline `styles:` in `.ts`; the rule is the text between the nearest braces.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONT = /font:\s*var\(--tb-type-([a-z0-9-]+?)(?=[,)])/g;

function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|scss)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

const violations = [];
let pairs = 0;
for (const file of sources(join(ROOT, 'src'))) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(FONT)) {
    const start = Math.max(text.lastIndexOf('{', match.index), text.lastIndexOf('}', match.index));
    const ends = [text.indexOf('{', match.index), text.indexOf('}', match.index)].filter(
      (i) => i >= 0,
    );
    const rule = text.slice(start, Math.min(...ends, text.length));
    pairs++;
    if (
      rule.includes(`letter-spacing: var(--tb-tracking-${match[1]});`) ||
      rule.includes('tracking-ok:')
    ) {
      continue;
    }
    const line = text.slice(0, match.index).split('\n').length;
    violations.push(`  ${relative(ROOT, file)}:${line}  ${match[0]})`);
  }
}

if (violations.length > 0) {
  console.error('font role without its tracking — add letter-spacing: var(--tb-tracking-<role>):');
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log(`tracking: ${pairs} font roles, each with its tracking`);
