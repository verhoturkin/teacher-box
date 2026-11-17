import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { buttonByText, hostElement, requireElement, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { DateTimeField } from './date-time-field';
import { FieldErrors } from './field-errors';

const NOW = new Date(2026, 10, 17, 14, 32);

@Component({
  imports: [DateTimeField, ReactiveFormsModule, FieldErrors],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form tbFieldErrors>
      <div class="tb-field">
        <tb-date-time-field inputId="start" label="Начало" [minDate]="now" [formControl]="moment" />
      </div>
    </form>
  `,
})
class Host {
  readonly now = NOW;
  readonly moment = new FormControl<Date | null>(new Date(2026, 10, 18, 9, 5), [
    Validators.required,
  ]);
}

async function render(): Promise<{
  host: HTMLElement;
  component: Host;
  date: HTMLInputElement;
  time: HTMLInputElement;
  detect: () => Promise<void>;
}> {
  TestBed.configureTestingModule({ imports: [Host], providers: testProviders() });
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const host = hostElement(fixture);
  return {
    host,
    component: fixture.componentInstance,
    date: requireElement(host, '#start', HTMLInputElement),
    time: requireElement(host, '#start-time', HTMLInputElement),
    detect: async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    },
  };
}

/** Types a text into a field and leaves it, as a person does. */
async function enter(
  input: HTMLInputElement,
  text: string,
  detect: () => Promise<void>,
): Promise<void> {
  typeInto(input, text);
  input.dispatchEvent(new FocusEvent('blur'));
  input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  await detect();
}

describe('DateTimeField', () => {
  it('splits the value into a labelled date and time and joins them back', async () => {
    const { host, component, date, time, detect } = await render();
    expect(date.value).toBe('18.11.2026');
    expect(time.value).toBe('09:05');
    expect(requireElement(host, 'label[for="start"]', HTMLLabelElement).textContent).toBe('Начало');
    expect(requireElement(host, 'label[for="start-time"]', HTMLLabelElement).textContent).toBe(
      'Время',
    );

    await enter(time, '1430', detect);
    expect(component.moment.value).toEqual(new Date(2026, 10, 18, 14, 30));

    await enter(date, '20.11.2026', detect);
    expect(component.moment.value).toEqual(new Date(2026, 10, 20, 14, 30));
  });

  it('picks the day in the modal date picker and keeps the time', async () => {
    const { host, component, detect } = await render();
    requireElement(host, 'button[aria-label="Выбрать дату"]', HTMLButtonElement).click();
    await detect();
    await detect();
    const picker = requireElement(document.body, '.p-dialog .tb-date-picker', HTMLElement);
    expect(picker.getAttribute('aria-label')).toBe('Начало');
    requireElement(picker, '[data-date="2026-10-25"]', HTMLElement).click();
    await detect();
    buttonByText(document.body, 'ОК').click();
    await detect();
    expect(component.moment.value).toEqual(new Date(2026, 10, 25, 9, 5));
    expect(document.body.querySelector('.tb-date-picker')).toBeNull();
  });

  it('keeps no time before now today', async () => {
    const { host, component, date, time, detect } = await render();

    await enter(date, '17.11.2026', detect);
    await enter(time, '14:30', detect);
    expect(component.moment.value).toBeNull();
    expect(host.querySelector('.tb-field__error')?.textContent).toBe('Не раньше 14:35');
    expect(date.getAttribute('aria-invalid')).toBe('true');

    await enter(time, '14:35', detect);
    expect(component.moment.value).toEqual(new Date(2026, 10, 17, 14, 35));
    expect(host.querySelector('.tb-field__error')).toBeNull();
  });

  it('shows a wrong text under the row and has no value without a time', async () => {
    const { host, component, time, detect } = await render();

    await enter(time, 'утром', detect);
    expect(component.moment.value).toBeNull();
    expect(host.querySelector('.tb-field__error')?.textContent).toBe('Введите время в виде ЧЧ:ММ');
    expect(host.querySelector('.tb-field--required')).not.toBeNull();
  });

  it('is disabled with its control', async () => {
    const { component, date, time, detect } = await render();

    component.moment.disable();
    await detect();
    await detect(); // ngModel applies `disabled` a tick later
    expect(date.disabled).toBe(true);
    expect(time.disabled).toBe(true);

    component.moment.setValue(null);
    await detect();
    await detect();
    expect(date.value).toBe('');
    expect(time.value).toBe('');
  });
});
