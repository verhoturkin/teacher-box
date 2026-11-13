import { TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { LoadingIndicator } from './loading-indicator';

class MotionPreference extends EventTarget implements MediaQueryList {
  matches = false;
  readonly media = '(prefers-reduced-motion: reduce)';
  onchange: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null = null;
  addListener(): void {
    /* Deprecated API. */
  }
  removeListener(): void {
    /* Deprecated API. */
  }
  change(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(Object.assign(new Event('change'), { matches }));
  }
}

describe('LoadingIndicator', () => {
  let frame: FrameRequestCallback | undefined;
  let media: MotionPreference;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    media = new MotionPreference();
    vi.spyOn(media, 'removeEventListener');
    vi.spyOn(window, 'matchMedia').mockReturnValue(media);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frame = callback;
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
    frame = undefined;
  });

  function render() {
    const fixture = TestBed.createComponent(LoadingIndicator);
    fixture.componentRef.setInput('ariaLabel', 'Loading students');
    fixture.detectChanges();
    frame = undefined;
    return { fixture, host: hostElement(fixture) };
  }

  it('waits 200 ms, then renders one labelled progressbar with a decorative SVG', () => {
    const { fixture, host } = render();
    expect(host.getAttribute('role')).toBeNull();
    expect(host.querySelector('svg')?.style.visibility).toBe('hidden');
    vi.advanceTimersByTime(199);
    expect(frame).toBeUndefined();
    vi.advanceTimersByTime(1);
    frame?.(performance.now());
    fixture.detectChanges();
    expect(host.getAttribute('role')).toBe('progressbar');
    expect(host.getAttribute('aria-label')).toBe('Loading students');
    expect(host.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('path')?.getAttribute('d')).toMatch(/^M.*C.*Z$/);
  });

  it.each([100, 199, 200])('cancels a load completed at %i ms before its first frame', (ms) => {
    const { fixture } = render();
    vi.advanceTimersByTime(ms);
    fixture.destroy();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('morphs and rotates, and cancels the frame and media listener on destruction', () => {
    const { fixture, host } = render();
    vi.advanceTimersByTime(200);
    const start = performance.now();
    frame?.(start);
    const path = host.querySelector('path')?.getAttribute('d');
    const transform = host.querySelector('g')?.getAttribute('transform');
    frame?.(start + 350);
    expect(host.querySelector('path')?.getAttribute('d')).not.toBe(path);
    expect(host.querySelector('g')?.getAttribute('transform')).not.toBe(transform);
    fixture.destroy();
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('holds a static shape under reduced motion and responds to preference changes', () => {
    media.matches = true;
    const { fixture, host } = render();
    vi.advanceTimersByTime(200);
    fixture.detectChanges();
    expect(host.getAttribute('role')).toBe('progressbar');
    const still = host.querySelector('path')?.getAttribute('d');
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(host.querySelector('path')?.getAttribute('d')).toBe(still);
    media.change(false);
    frame?.(performance.now() + 400);
    media.change(true);
    expect(host.querySelector('path')?.getAttribute('d')).toBe(still);
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});
