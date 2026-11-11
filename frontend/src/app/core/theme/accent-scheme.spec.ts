import { accentAdvice, accentScheme, accentSwatch } from './accent-scheme';
import { contrast } from './color';
import { ACCENTS, DEFAULT_OWN_COLOR } from './portal-accent';
import { DEFAULT_SCHEME } from './teacher-box-preset';

describe('accent scheme', () => {
  it('computes the scheme of a color, an unknown one in the default', () => {
    expect(accentScheme('emerald').primary['500']).toBe('#10b981');
    expect(accentScheme('gold')).toEqual(DEFAULT_SCHEME);
    expect(accentScheme('#fbc02d').primary['500']).toBe('#fbc02d');
    expect(contrast(accentScheme('#fbc02d').light.primary, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('marks a swatch with a readable color', () => {
    for (const { value } of ACCENTS) {
      const swatch = accentSwatch(value);
      expect(contrast(swatch.background, swatch.color), value).toBeGreaterThanOrEqual(4.5);
    }
    expect(accentSwatch(DEFAULT_OWN_COLOR).background).toBe(
      accentScheme(DEFAULT_OWN_COLOR).light.primaryContainer,
    );
  });

  it('keeps any color readable and says when it had to be darkened', () => {
    for (const accent of ['indigo', 'teal', '#fde68a', '#ff9800', '#1e1b4b']) {
      const advice = accentAdvice(accent);
      expect(advice.light).toBeGreaterThanOrEqual(4.5);
      expect(advice.dark).toBeGreaterThanOrEqual(4.5);
    }
    expect(accentAdvice('#fde68a').adjusted).toBe(true);
    expect(accentAdvice('indigo').adjusted).toBe(false);
  });

  it('knows a color that looks like the red buttons', () => {
    expect(accentAdvice('#e53935').likeError).toBe(true);
    expect(accentAdvice('emerald').likeError).toBe(false);
    expect(accentAdvice('indigo').likeError).toBe(false);
    expect(accentAdvice('#2563eb').likeError).toBe(false);
  });
});
