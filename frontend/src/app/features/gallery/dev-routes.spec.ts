import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEV_ROUTES } from './dev-routes';
import { DEV_ROUTES as PRODUCTION_ROUTES } from './dev-routes.prod';

/** `value[key]` of parsed JSON, `undefined` when there is no such object. */
function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null
    ? (Reflect.get(value, key) as unknown)
    : undefined;
}

/** The `fileReplacements` of a build configuration of the app in `angular.json`. */
function replacements(configuration: string): unknown {
  const json: unknown = JSON.parse(readFileSync(join(process.cwd(), 'angular.json'), 'utf8'));
  const build = ['projects', 'teacher-box', 'architect', 'build', 'configurations', configuration];
  return field(build.reduce(field, json), 'fileReplacements');
}

describe('development routes (ADR-0059)', () => {
  it('opens the design gallery in development builds', () => {
    expect(DEV_ROUTES.map((route) => route.path)).toEqual(['gallery']);
  });

  it('loads the gallery lazily', async () => {
    const children = await DEV_ROUTES[0]?.loadChildren?.();
    expect(Array.isArray(children) ? children.map((route) => route.path) : []).toEqual([
      '',
      ':section',
    ]);
  });

  it('has no development route in production builds', () => {
    expect(PRODUCTION_ROUTES).toEqual([]);
    expect(replacements('production')).toContainEqual({
      replace: 'src/app/features/gallery/dev-routes.ts',
      with: 'src/app/features/gallery/dev-routes.prod.ts',
    });
  });
});
