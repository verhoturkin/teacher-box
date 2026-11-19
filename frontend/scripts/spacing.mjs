// Fails on a px/rem literal in padding/margin/gap/inset (and longhands, logical variants) outside
// `_tokens.scss` and the PrimeNG preset (run by `npm run lint`, ADR-0068). Spacing comes from
// `--tb-space-*` and semantic tokens. A genuinely needed literal (touch-target inset, optical
// nudge) takes `spacing-ok: <reason>` in a comment on the same or the previous line.
// Covers `.scss` and inline `styles:` in `.ts`; a value split over lines is checked per line.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXEMPT = new Set(['_tokens.scss', 'teacher-box-preset.ts']);
const DECLARATION =
  /(?:^|[;{\s])((?:padding|margin)(?:-[a-z-]+)?|(?:row-|column-)?gap|inset(?:-[a-z-]+)?)\s*:\s*([^;}]*)/g;
const LITERAL = /(?<![\w.-])-?(?:\d*\.\d+|[1-9]\d*)(?:px|rem)\b/;

function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    const ok = /\.(ts|scss)$/.test(entry.name) && !entry.name.endsWith('.spec.ts');
    return ok && !EXEMPT.has(entry.name) ? [path] : [];
  });
}

const violations = [];
for (const file of sources(join(ROOT, 'src'))) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (/spacing-ok:/.test(line) || /spacing-ok:/.test(lines[i - 1] ?? '')) return;
    for (const match of line.matchAll(DECLARATION)) {
      if (LITERAL.test(match[2])) {
        violations.push(`  ${relative(ROOT, file)}:${i + 1}  ${match[0].trim()}`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error('px/rem literal in spacing — use --tb-space-* (or add `spacing-ok: reason`):');
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('spacing: no px/rem literals in padding/margin/gap/inset');
