import { TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { WavyProgress } from './wavy-progress';

describe('WavyProgress', () => {
  async function render(value: number): Promise<HTMLElement> {
    TestBed.configureTestingModule({ imports: [WavyProgress], providers: testProviders() });
    const fixture = TestBed.createComponent(WavyProgress);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('label', 'Прошло 35 из 60 мин');
    await fixture.whenStable();
    return hostElement(fixture);
  }

  it('is a named progress bar with its value and the track after the wave', async () => {
    const host = await render(58.4);

    expect(host.getAttribute('role')).toBe('progressbar');
    expect(host.getAttribute('aria-label')).toBe('Прошло 35 из 60 мин');
    expect(host.getAttribute('aria-valuenow')).toBe('58');
    expect(host.querySelector<HTMLElement>('.tb-wavy__active')?.style.inlineSize).toBe('58%');
    expect(host.querySelector('.tb-wavy__track')).not.toBeNull();
  });

  it('draws the wave as a dash of the active width less its two round caps', async () => {
    const staticObserver = window.ResizeObserver;
    type Report = (entries: readonly { contentRect: { width: number } }[]) => void;
    let report: Report = () => undefined;
    let observed = 0;
    // test-setup defines it writable, not configurable
    Reflect.set(
      window,
      'ResizeObserver',
      class {
        constructor(callback: Report) {
          report = callback;
        }
        observe(): void {
          observed++;
        }
        disconnect(): void {
          observed--;
        }
      },
    );
    try {
      const host = await render(50);
      const wave = host.querySelector<SVGPathElement>('.tb-wavy__wave');
      // jsdom lays nothing out: the first measure is 0, the wave a dot
      expect(wave?.style.strokeDasharray).toMatch(/^0(px)?,? 8000/);

      expect(observed).toBe(1);
      report([{ contentRect: { width: 200 } }]);
      TestBed.tick();

      expect(wave?.style.strokeDasharray).toMatch(/^196(px)?,? 8000/);
    } finally {
      Reflect.set(window, 'ResizeObserver', staticObserver);
    }
  });

  it('keeps the value within 0–100 and drops the track when done', async () => {
    const host = await render(140);

    expect(host.getAttribute('aria-valuenow')).toBe('100');
    expect(host.querySelector('.tb-wavy__track')).toBeNull();
  });
});
