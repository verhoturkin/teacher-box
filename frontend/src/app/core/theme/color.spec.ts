import { contrast, difference, isHex, readable, toHex, toOklch } from './color';

describe('color', () => {
  it('turns #rrggbb into OKLCH and back', () => {
    for (const hex of ['#4f46e5', '#0d9488', '#ffffff', '#000000', '#fbc02d', '#777777']) {
      expect(toHex(toOklch(hex))).toBe(hex);
    }
    expect(toOklch('#ffffff').l).toBeCloseTo(1, 3);
    expect(toOklch('#808080').c).toBeCloseTo(0, 3);
    expect(isHex('#0F766E')).toBe(true);
    expect(isHex('0f766e')).toBe(false);
  });

  it('keeps a color out of the sRGB gamut in it by reducing its chroma', () => {
    const hex = toHex({ l: 0.9, c: 0.4, h: 140 });

    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(toOklch(hex).l).toBeCloseTo(0.9, 2);
    expect(toHex({ l: 1.2, c: 0, h: 0 })).toBe('#ffffff');
  });

  it('measures the WCAG contrast and how different colors look', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#777777')).toBe(1);
    expect(difference('#dc2626', '#dc2626')).toBe(0);
    expect(difference('#dc2626', '#16a34a')).toBeGreaterThan(30);
  });

  it('makes a color readable on its grounds in its own hue', () => {
    const teal = readable('#0d9488', ['#ffffff'], 'darker');

    expect(contrast(teal, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(toOklch(teal).h).toBeCloseTo(toOklch('#0d9488').h, 0);
    expect(readable('#4f46e5', ['#ffffff'], 'darker')).toBe('#4f46e5');
    expect(contrast(readable('#1e1b4b', ['#111111'], 'lighter'), '#111111')).toBeGreaterThanOrEqual(
      4.5,
    );
    // no lightness is readable on a middle grey at 21:1: the last tried is returned
    expect(readable('#777777', ['#777777'], 'darker', 21)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
