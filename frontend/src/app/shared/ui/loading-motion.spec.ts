import { loadingFrame } from './loading-motion';

describe('Material loading motion', () => {
  it('renders all seven morphs and wraps back to the first without invalid coordinates', () => {
    for (let step = 0; step < 7; step++) {
      for (const progress of [0, 100, 250, 400, 649]) {
        const frame = loadingFrame(step * 650 + progress);
        expect(frame.path).toMatch(/^M.*C.*Z$/);
        expect(frame.path).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
    expect(loadingFrame(7 * 650).path).toBe(loadingFrame(0).path);
  });

  it('uses the AndroidX spring, clockwise rotation and uniform rotation-safe scale', () => {
    const start = loadingFrame(0);
    const middle = loadingFrame(325);
    expect(start.transform).toContain('rotate(90)');
    expect(middle.transform).not.toBe(start.transform);
    expect(middle.path).not.toBe(start.path);
    expect(start.transform).toContain('scale(0.6852541768130452)');
  });
});
