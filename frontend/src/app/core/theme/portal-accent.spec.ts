import { applyAccent, isAccent } from './portal-accent';

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
});
