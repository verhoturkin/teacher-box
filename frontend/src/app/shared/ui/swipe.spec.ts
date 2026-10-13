import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { testProviders } from '@testing/setup';
import { hostElement } from '@testing/dom';
import { SWIPE_RESTORE_MS, Swipe } from './swipe';

@Component({
  imports: [Swipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul>
      <li [tbSwipe]="enabled()" (tbSwiped)="swiped.set(swiped() + 1)">
        <button type="button" (click)="clicked.set(clicked() + 1)">Открыть</button>
      </li>
    </ul>
  `,
})
class Host {
  readonly enabled = signal(true);
  readonly swiped = signal(0);
  readonly clicked = signal(0);
}

/** A pointer event of a finger (jsdom has no PointerEvent). */
function pointer(type: string, x: number, y = 0, pointerType = 'touch'): Event {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperties(event, {
    pointerType: { value: pointerType },
    pointerId: { value: 1 },
  });
  return event;
}

describe('Swipe', () => {
  let fixture: ComponentFixture<Host>;
  let row: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: testProviders() });
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const found = hostElement(fixture).querySelector('li');
    if (found === null) {
      throw new Error('no row');
    }
    row = found;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  function drag(...points: readonly [number, number][]): void {
    const [first, ...rest] = points;
    row.dispatchEvent(pointer('pointerdown', first?.[0] ?? 0, first?.[1] ?? 0));
    for (const [x, y] of rest) {
      row.dispatchEvent(pointer('pointermove', x, y));
    }
    fixture.detectChanges();
  }

  function release(): void {
    row.dispatchEvent(pointer('pointerup', 0));
    fixture.detectChanges();
  }

  it('follows the finger sideways and keeps the vertical scroll to the page', () => {
    expect(row.classList).toContain('tb-swipe');
    expect(row.style.touchAction).toBe('pan-y');

    drag([10, 0], [40, 2]);

    expect(row.style.transform).toBe('translateX(30px)');
    expect(row.classList).toContain('tb-swipe--dragging');
    expect(Number(row.style.opacity)).toBeLessThan(1);
  });

  it('comes back when let go too early', () => {
    drag([10, 0], [40, 0]);
    release();

    expect(fixture.componentInstance.swiped()).toBe(0);
    expect(row.style.transform).toBe('');
    expect(row.classList).not.toContain('tb-swipe--dragging');
  });

  it('fires when moved far enough, slides out and comes back if the row stays', () => {
    drag([200, 0], [100, 0], [20, 0]);
    release();

    expect(fixture.componentInstance.swiped()).toBe(1);
    expect(row.style.transform).toBe('translateX(-128px)');

    vi.advanceTimersByTime(SWIPE_RESTORE_MS);
    fixture.detectChanges();
    expect(row.style.transform).toBe('');
  });

  it('opens nothing with the click that ends a swipe, a tap still clicks', () => {
    drag([0, 0], [150, 0]);
    release();
    row.querySelector('button')?.click();
    expect(fixture.componentInstance.clicked()).toBe(0);

    drag([0, 0], [3, 0]);
    release();
    row.querySelector('button')?.click();
    expect(fixture.componentInstance.clicked()).toBe(1);
    expect(fixture.componentInstance.swiped()).toBe(1);
  });

  it('leaves a scroll, a mouse, another finger and a disabled row alone', () => {
    drag([0, 0], [20, 60], [200, 60]);
    release();
    expect(row.style.transform).toBe('');

    row.dispatchEvent(pointer('pointerdown', 0, 0, 'mouse'));
    row.dispatchEvent(pointer('pointermove', 200, 0, 'mouse'));
    release();

    drag([0, 0], [100, 0]);
    row.dispatchEvent(pointer('pointercancel', 0));
    fixture.detectChanges();
    expect(row.style.transform).toBe('');

    fixture.componentInstance.enabled.set(false);
    fixture.detectChanges();
    expect(row.style.touchAction).toBe('');
    drag([0, 0], [200, 0]);
    release();
    expect(fixture.componentInstance.swiped()).toBe(0);
  });
});
