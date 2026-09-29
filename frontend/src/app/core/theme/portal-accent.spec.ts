import {
  applyAccent,
  contrast,
  isAccent,
  isGreenAccent,
  isOwnColor,
  ownColorContrast,
  ownShades,
} from './portal-accent';

describe('portal accent', () => {
  afterEach(() => {
    applyAccent('indigo');
  });

  it('knows the colors of the portal', () => {
    expect(isAccent('emerald')).toBe(true);
    expect(isAccent('gold')).toBe(false);
  });

  it('paints the primary palette in the color, an unknown one in the default', () => {
    expect(applyAccent('emerald')).toEqual(expect.objectContaining({ 500: '{emerald.500}' }));
    expect(Object.keys(applyAccent('emerald'))).toHaveLength(11);
    expect(applyAccent('gold')).toEqual(expect.objectContaining({ 50: '{indigo.50}' }));
  });

  it('builds the shades of an own color', () => {
    expect(isOwnColor('#0F766E')).toBe(true);
    expect(isOwnColor('#0f766')).toBe(false);
    const shades = applyAccent('#0F766E');
    expect(Object.keys(shades)).toHaveLength(11);
    expect(shades['500']).toBe('#0f766e');
    expect(ownShades('#0f766e')['50']).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('measures the contrast of the text on filled buttons (M3 roles)', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#777777')).toBe(1);
    // light: white on the shade 600 — a pale color is poorly readable
    expect(ownColorContrast('#fde68a').light).toBeLessThan(3);
    expect(ownColorContrast('#0f766e').light).toBeGreaterThan(3);
    // dark: the shade 900 on the shade 200 — readable even for a very dark or a pale color
    expect(ownColorContrast('#1e1b4b').dark).toBeGreaterThan(3);
    expect(ownColorContrast('#fde68a').dark).toBeGreaterThan(3);
  });

  it('knows a green color of the portal that looks like confirming buttons', () => {
    expect(isGreenAccent('emerald')).toBe(true);
    expect(isGreenAccent('#16a34a')).toBe(true);
    expect(isGreenAccent('#65a30d')).toBe(true);
    // teal, blue, red, a greyish green and a named palette that is not green
    expect(isGreenAccent('#0f766e')).toBe(false);
    expect(isGreenAccent('#2563eb')).toBe(false);
    expect(isGreenAccent('#dc2626')).toBe(false);
    expect(isGreenAccent('#6b7a6b')).toBe(false);
    expect(isGreenAccent('#808080')).toBe(false);
    expect(isGreenAccent('indigo')).toBe(false);
  });
});
