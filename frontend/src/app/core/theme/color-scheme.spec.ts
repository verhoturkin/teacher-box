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

  it('keeps the default indigo as it was and darkens the pale palettes', () => {
    expect(colorScheme(auraPalette('indigo')).light.primary).toBe('#4f46e5');
    expect(colorScheme(auraPalette('teal')).light.primary).not.toBe('#0d9488');
    expect(colorScheme(auraPalette('indigo')).light.error).toBe('#b91c1c');
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
