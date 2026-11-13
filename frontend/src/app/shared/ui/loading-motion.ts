import { LOADING_MORPHS, LOADING_SCALE } from './loading-geometry';

/** AndroidX LoadingIndicator: 650 ms morphs, 200 / 0.6 spring, 4666 ms global rotation. */
export function loadingFrame(elapsed: number): { path: string; transform: string } {
  const step = Math.floor(elapsed / 650);
  const seconds = (elapsed % 650) / 1000;
  const omega = Math.sqrt(200);
  const damped = omega * 0.8;
  const spring =
    1 -
    Math.exp(-0.6 * omega * seconds) *
      (Math.cos(damped * seconds) + 0.75 * Math.sin(damped * seconds));
  const progress = Math.max(0, Math.min(1, spring));
  const morph = LOADING_MORPHS[step % LOADING_MORPHS.length] ?? LOADING_MORPHS[0];
  const segments = morph.map((cubic) => cubic.map(([start, delta]) => start + delta * progress));
  const path =
    segments
      .map(
        (cubic, i) =>
          (i === 0 ? `M${cubic.slice(0, 2).join(',')} ` : '') + `C${cubic.slice(2).join(',')}`,
      )
      .join(' ') + 'Z';
  const angle = 90 + step * 90 + spring * 90 + (elapsed * 360) / 4666;
  return {
    path,
    transform: `translate(.5 .5) rotate(${String(angle)}) scale(${String(LOADING_SCALE)}) translate(-.5 -.5)`,
  };
}
