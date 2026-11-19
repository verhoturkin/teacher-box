import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { hostElement, requireElement } from '@testing/dom';
import { screenWidth } from '@testing/setup';
import { PaneHandle } from './pane-handle';
import { Pane, PaneKind, Panes } from './panes';

@Component({
  selector: 'tb-resizable-host',
  imports: [Panes, Pane],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      <tb-pane [kind]="kind()" resizeKey="students" label="Список">Список</tb-pane>
      <tb-pane>Карточка</tb-pane>
    </tb-panes>
  `,
})
class ResizableHost {
  readonly kind = signal<PaneKind>('fixed');
}

@Component({
  selector: 'tb-docked-host',
  imports: [PaneHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="body">
      <main #page>Страница</main>
      <div class="host">
        <aside #pane id="sheet">Уведомления</aside>
        <tb-pane-handle [pane]="pane" resizeKey="sheet" controls="sheet" [beside]="page" />
      </div>
    </div>
  `,
})
class DockedHost {}

const KEY = 'tb.pane-width.018f0000-0000-7000-8000-000000000001.students';

/** A layout: the panes 1200 px wide from x = 0, the fixed pane `width` px, the handle right of it. */
function lay(host: HTMLElement, width = 400): void {
  const panes = requireElement(host, 'tb-panes', HTMLElement);
  const [fixed, flexible] = Array.from(panes.querySelectorAll<HTMLElement>('tb-pane'));
  const zone = host.querySelector('[role="separator"]');
  Object.defineProperty(panes, 'clientWidth', { configurable: true, value: 1200 });
  const box = (left: number, w: number) => () => new DOMRect(left, 0, w, 600);
  if (fixed && flexible && zone) {
    fixed.getBoundingClientRect = box(0, width);
    flexible.getBoundingClientRect = box(width + 24, 1200 - width - 24);
    zone.getBoundingClientRect = box(width - 8, 40);
  }
}

describe('PaneHandle', () => {
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    localStorage.clear();
    frames = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1100);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function render(width = 1280) {
    TestBed.configureTestingModule({ providers: [screenWidth(width)] });
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    const fixture = TestBed.createComponent(ResizableHost);
    await fixture.whenStable();
    const host = hostElement(fixture);
    const pane = requireElement(host, 'tb-pane', HTMLElement);
    const zone = host.querySelector<HTMLElement>('[role="separator"]');
    if (zone) {
      zone.setPointerCapture = () => undefined;
    }
    lay(host);
    return { fixture, host, pane, zone };
  }

  function pointer(type: string, clientX: number): MouseEvent {
    const event = new MouseEvent(type, { clientX, button: 0, bubbles: true });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    return event;
  }

  function key(zone: HTMLElement, name: string): void {
    zone.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  }

  function width(pane: HTMLElement): string {
    return pane.style.getPropertyValue('--tb-pane-width');
  }

  it('is a named separator of the fixed pane with its limits in px', async () => {
    const { pane, zone } = await render();

    expect(zone?.getAttribute('aria-label')).toBe('Изменить ширину панели');
    expect(zone?.getAttribute('aria-orientation')).toBe('vertical');
    expect(zone?.getAttribute('aria-controls')).toBe(pane.id);
    zone?.dispatchEvent(new FocusEvent('focus'));
    TestBed.tick();
    expect(zone?.getAttribute('aria-valuenow')).toBe('400');
    expect(zone?.getAttribute('aria-valuemin')).toBe('360');
    // half of the panes (600) is less than leaving the flexible pane 360 (400 + 776 − 360)
    expect(zone?.getAttribute('aria-valuemax')).toBe('600');
    expect(pane.style.flexBasis).toContain('--tb-pane-width');
  });

  it.each([599, 600, 839])(
    'has no handle at %i px: the panes do not stand side by side',
    async (w) => {
      const { zone } = await render(w);

      expect(zone).toBeNull();
    },
  );

  it('resizes a side sheet too, without its 400 dp cap', async () => {
    const { fixture, host, pane } = await render();
    fixture.componentInstance.kind.set('sheet');
    await fixture.whenStable();

    expect(host.querySelector('[role="separator"]')).not.toBeNull();
    expect(pane.style.flexBasis).toContain('--tb-pane-width');
    expect(pane.style.maxWidth).toBe('');
  });

  it('has no handle on a flexible pane', async () => {
    const { fixture, host } = await render();
    fixture.componentInstance.kind.set('flexible');
    await fixture.whenStable();

    expect(host.querySelector('[role="separator"]')).toBeNull();
  });

  it('follows the pointer once a frame, clamps to the limits and keeps the dropped width', async () => {
    const { host, pane, zone } = await render();
    const panes = requireElement(host, 'tb-panes', HTMLElement);

    zone?.dispatchEvent(pointer('pointerdown', 400));
    expect(panes.classList).toContain('tb-panes--resizing');
    const before = frames.length;
    zone?.dispatchEvent(pointer('pointermove', 450));
    zone?.dispatchEvent(pointer('pointermove', 500));
    expect(frames).toHaveLength(before + 1);
    expect(width(pane)).toBe('');
    frames.at(-1)?.(0);
    expect(width(pane)).toBe('500px');
    zone?.dispatchEvent(pointer('pointermove', 900));
    frames.at(-1)?.(0);
    expect(width(pane)).toBe('600px');
    zone?.dispatchEvent(pointer('pointermove', 500));
    zone?.dispatchEvent(pointer('pointerup', 500));

    expect(panes.classList).not.toContain('tb-panes--resizing');
    expect(width(pane)).toBe('500px');
    expect(localStorage.getItem(KEY)).toBe('500');
  });

  it.each([
    [380, '360px'],
    [430, '412px'],
    [540, '550px'],
  ])('snaps a drop at %i px within 24 dp to an M3 width', async (x, expected) => {
    const { pane, zone } = await render();

    zone?.dispatchEvent(pointer('pointerdown', 400));
    zone?.dispatchEvent(pointer('pointermove', x));
    zone?.dispatchEvent(pointer('pointerup', x));

    // the centred split: the spacer in the middle of the 1100 px window (jsdom has no gap) — 550
    expect(width(pane)).toBe(expected);
  });

  it('ignores a secondary button', async () => {
    const { pane, zone } = await render();
    const event = new MouseEvent('pointerdown', { clientX: 400, button: 2 });

    zone?.dispatchEvent(event);
    zone?.dispatchEvent(pointer('pointerup', 500));

    expect(width(pane)).toBe('');
  });

  it('moves by 16 dp with the arrows and to the limits with Home and End', async () => {
    const { pane, zone } = await render();
    if (!zone) {
      throw new Error('no handle');
    }

    key(zone, 'ArrowRight');
    expect(width(pane)).toBe('416px');
    key(zone, 'ArrowLeft');
    key(zone, 'ArrowLeft');
    expect(width(pane)).toBe('384px');
    key(zone, 'End');
    expect(width(pane)).toBe('600px');
    key(zone, 'Home');
    expect(width(pane)).toBe('360px');
    key(zone, 'a');
    expect(width(pane)).toBe('360px');
  });

  it('mirrors the arrows when the handle is left of the pane', async () => {
    const { pane, zone } = await render();
    if (!zone) {
      throw new Error('no handle');
    }
    zone.getBoundingClientRect = () => new DOMRect(-32, 0, 40, 600);

    key(zone, 'ArrowLeft');

    expect(width(pane)).toBe('416px');
  });

  it('switches between the default width and the last one set with a double click or Enter', async () => {
    const { pane, zone } = await render();
    if (!zone) {
      throw new Error('no handle');
    }

    zone.dispatchEvent(new MouseEvent('dblclick'));
    expect(width(pane)).toBe('');
    key(zone, 'End');
    zone.dispatchEvent(new MouseEvent('dblclick'));
    expect(width(pane)).toBe('');
    expect(zone.getAttribute('aria-valuenow')).not.toBe('600');
    expect(localStorage.getItem(KEY)).toBeNull();
    key(zone, 'Enter');
    expect(width(pane)).toBe('600px');
    expect(localStorage.getItem(KEY)).toBe('600');
  });

  it('reads the width of this user and page before the first render and ignores a broken one', async () => {
    localStorage.setItem(KEY, '480');
    localStorage.setItem(KEY.replace('students', 'help'), '700');
    const { pane } = await render();
    expect(width(pane)).toBe('480px');

    TestBed.resetTestingModule();
    localStorage.setItem(KEY, 'wide');
    const again = await render();
    expect(width(again.pane)).toBe('');
  });

  it('keeps the width for the page when storage is off', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('off');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('off');
    });
    const { pane, zone } = await render();
    if (!zone) {
      throw new Error('no handle');
    }

    key(zone, 'End');

    expect(width(pane)).toBe('600px');
  });

  it('stops a drag when the pane goes away', async () => {
    const { fixture, host, zone } = await render();
    zone?.dispatchEvent(pointer('pointerdown', 400));
    zone?.dispatchEvent(pointer('pointermove', 450));
    fixture.destroy();

    expect(host.querySelector('tb-panes')?.classList ?? []).not.toContain('tb-panes--resizing');
  });

  it('gives way with the element beside it when that is not a pane (the docked notifications)', async () => {
    TestBed.configureTestingModule({ providers: [screenWidth(1600)] });
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    const fixture = TestBed.createComponent(DockedHost);
    await fixture.whenStable();
    const host = hostElement(fixture);
    const body = requireElement(host, '.body', HTMLElement);
    const zone = requireElement(host, '[role="separator"]', HTMLElement);
    Object.defineProperty(body, 'clientWidth', { configurable: true, value: 1600 });
    requireElement(host, 'aside', HTMLElement).getBoundingClientRect = () =>
      new DOMRect(1176, 0, 400, 600);
    requireElement(host, 'main', HTMLElement).getBoundingClientRect = () =>
      new DOMRect(0, 0, 500, 600);
    zone.getBoundingClientRect = () => new DOMRect(1144, 0, 40, 600);

    zone.dispatchEvent(new FocusEvent('focus'));
    TestBed.tick();

    // the page leaves 360: 400 + 500 − 360, less than half the body (800)
    expect(zone.getAttribute('aria-valuemax')).toBe('540');
  });
});
