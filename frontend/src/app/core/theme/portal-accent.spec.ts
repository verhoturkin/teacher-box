import { $dt } from '@primeuix/themes';
import { accentScheme } from './accent-scheme';
import { ENGINE_STAMP } from './generated-colors';
import {
  SCHEME_KEY,
  accentShades,
  applyScheme,
  isAccent,
  isOwnColor,
  knownAccentScheme,
  loadAccentScheme,
  ownShades,
} from './portal-accent';
import { DEFAULT_SCHEME } from './teacher-box-preset';

const VIBRANT = { scheme: 'vibrant', contrast: 'increased' } as const;

function stored(): Record<string, unknown> {
  const value: unknown = JSON.parse(localStorage.getItem(SCHEME_KEY) ?? '{}');
  return typeof value === 'object' && value !== null ? { ...value } : {};
}

describe('portal accent', () => {
  afterEach(() => {
    localStorage.removeItem(SCHEME_KEY);
    applyScheme(DEFAULT_SCHEME);
  });

  it('knows the colors of the portal', () => {
    expect(isAccent('emerald')).toBe(true);
    expect(isAccent('gold')).toBe(false);
    expect(accentShades('indigo')['600']).toBe('#4f46e5');
    expect(accentShades('gold')['500']).toBe('#6366f1');
  });

  it('builds the shades of an own color', () => {
    expect(isOwnColor('#0F766E')).toBe(true);
    expect(isOwnColor('#0f766')).toBe(false);
    expect(Object.keys(ownShades('#0F766E'))).toHaveLength(11);
    expect(ownShades('#0F766E')['500']).toBe('#0f766e');
    expect(ownShades('#0f766e')['50']).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('knows the default scheme without computing: it is what the library gives', () => {
    expect(knownAccentScheme('indigo')).toEqual(DEFAULT_SCHEME);
    expect(knownAccentScheme('gold')).toEqual(DEFAULT_SCHEME);
    expect(DEFAULT_SCHEME).toEqual(accentScheme('indigo'));
    expect(localStorage.getItem(SCHEME_KEY)).toBeNull();
  });

  it('computes another scheme once and keeps its roles on the device', async () => {
    expect(knownAccentScheme('#bb2649', VIBRANT)).toBeNull();

    const scheme = await loadAccentScheme('#BB2649', VIBRANT);

    expect(scheme).toEqual(accentScheme('#bb2649', VIBRANT));
    expect(stored()['key']).toBe(`1|${ENGINE_STAMP}|#bb2649|#22c55e|#f59e0b|vibrant|increased`);
    // the next start: the same roles from the device, the primary palette built again
    expect(knownAccentScheme('#bb2649', VIBRANT)).toEqual(scheme);
    expect(await loadAccentScheme('#bb2649', VIBRANT)).toEqual(scheme);
    // another seed, scheme or contrast is not known
    expect(knownAccentScheme('#bb2649')).toBeNull();
    expect(knownAccentScheme('emerald', VIBRANT)).toBeNull();
    expect(knownAccentScheme('#bb2649', { scheme: 'vibrant', contrast: 'maximum' })).toBeNull();
  });

  it('computes again when the kept roles are of another engine or damaged', async () => {
    await loadAccentScheme('emerald');
    const kept = stored();
    const key = typeof kept['key'] === 'string' ? kept['key'] : '';

    localStorage.setItem(
      SCHEME_KEY,
      JSON.stringify({ ...kept, key: key.replace(ENGINE_STAMP, '00000000') }),
    );
    expect(knownAccentScheme('emerald')).toBeNull();

    for (const damaged of [
      '{',
      '"text"',
      JSON.stringify({ neutral: kept['neutral'], light: kept['light'], dark: kept['dark'] }),
      JSON.stringify({ ...kept, dark: undefined }),
      JSON.stringify({ ...kept, neutral: 'none' }),
      JSON.stringify({ ...kept, light: { primary: '#000000' } }),
      JSON.stringify({ ...kept, dark: { ...DEFAULT_SCHEME.dark, scrim: 5 } }),
    ]) {
      localStorage.setItem(SCHEME_KEY, damaged);
      expect(knownAccentScheme('emerald'), damaged).toBeNull();
    }

    expect(await loadAccentScheme('emerald')).toEqual(accentScheme('emerald'));
    expect(knownAccentScheme('emerald')).toEqual(accentScheme('emerald'));
  });

  it('paints the portal with a scheme', async () => {
    const scheme = await loadAccentScheme('emerald');
    applyScheme(scheme);

    expect($dt('primary.500').value).toBe('#10b981');
    expect(JSON.stringify($dt('md.primary').value)).toContain(scheme.light.primary);
  });
});
