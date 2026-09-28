import {
  applyAccent,
  contrast,
  isAccent,
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

  it('measures the contrast of the text on buttons', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#777777')).toBe(1);
    const light = ownColorContrast('#fde68a');
    expect(light.light).toBeLessThan(3);
    expect(ownColorContrast('#1e1b4b').dark).toBeLessThan(3);
    expect(ownColorContrast('#0f766e').light).toBeGreaterThan(3);
  });
});
