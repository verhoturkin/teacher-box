import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Aura from '@primeuix/themes/aura';
import { AURA_COMPONENTS, AuraBase, AuraTokens } from './aura-base';
import { TeacherBoxPreset } from './teacher-box-preset';

/**
 * The preset carries the tokens of the PrimeNG components the app uses and no others. The list is
 * computed here from the sources: the `primeng/<module>` imports under `src/app`, the modules those
 * import inside PrimeNG, and the Aura components whose tokens their styles read.
 */
const ROOT = process.cwd();
const APP = join(ROOT, 'src', 'app');
const PRIMENG = join(ROOT, 'node_modules', 'primeng', 'fesm2022');
const STYLES = join(ROOT, 'node_modules', '@primeuix', 'styles', 'dist');

const AURA_KEYS: ReadonlySet<string> = new Set(Object.keys(Aura.components ?? {}));

function matches(text: string, pattern: RegExp): string[] {
  return Array.from(text.matchAll(pattern), (match) => match[1] ?? '');
}

function appSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return appSources(path);
    }
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
      ? [readFileSync(path, 'utf8')]
      : [];
  });
}

/** The PrimeNG modules the app imports. */
function appModules(): string[] {
  const modules = appSources(APP).flatMap((text) => matches(text, /from 'primeng\/([a-z-]+)'/g));
  return [...new Set(modules)].sort();
}

/** The code of a PrimeNG module as it is published. */
function moduleCode(module: string): string {
  const path = join(PRIMENG, `primeng-${module}.mjs`);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

/** The modules and every PrimeNG module they import, directly or not. */
function withDependencies(modules: readonly string[]): string[] {
  const seen = new Set<string>();
  const visit = (module: string): void => {
    if (seen.has(module)) {
      return;
    }
    seen.add(module);
    matches(moduleCode(module), /from 'primeng\/([a-z-]+)'/g).forEach(visit);
  };
  modules.forEach(visit);
  return [...seen].sort();
}

/**
 * The Aura components a PrimeNG module takes tokens from: the one of its own name, the name of its
 * style (`datatable` for `primeng/table`), the styles it imports and every `dt('<component>.…')`
 * in its code and in those styles.
 */
function tokensOf(module: string): string[] {
  const code = moduleCode(module);
  const styles = matches(code, /from '@primeuix\/styles\/([a-z-]+)'/g);
  const css = styles.map((style) => {
    const path = join(STYLES, style, 'index.mjs');
    return existsSync(path) ? readFileSync(path, 'utf8') : '';
  });
  const names = [
    module,
    ...styles,
    ...matches(code, /\bname = '([a-z]+)'/g),
    ...[code, ...css].flatMap((text) => matches(text, /dt\('([a-z]+)\./g)),
  ];
  return [...new Set(names)].filter((name) => AURA_KEYS.has(name)).sort();
}

const USED_MODULES = withDependencies(appModules());
const USED_TOKENS = [...new Set(USED_MODULES.flatMap(tokensOf))].sort();
const PRESET_TOKENS = Object.keys(AURA_COMPONENTS).sort();

describe('the Aura base of the preset', () => {
  it('reads the PrimeNG modules of the app and their code', () => {
    expect(appModules()).toContain('button');
    expect(moduleCode('button')).toContain("from 'primeng/ripple'");
    expect(moduleCode('no-such-module')).toBe('');
    // a module the app does not import itself comes with the one that uses it
    expect(USED_MODULES).toEqual(expect.arrayContaining(['paginator', 'ripple', 'scroller']));
    expect(tokensOf('table')).toContain('datatable');
    expect(tokensOf('scroller')).toEqual(['virtualscroller']);
  });

  it('has the tokens of every PrimeNG module the app imports', () => {
    const missing = USED_TOKENS.filter((name) => !PRESET_TOKENS.includes(name));

    // add `@primeuix/themes/aura/<name>` to AURA_COMPONENTS in aura-base.ts
    expect(missing).toEqual([]);
  });

  it('has no tokens of components the app does not use', () => {
    const unused = PRESET_TOKENS.filter((name) => !USED_TOKENS.includes(name));

    // remove them from AURA_COMPONENTS in aura-base.ts: they only weigh the first bundle
    expect(unused).toEqual([]);
  });

  it('is Aura itself, limited to these components', () => {
    const components = Object.fromEntries(
      Object.entries(Aura.components ?? {}).filter(([name]) => PRESET_TOKENS.includes(name)),
    );

    expect(AuraBase).toEqual({ ...Aura, components });
    expect(AuraBase.css).toBe(Aura.css);
    expect(AuraBase.css).toContain('transition: none');
    expect(AuraTokens.primitive).toEqual(Aura.primitive);
  });

  it('is the only way the app takes Aura: the whole theme is imported nowhere', () => {
    const whole = appSources(APP).filter((text) => text.includes("'@primeuix/themes/aura'"));

    expect(whole).toEqual([]);
  });

  it('changes only the components the base has', () => {
    const changed = Object.keys(TeacherBoxPreset.components ?? {});

    expect(changed.filter((name) => !PRESET_TOKENS.includes(name))).toEqual([]);
  });
});
