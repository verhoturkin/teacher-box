import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { buttonByText, hostElement, requireElement, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { TimePicker, dialValue } from './time-picker';

@Component({
  imports: [TimePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-time-picker [step]="15" (picked)="picked.push($event)" />`,
})
class Host {
  readonly picker = viewChild.required(TimePicker);
  readonly picked: string[] = [];
}

async function render(short = false): Promise<{
  component: Host;
  detect: () => Promise<void>;
}> {
  const shortWindow = {
    provide: BreakpointObserver,
    useValue: { observe: (query: string) => of({ matches: short && query.includes('height') }) },
  };
  TestBed.configureTestingModule({
    imports: [Host],
    providers: [...testProviders(), shortWindow],
  });
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  hostElement(fixture);
  return {
    component: fixture.componentInstance,
    detect: async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    },
  };
}

function dial(): HTMLElement {
  return requireElement(document.body, '.tb-time-picker__dial', HTMLElement);
}

function key(target: Element, name: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: name }));
}

function pointer(type: string, x: number, y: number): void {
  dial().dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
}

function parts(): string[] {
  return [...document.body.querySelectorAll('.tb-time-picker__part')].map((part) =>
    part.textContent.trim(),
  );
}

describe('dialValue', () => {
  it('reads hours of the outer ring (0–11) and the inner one (12–23)', () => {
    expect(dialValue(0, -101, 'hour', 5)).toBe(0);
    expect(dialValue(101, 0, 'hour', 5)).toBe(3);
    expect(dialValue(0, 101, 'hour', 5)).toBe(6);
    expect(dialValue(-101, 0, 'hour', 5)).toBe(9);
    expect(dialValue(0, -69, 'hour', 5)).toBe(12);
    expect(dialValue(-69, 0, 'hour', 5)).toBe(21);
  });

  it('snaps minutes to the step', () => {
    expect(dialValue(101, 0, 'minute', 5)).toBe(15);
    // 7 minutes past: 42°
    const x = Math.sin((42 * Math.PI) / 180) * 100;
    const y = -Math.cos((42 * Math.PI) / 180) * 100;
    expect(dialValue(x, y, 'minute', 5)).toBe(5);
    expect(dialValue(x, y, 'minute', 15)).toBe(0);
    // 58 minutes past goes round to 0
    expect(dialValue(-Math.sin((12 * Math.PI) / 180) * 100, -98, 'minute', 5)).toBe(0);
  });
});

describe('TimePicker', () => {
  beforeEach(() => {
    HTMLElement.prototype.setPointerCapture = vi.fn();
  });

  afterEach(() => {
    document.body.querySelectorAll('.p-dialog-mask').forEach((node) => {
      node.remove();
    });
  });

  it('opens on the dial, picks the hour and the minute by drag and gives the time on «ОК»', async () => {
    const { component, detect } = await render();
    component.picker().open('09:30');
    await detect();
    expect(document.body.querySelector('.tb-d__headline')?.textContent).toBe('Выберите время');
    expect(parts()).toEqual(['09', '30']);
    expect(dial().getAttribute('aria-valuetext')).toBe('9 часов из 24');
    expect(document.body.querySelector('.tb-time-picker__mark--on')?.textContent).toBe('9');

    // jsdom's dial box is at 0, 0 and has no size: the points are from its centre
    pointer('pointerdown', 0, -60);
    pointer('pointermove', 60, 0);
    await detect();
    expect(parts()).toEqual(['15', '30']);
    pointer('pointerup', 60, 0);
    await detect();
    expect(dial().getAttribute('aria-label')).toBe('Минута');
    expect(dial().getAttribute('aria-valuetext')).toBe('30 минут из 60');

    pointer('pointermove', 0, 100);
    await detect();
    expect(parts()).toEqual(['15', '30']);
    pointer('pointerdown', 100, 0);
    pointer('pointerup', 100, 0);
    await detect();
    expect(parts()).toEqual(['15', '15']);

    buttonByText(document.body, 'ОК').click();
    await detect();
    expect(component.picked).toEqual(['15:15']);
  });

  it('moves by an hour and the step with the arrows, Enter confirms the hour, then the time', async () => {
    const { component, detect } = await render();
    component.picker().open('23:07');
    await detect();
    key(dial(), 'ArrowUp');
    await detect();
    expect(parts()).toEqual(['00', '07']);
    key(dial(), 'ArrowLeft');
    key(dial(), 'Enter');
    await detect();
    expect(parts()).toEqual(['23', '07']);
    key(dial(), 'ArrowRight');
    await detect();
    expect(parts()).toEqual(['23', '15']);
    key(dial(), 'ArrowDown');
    key(dial(), 'ArrowDown');
    await detect();
    expect(parts()).toEqual(['23', '45']);
    key(dial(), 'Tab');
    key(dial(), 'Enter');
    await detect();
    expect(component.picked).toEqual(['23:45']);
    expect(document.body.querySelector('.tb-time-picker')).toBeNull();
  });

  it('switches to the input view, checks the fields and remembers the view', async () => {
    const { component, detect } = await render();
    component.picker().open(null);
    await detect();
    requireElement(document.body, '[aria-label="Ввести время с клавиатуры"]', HTMLElement).click();
    await detect();
    expect(document.body.querySelector('.tb-d__headline')?.textContent).toBe('Введите время');
    const hour = requireElement(document.body, 'input[aria-label="Час"]', HTMLInputElement);
    const minute = requireElement(document.body, 'input[aria-label="Минута"]', HTMLInputElement);
    expect(minute.value).toMatch(/^(00|15|30|45)$/);
    expect(document.body.querySelector('.tb-time-picker__input')?.textContent).toContain('Часы');

    typeInto(hour, '25');
    key(hour, 'Enter');
    await detect();
    expect(hour.getAttribute('aria-invalid')).toBe('true');
    requireElement(
      document.body,
      '[aria-label="Выбрать время на циферблате"]',
      HTMLElement,
    ).click();
    await detect();
    expect(document.body.querySelector('.tb-time-picker__dial')).toBeNull();
    expect(component.picked).toEqual([]);

    typeInto(hour, '8');
    typeInto(minute, '05');
    key(minute, 'Enter');
    await detect();
    expect(component.picked).toEqual(['08:05']);

    // the view chosen last opens next time; the dial again once chosen
    component.picker().open('08:05');
    await detect();
    expect(document.body.querySelector('.tb-time-picker__dial')).toBeNull();
    requireElement(
      document.body,
      '[aria-label="Выбрать время на циферблате"]',
      HTMLElement,
    ).click();
    await detect();
    expect(parts()).toEqual(['08', '05']);
    buttonByText(document.body, 'Отмена').click();
    await detect();
    expect(component.picked).toEqual(['08:05']);
  });

  it('unmounts its content when the dialog is gone, and mounts it again on the next open', async () => {
    const { component, detect } = await render();
    component.picker().open('10:00');
    await detect();
    expect(document.body.querySelector('.tb-time-picker__dial')).not.toBeNull();
    buttonByText(document.body, 'Отмена').click();
    await detect();
    expect(document.body.querySelector('.tb-time-picker__dial')).toBeNull();
    component.picker().open('11:00');
    await detect();
    expect(parts()).toEqual(['11', '00']);
  });

  it('is the input view alone in a short window', async () => {
    const { component, detect } = await render(true);
    component.picker().open('10:00');
    await detect();
    expect(document.body.querySelector('.tb-time-picker__dial')).toBeNull();
    expect(document.body.querySelector('[aria-label="Выбрать время на циферблате"]')).toBeNull();
    expect(requireElement(document.body, 'input[aria-label="Час"]', HTMLInputElement).value).toBe(
      '10',
    );
  });

  it('switches the dial between hours and minutes with the selectors', async () => {
    const { component, detect } = await render();
    component.picker().open('14:00');
    await detect();
    expect(dial().getAttribute('aria-valuetext')).toBe('14 часов из 24');
    expect(document.body.querySelector('.tb-time-picker__mark--on')?.textContent).toBe('14');
    buttonByText(document.body, '00').click();
    await detect();
    expect(dial().getAttribute('aria-label')).toBe('Минута');
    expect(document.body.querySelector('.tb-time-picker__mark--on')?.textContent).toBe('00');
    buttonByText(document.body, '14').click();
    await detect();
    expect(dial().getAttribute('aria-label')).toBe('Час');
  });
});
