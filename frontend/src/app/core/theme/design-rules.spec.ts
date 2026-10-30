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

/** An icon class: the name of a Material Symbol (ADR-0046). */
// an assist chip names its icon in the `icon` attribute, without the class
const ICON = /(?:\btb-i-|<tb-assist-chip\s+icon=")([a-z0-9_]+)/g;

/** A primeicons class (`api-error` is not one). */
const PRIMEICONS = /(?<![\w-])pi-[a-z]|class="pi[\s"]/;

/** `success` on a button tag (tags and messages keep it). */
const BUTTON_SUCCESS =
  /<(p-button|p-splitbutton)\b[^>]*success|<(button|a)\b[^>]*\bpButton\b[^>]*success|acceptButtonProps:[^}]*success/;

describe('design rules', () => {
  it('reads the sources of the app', () => {
    expect(ALL.length).toBeGreaterThan(100);
  });

  it('takes colours from the M3 roles, not from Aura tokens (§2)', () => {
    expect(breaches(/--p-(primary-color|primary-contrast|text-|content-|highlight-)/)).toEqual([]);
  });

  it('has no small buttons; outlined ones only as variant="outlined" (§8)', () => {
    expect(breaches(/size="small"/)).toEqual([]);
    // `tb-segment-group [outlined]` is the M3 segmented button (§8), not an outlined p-button
    expect(
      breaches(/<(?!tb-segment-group\b)[a-z-]+\b[^>]*\[outlined\]|<p-button\b[^>]*\soutlined\b/),
    ).toEqual([]);
  });

  it('has no green or coloured tonal buttons: one accent (§7, ADR-0045)', () => {
    expect(breaches(BUTTON_SUCCESS)).toEqual([]);
    expect(breaches(/tb-tonal/)).toEqual([]);
  });

  it('has no hex colours in styles outside the theme and the boards (§2)', () => {
    const styled = ALL.filter((source) => !source.path.startsWith('features/boards/'));
    expect(breaches(HEX_IN_STYLE, styled)).toEqual([]);
  });

  it('has no primeicons: icons are Material Symbols (ADR-0046)', () => {
    expect(breaches(PRIMEICONS)).toEqual([]);
  });

  it('builds the icon font from the icons in use: run `npm run icons` (ADR-0046)', () => {
    const map = readFileSync(join(APP, 'core', 'theme', 'icons.scss'), 'utf8');
    const mapped = Array.from(map.matchAll(/^\s*'([a-z0-9_]+)':/gm), (match) => match[1]);
    const used = sources(join(process.cwd(), 'src'))
      .filter((source) => source.path !== 'core/theme/icons.scss')
      .flatMap(({ text }) => Array.from(text.matchAll(ICON), (match) => match[1]));
    expect(mapped).toEqual([...new Set(used)].sort());
  });

  it('finds a breach', () => {
    const sample = [
      {
        path: 'x.ts',
        text: 'a\n  color: var(--p-text-color);\n<p-button size="small" />\n  border-color: #FFF;',
      },
      // a hex code in a text is not a colour of a style
      { path: 'y.ts', text: 'placeholder="#0f766e" — a code like #0f766e' },
      {
        path: 'z.ts',
        text: '<p-tag severity="success" />\n<p-button\n  label="Да"\n  severity="success"\n/>',
      },
    ];
    expect(breaches(/--p-text-/, sample)).toEqual(['x.ts:2']);
    expect(breaches(BUTTON_SUCCESS, sample)).toEqual(['z.ts:2']);
    expect(breaches(/size="small"/, sample)).toEqual(['x.ts:3']);
    expect(breaches(HEX_IN_STYLE, sample)).toEqual(['x.ts:4']);
    expect(
      breaches(PRIMEICONS, [
        { path: 'p.ts', text: `api-error\nicon: 'pi pi-check'\n<i class="pi">` },
      ]),
    ).toEqual(['p.ts:2', 'p.ts:3']);
  });
});
