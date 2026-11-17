import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { buttonByText, hostElement, requireElement, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { FieldErrors } from './field-errors';
import { TimeField } from './time-field';

@Component({
  imports: [TimeField, ReactiveFormsModule, FieldErrors],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form tbFieldErrors>
      <div class="tb-field">
        <label for="start">Начало</label>
        <tb-time-field inputId="start" [step]="15" [formControl]="time" />
      </div>
    </form>
  `,
})
class Host {
  readonly time = new FormControl<string | null>('13:00:00');
}

async function render(): Promise<{
  host: HTMLElement;
  component: Host;
  input: HTMLInputElement;
  opener: HTMLButtonElement;
  detect: () => Promise<void>;
}> {
  TestBed.configureTestingModule({ imports: [Host], providers: testProviders() });
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const host = hostElement(fixture);
  return {
    host,
    component: fixture.componentInstance,
    input: requireElement(host, 'tb-time-field input', HTMLInputElement),
    opener: requireElement(host, '.tb-typed-field__open', HTMLButtonElement),
    detect: async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    },
  };
}

function key(target: Element, name: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: name }));
}

describe('TimeField', () => {
  afterEach(() => {
    document.body.querySelectorAll('.p-dialog-mask').forEach((node) => {
      node.remove();
    });
  });

  it('shows the value, takes a typed time on Enter and formats it', async () => {
    const { component, input, opener, detect } = await render();
    expect(input.value).toBe('13:00');
    expect(input.id).toBe('start');
    expect(input.placeholder).toBe('ЧЧ:ММ');
    expect(opener.getAttribute('aria-label')).toBe('Выбрать время');

    typeInto(input, '1407');
    await detect();
    expect(component.time.value).toBe('13:00:00');
    key(input, 'Enter');
    await detect();
    expect(component.time.value).toBe('14:07');
    expect(input.value).toBe('14:07');
  });

  it('keeps text that is no time and shows the error; empty text is no time at all', async () => {
    const { host, component, input, detect } = await render();
    typeInto(input, '25:00');
    input.dispatchEvent(new Event('blur'));
    await detect();
    expect(input.value).toBe('25:00');
    expect(component.time.value).toBeNull();
    expect(component.time.touched).toBe(true);
    expect(host.querySelector('.tb-field__error')?.textContent).toBe('Введите время в виде ЧЧ:ММ');

    typeInto(input, '');
    input.dispatchEvent(new Event('blur'));
    await detect();
    expect(component.time.valid).toBe(true);
    expect(component.time.value).toBeNull();
  });

  it('opens the picker on its value and takes the picked time', async () => {
    const { component, input, opener, detect } = await render();
    typeInto(input, 'x');
    key(input, 'Enter');
    await detect();
    expect(component.time.invalid).toBe(true);
    component.time.setValue('09:30');
    await detect();
    opener.click();
    await detect();
    const parts = [...document.body.querySelectorAll('.tb-time-picker__part')];
    expect(parts.map((part) => part.textContent.trim())).toEqual(['09', '30']);
    key(requireElement(document.body, '.tb-time-picker__dial', HTMLElement), 'ArrowUp');
    buttonByText(document.body, 'ОК').click();
    await detect();
    expect(component.time.value).toBe('10:30');
    expect(input.value).toBe('10:30');
    expect(component.time.valid).toBe(true);
  });

  it('reads no value from a form that gives none, and is disabled with its control', async () => {
    const { component, input, opener, detect } = await render();
    component.time.setValue(null);
    component.time.disable();
    await detect();
    expect(input.value).toBe('');
    expect(input.disabled).toBe(true);
    expect(opener.disabled).toBe(true);
  });
});
