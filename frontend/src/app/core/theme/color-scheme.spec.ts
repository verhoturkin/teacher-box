import { Hct, SchemeFidelity, argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import { contrast } from './color';
import { Shades, auraPalette, colorScheme, lowestContrast, textPairs } from './color-scheme';
import { ownShades } from './portal-accent';

const NAMED = ['indigo', 'blue', 'teal', 'emerald', 'violet', 'pink'];
const OWN = ['#0f766e', '#2e7d32', '#fbc02d', '#1565c0', '#e53935', '#ff9800', '#fde68a'];
const CASES: [string, Shades][] = [
  ...NAMED.map((name): [string, Shades] => [name, auraPalette(name)]),
  ...OWN.map((color): [string, Shades] => [color, ownShades(color)]),
];

describe('color scheme', () => {
  it.each(CASES)('keeps every text of %s readable in both themes', (_name, shades) => {
    const scheme = colorScheme(shades);

    for (const roles of [scheme.light, scheme.dark]) {
      for (const [pair, text, ground] of textPairs(roles)) {
        expect.soft(contrast(text, ground), pair).toBeGreaterThanOrEqual(4.5);
      }
      expect(lowestContrast(roles)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('takes the roles from the M3 Fidelity scheme of the color', () => {
    const seed = Hct.fromInt(argbFromHex(auraPalette('indigo')['500'] ?? ''));
    const light = new SchemeFidelity(seed, false, 0, '2025');
    const dark = new SchemeFidelity(seed, true, 0, '2025');
    const scheme = colorScheme(auraPalette('indigo'));

    expect(scheme.light.primary).toBe('#4648d4');
    expect(scheme.light.primaryContainer).toBe(hexFromArgb(light.primaryContainer));
    expect(scheme.light.surfaceContainer).toBe(hexFromArgb(light.surfaceContainer));
    expect(scheme.light.error).toBe(hexFromArgb(light.error));
    expect(scheme.dark.primary).toBe(hexFromArgb(dark.primary));
    expect(scheme.dark.surface).toBe(hexFromArgb(dark.surface));
    expect(scheme.neutral['950']).toBe(hexFromArgb(light.neutralPalette.tone(10)));
    // success and warning: Aura green and amber harmonized with the seed, M3 custom-color tones
    expect(scheme.light.success).not.toBe(scheme.light.warning);
  });

  it('computes every role as a ready color: no oklch(from) for the browser', () => {
    const scheme = colorScheme(auraPalette('violet'));

    for (const value of [
      ...Object.values(scheme.light),
      ...Object.values(scheme.dark),
      ...Object.values(scheme.neutral),
    ]) {
      expect(value).toMatch(/^(#[0-9a-f]{6}|rgb\(0 0 0 \/ 32%\))$/);
    }
  });

  it('knows the palettes of Aura', () => {
    expect(auraPalette('amber')['700']).toBe('#b45309');
    expect(() => auraPalette('gold')).toThrow();
  });
});
