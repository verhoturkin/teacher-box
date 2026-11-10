import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(process.cwd(), 'src', 'app');

/** The sources (`.ts`, no specs) under a directory of the app. */
function sources(dir: string): string[] {
  return readdirSync(join(APP, dir), { withFileTypes: true, recursive: true })
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'),
    )
    .map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8'));
}

/** The element or attribute name of every selector: `tb-avatar`, `tbSwipe` from `[tbSwipe]`. */
function selectors(text: string): string[] {
  return Array.from(text.matchAll(/selector: '([^']+)'/g), (match) => {
    const selector = match[1] ?? '';
    return /\[([\w-]+)\]/.exec(selector)?.[1] ?? selector;
  });
}

describe('gallery samples of shared/ui (ADR-0059)', () => {
  const samples = readdirSync(join(APP, 'features', 'gallery'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => sources(join('features', 'gallery', entry.name)))
    .join('\n');

  it('shows every component and directive of shared/ui in a sample', () => {
    const shared = sources(join('shared', 'ui')).flatMap(selectors);
    expect(shared.length).toBeGreaterThan(20);
    expect(shared.filter((selector) => !samples.includes(selector))).toEqual([]);
  });

  it('keeps every sample within 80 lines', () => {
    const long = readdirSync(join(APP, 'features', 'gallery'), {
      withFileTypes: true,
      recursive: true,
    })
      .filter((entry) => entry.isFile() && entry.parentPath !== join(APP, 'features', 'gallery'))
      .filter(
        (entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8').split('\n').length > 81,
      )
      .map((entry) => entry.name);
    expect(long).toEqual([]);
  });
});
