import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ListRow, ROW_ENTER, ROW_LEAVE } from './list-row';

@Component({
  imports: [ListRow],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul>
      @for (row of rows(); track row) {
        <li tbListRow>{{ row }}</li>
      }
    </ul>
  `,
})
class Host {
  readonly rows = signal(['a', 'b']);
}

async function render(settle = true) {
  const fixture = TestBed.createComponent(Host);
  if (settle) {
    await fixture.whenStable();
  } else {
    // the first render without its after-render hooks: the moment Angular calls `enter` of its rows
    fixture.componentRef.changeDetectorRef.detectChanges();
  }
  const row = (index: number) => {
    const debug = fixture.debugElement.queryAll(By.directive(ListRow))[index]!;
    const element: unknown = debug.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('no row');
    }
    // jsdom gives Angular no animations, so the test plays its part: it calls the row's callbacks
    return { element, callbacks: debug.injector.get(ListRow) };
  };
  return { fixture, row };
}

function end(row: HTMLElement, animationName: string, target: Element = row): void {
  const event = new Event('animationend', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: animationName });
  target.dispatchEvent(event);
}

describe('ListRow', () => {
  it('keeps the rows of the first render still', async () => {
    const { row } = await render(false);
    const { element, callbacks } = row(0);
    const animationComplete = vi.fn();

    callbacks.enter({ animationComplete });

    expect(element.classList.contains(ROW_ENTER)).toBe(false);
    expect(animationComplete).toHaveBeenCalledOnce();
  });

  it('opens a row added later and drops the class once its height has opened', async () => {
    const { fixture, row } = await render();
    fixture.componentInstance.rows.update((items) => ['new', ...items]);
    await fixture.whenStable();
    const { element, callbacks } = row(0);
    const animationComplete = vi.fn();
    const child = element.appendChild(document.createElement('span'));

    callbacks.enter({ animationComplete });
    expect(element.classList.contains(ROW_ENTER)).toBe(true);
    expect(element.style.getPropertyValue('--tb-motion-height')).toBe('0px');

    end(element, 'tb-motion-fade-in');
    end(element, 'tb-motion-row-open', child);
    expect(element.classList.contains(ROW_ENTER)).toBe(true);
    expect(animationComplete).not.toHaveBeenCalled();

    end(element, 'tb-motion-row-open');
    expect(element.classList.contains(ROW_ENTER)).toBe(false);
    expect(animationComplete).toHaveBeenCalledOnce();
  });

  it('measures a leaving row and gives it the closing class', async () => {
    const { row } = await render();
    const { element, callbacks } = row(1);

    callbacks.leave();

    expect(element.classList.contains(ROW_LEAVE)).toBe(true);
    expect(element.style.getPropertyValue('--tb-motion-height')).toBe('0px');
  });
});
