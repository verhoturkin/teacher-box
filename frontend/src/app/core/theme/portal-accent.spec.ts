import { contrast } from './color';
import {
  accentAdvice,
  accentShades,
  applyAccent,
  isAccent,
  isOwnColor,
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

  it('paints the portal with the scheme of its color, an unknown one in the default', () => {
    expect(applyAccent('emerald').primary['500']).toBe('#10b981');
    expect(applyAccent('gold').primary['500']).toBe('#6366f1');
    expect(accentShades('indigo')['600']).toBe('#4f46e5');
  });

  it('builds the shades of an own color', () => {
    expect(isOwnColor('#0F766E')).toBe(true);
    expect(isOwnColor('#0f766')).toBe(false);
    const scheme = applyAccent('#0F766E');
    expect(Object.keys(scheme.primary)).toHaveLength(11);
    expect(scheme.primary['500']).toBe('#0f766e');
    expect(ownShades('#0f766e')['50']).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('keeps any color readable and says when it had to be darkened', () => {
    for (const accent of ['indigo', 'teal', '#fde68a', '#ff9800', '#1e1b4b']) {
      const advice = accentAdvice(accent);
      expect(advice.light).toBeGreaterThanOrEqual(4.5);
      expect(advice.dark).toBeGreaterThanOrEqual(4.5);
    }
    expect(accentAdvice('#fde68a').adjusted).toBe(true);
    expect(accentAdvice('indigo').adjusted).toBe(false);
    expect(contrast(applyAccent('#fbc02d').light.primary, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('knows a color that looks like the green or the red buttons', () => {
    expect(accentAdvice('emerald').likeSuccess).toBe(true);
    expect(accentAdvice('#2e7d32').likeSuccess).toBe(true);
    expect(accentAdvice('#e53935').likeError).toBe(true);
    expect(accentAdvice('indigo').likeSuccess).toBe(false);
    expect(accentAdvice('indigo').likeError).toBe(false);
    expect(accentAdvice('#2563eb').likeError).toBe(false);
  });
});
