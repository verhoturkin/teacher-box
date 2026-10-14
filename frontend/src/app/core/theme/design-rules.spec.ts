import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Guards the rules of docs/design-system.md that a review keeps missing: the sources of the app are
 * read as text (tests and the theme, which defines the roles, are left out).
 */
const APP = join(process.cwd(), 'src', 'app');

interface Source {
  readonly path: string;
  readonly text: string;
}

function sources(dir: string): Source[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sources(path);
    }
    return /\.(ts|html|scss)$/.test(entry.name) && !entry.name.endsWith('.spec.ts')
      ? [{ path: relative(APP, path).split(sep).join('/'), text: readFileSync(path, 'utf8') }]
      : [];
  });
}

const ALL = sources(APP).filter((source) => !source.path.startsWith('core/theme/'));

/** The places of `pattern` as `path:line`. */
function breaches(pattern: RegExp, files: readonly Source[] = ALL): string[] {
  const global = new RegExp(
    pattern.source,
    pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
  );
  return files.flatMap(({ path, text }) =>
    Array.from(text.matchAll(global), (match) => {
      const line = text.slice(0, match.index).split('\n').length;
      return `${path}:${String(line)}`;
    }),
  );
}

/** A hex colour as the value of a colour property. */
const HEX_IN_STYLE =
  /(color|background|border|outline|fill|stroke|shadow)[\w-]*\s*:[^;{}\n]*#[0-9a-f]{3,8}\b/i;

describe('design rules', () => {
  it('reads the sources of the app', () => {
    expect(ALL.length).toBeGreaterThan(100);
  });

  it('takes colours from the M3 roles, not from Aura tokens (§2)', () => {
    expect(breaches(/--p-(primary-color|primary-contrast|text-|content-|highlight-)/)).toEqual([]);
  });

  it('has no small or outlined buttons (§7)', () => {
    expect(breaches(/size="small"/)).toEqual([]);
    expect(breaches(/\[outlined\]|variant="outlined"|<p-button\b[^>]*\soutlined\b/)).toEqual([]);
  });

  it('has no hex colours in styles outside the theme and the boards (§2)', () => {
    const styled = ALL.filter((source) => !source.path.startsWith('features/boards/'));
    expect(breaches(HEX_IN_STYLE, styled)).toEqual([]);
  });

  it('finds a breach', () => {
    const sample = [
      {
        path: 'x.ts',
        text: 'a\n  color: var(--p-text-color);\n<p-button size="small" />\n  border-color: #FFF;',
      },
      // a hex code in a text is not a colour of a style
      { path: 'y.ts', text: 'placeholder="#0f766e" — a code like #0f766e' },
    ];
    expect(breaches(/--p-text-/, sample)).toEqual(['x.ts:2']);
    expect(breaches(/size="small"/, sample)).toEqual(['x.ts:3']);
    expect(breaches(HEX_IN_STYLE, sample)).toEqual(['x.ts:4']);
  });
});
