import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { buttonByText, hostElement, requireElement, typeInto } from '@testing/dom';
import { screenWidth, testProviders } from '@testing/setup';
import { DateField } from './date-field';
import { FieldErrors } from './field-errors';

@Component({
  imports: [DateField, ReactiveFormsModule, FieldErrors],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form tbFieldErrors>
      <div class="tb-field">
        <label for="day">Дата</label>
        <tb-date-field
          inputId="day"
          label="Дата"
          [formControl]="date"
          [minDate]="min()"
          [maxDate]="max()"
          [month]="month()"
        />
      </div>
    </form>
  `,
})
class Host {
  readonly date = new FormControl<Date | null>(new Date(2026, 7, 17));
  readonly min = signal<Date | null>(null);
  readonly max = signal<Date | null>(null);
  readonly month = signal(false);
}

interface Rendered {
  host: HTMLElement;
  component: Host;
  input: HTMLInputElement;
  opener: HTMLButtonElement;
  detect: () => Promise<void>;
  grid: () => DatePicker;
  /** Opens the modal picker; jsdom plays no motion, so the dialog is told it is shown. */
  open: () => Promise<void>;
}

async function render(width = 1024, setup?: (host: Host) => void): Promise<Rendered> {
  TestBed.configureTestingModule({ imports: [Host], providers: testProviders(screenWidth(width)) });
  const fixture = TestBed.createComponent(Host);
  setup?.(fixture.componentInstance);
  await fixture.whenStable();
  const host = hostElement(fixture);
  const opener = requireElement(host, '.tb-typed-field__open', HTMLButtonElement);
  return {
    host,
    component: fixture.componentInstance,
    input: requireElement(host, 'tb-date-field input', HTMLInputElement),
    opener,
    detect: async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    },
    grid: () => fixture.debugElement.query(By.directive(DatePicker)).injector.get(DatePicker),
    open: async () => {
      opener.click();
      // the grid takes its `ngModel` a tick later
      for (let pass = 0; pass < 2; pass++) {
        fixture.detectChanges();
        await fixture.whenStable();
      }
      fixture.debugElement.query(By.directive(Dialog)).injector.get(Dialog).onShow.emit({});
      await fixture.whenStable();
    },
  };
}

function key(target: Element, init: KeyboardEventInit): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
}

function panel(): HTMLElement {
  return requireElement(document.body, '.tb-date-picker', HTMLElement);
}

function day(date: string): HTMLElement {
  return requireElement(panel(), `[data-date="${date}"]`, HTMLElement);
}

describe('DateField', () => {
  afterEach(() => {
    document.body.querySelectorAll('.p-overlay, .p-dialog-mask').forEach((node) => {
      node.remove();
    });
  });

  it('shows the value, takes a typed date on Enter and formats it', async () => {
    const { component, input, opener, detect } = await render();
    expect(input.value).toBe('17.08.2026');
    expect(input.id).toBe('day');
    expect(input.placeholder).toBe('ДД.ММ.ГГГГ');
    expect(opener.getAttribute('aria-label')).toBe('Выбрать дату');

    typeInto(input, '1/9/26');
    await detect();
    expect(component.date.value).toEqual(new Date(2026, 7, 17));
    key(input, { key: 'Enter' });
    await detect();
    expect(component.date.value).toEqual(new Date(2026, 8, 1));
    expect(input.value).toBe('01.09.2026');
  });

  it('keeps text that is no date and shows the error; empty text is no date at all', async () => {
    const { host, component, input, detect } = await render();
    typeInto(input, '31.02.2026');
    input.dispatchEvent(new Event('blur'));
    await detect();
    expect(input.value).toBe('31.02.2026');
    expect(component.date.value).toBeNull();
    expect(component.date.touched).toBe(true);
    expect(host.querySelector('.tb-field__error')?.textContent).toBe(
      'Введите дату в виде ДД.ММ.ГГГГ',
    );
    expect(input.getAttribute('aria-invalid')).toBe('true');

    typeInto(input, '');
    input.dispatchEvent(new Event('blur'));
    await detect();
    expect(component.date.valid).toBe(true);
    expect(component.date.value).toBeNull();
  });

  it('says a date out of the bounds is wrong', async () => {
    const { host, component, input, detect } = await render(1024, (page) => {
      page.min.set(new Date(2026, 7, 10));
      page.max.set(new Date(2026, 7, 20));
    });
    typeInto(input, '9.8.2026');
    input.dispatchEvent(new Event('blur'));
    await detect();
    expect(host.querySelector('.tb-field__error')?.textContent).toBe('Не раньше 10.08.2026');
    typeInto(input, '21.8.2026');
    input.dispatchEvent(new Event('blur'));
    await detect();
    expect(host.querySelector('.tb-field__error')?.textContent).toBe('Не позже 20.08.2026');
    typeInto(input, '20.8.2026');
    input.dispatchEvent(new Event('blur'));
    await detect();
    expect(component.date.valid).toBe(true);
  });

  it('opens the modal picker on the chosen day, names each day in full, keeps one by «ОК»', async () => {
    const { component, input, opener, detect, open } = await render();
    await open();
    expect(opener.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.querySelector('.p-dialog')?.getAttribute('role')).toBe('alertdialog');
    expect(document.body.querySelector('.tb-d__headline')?.textContent).toBe('Выберите дату');
    expect(document.body.querySelector('.tb-date-field__chosen')?.textContent).toBe('пн, 17 авг.');
    expect(panel().getAttribute('aria-label')).toBe('Дата');
    expect(document.activeElement).toBe(day('2026-7-17'));
    expect(panel().querySelector('.p-datepicker-header')).not.toBeNull();
    expect(buttonByText(panel(), 'Месяц: август').getAttribute('aria-expanded')).toBe('false');
    expect(buttonByText(panel(), 'Год: 2026').textContent).toContain('2026');
    expect(day('2026-7-17').textContent).toContain('понедельник, 17 августа 2026 г.');

    day('2026-7-20').click();
    await detect();
    expect(component.date.value).toEqual(new Date(2026, 7, 17));
    expect(document.body.querySelector('.tb-date-field__chosen')?.textContent).toBe('чт, 20 авг.');
    buttonByText(document.body, 'ОК').click();
    await detect();
    expect(component.date.value).toEqual(new Date(2026, 7, 20));
    expect(input.value).toBe('20.08.2026');
    expect(document.body.querySelector('.tb-date-picker')).toBeNull();
    expect(opener.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(opener);
  });

  it('is the same modal picker on compact', async () => {
    const { component, detect, open } = await render(400);
    await open();
    expect(document.body.querySelector('.p-dialog')?.classList).not.toContain('tb-d--full');
    expect(document.activeElement).toBe(day('2026-7-17'));
    day('2026-7-21').click();
    await detect();
    buttonByText(document.body, 'ОК').click();
    await detect();
    expect(component.date.value).toEqual(new Date(2026, 7, 21));
  });

  it('pages months and years with the header and the year keys', async () => {
    const { detect, grid, open } = await render();
    await open();
    buttonByText(panel(), 'Следующий месяц (Page Down)').click();
    await detect();
    expect(buttonByText(panel(), 'Месяц: сентябрь')).toBeTruthy();
    buttonByText(panel(), 'Предыдущий год (Shift+Page Up)').click();
    await detect();
    expect(buttonByText(panel(), 'Год: 2025')).toBeTruthy();
    expect(day('2025-8-17')).toBeTruthy();

    key(day('2025-8-17'), { key: 'PageDown', shiftKey: true });
    await detect();
    expect(buttonByText(panel(), 'Год: 2026')).toBeTruthy();
    expect(document.activeElement).toBe(day('2026-8-17'));

    // the grid's own paging (its keys) comes back to the header
    grid().onMonthChange.emit({ month: 10, year: 2026 });
    await detect();
    expect(buttonByText(panel(), 'Месяц: октябрь')).toBeTruthy();
    grid().onYearChange.emit({});
    await detect();
    expect(buttonByText(panel(), 'Месяц: октябрь')).toBeTruthy();
  });

  it('goes from 29 February to 28 February a year later', async () => {
    const { component, detect, open } = await render();
    component.date.setValue(new Date(2028, 1, 29));
    await open();
    key(day('2028-1-29'), { key: 'PageUp', shiftKey: true });
    await detect();
    expect(document.activeElement).toBe(day('2027-1-28'));
  });

  it('replaces the grid with the month and the year lists (Shift+M, Shift+Y)', async () => {
    const { component, detect, open } = await render();
    await open();
    key(day('2026-7-17'), { key: 'M', code: 'KeyM', shiftKey: true });
    await detect();
    expect(panel().querySelector('.p-datepicker')).toBeNull();
    expect(buttonByText(panel(), 'Месяц: август').getAttribute('aria-expanded')).toBe('true');
    expect(panel().querySelector('[aria-current="true"]')?.textContent.trim()).toBe('Август');
    buttonByText(panel(), 'Март').click();
    await detect();
    expect(buttonByText(panel(), 'Месяц: март')).toBeTruthy();

    key(day('2026-2-17'), { key: 'Y', code: 'KeyY', shiftKey: true });
    await detect();
    expect(panel().querySelector('[aria-current="true"]')?.textContent.trim()).toBe('2026');
    buttonByText(panel(), '2030').click();
    await detect();
    expect(buttonByText(panel(), 'Год: 2030')).toBeTruthy();
    expect(component.date.value).toEqual(new Date(2026, 7, 17));
  });

  it('closes on Esc and on «Отмена» without a change', async () => {
    const { component, detect, open } = await render();
    await open();
    day('2026-7-20').click();
    await detect();
    key(day('2026-7-17'), { key: 'Escape' });
    await detect();
    expect(document.body.querySelector('.tb-date-picker')).toBeNull();
    expect(component.date.value).toEqual(new Date(2026, 7, 17));

    await open();
    day('2026-7-20').click();
    await detect();
    buttonByText(document.body, 'Отмена').click();
    await detect();
    expect(document.body.querySelector('.tb-date-picker')).toBeNull();
    expect(component.date.value).toEqual(new Date(2026, 7, 17));
  });

  it('keeps no date by «ОК» when none is picked', async () => {
    const { component, detect, open } = await render(1024, (page) => {
      page.date.setValue(null);
    });
    await open();
    expect(document.body.querySelector('.tb-date-field__chosen')?.textContent).toBe('');
    buttonByText(document.body, 'ОК').click();
    await detect();
    expect(component.date.value).toBeNull();
    expect(document.body.querySelector('.tb-date-picker')).toBeNull();
  });

  it('is a month field: the year header and the month list', async () => {
    const { component, input, opener, detect, open } = await render(1024, (page) => {
      page.month.set(true);
      page.date.setValue(new Date(2026, 7, 1));
    });
    expect(input.value).toBe('08.2026');
    expect(input.placeholder).toBe('ММ.ГГГГ');
    expect(opener.getAttribute('aria-label')).toBe('Выбрать месяц');
    typeInto(input, '9/26');
    key(input, { key: 'Enter' });
    await detect();
    expect(component.date.value).toEqual(new Date(2026, 8, 1));

    await open();
    expect(panel().querySelector('.p-datepicker')).toBeNull();
    expect(panel().textContent).not.toContain('Месяц:');
    expect(document.body.querySelector('.tb-d__headline')?.textContent).toBe('Выберите месяц');
    expect(document.activeElement?.textContent.trim()).toBe('Сентябрь');
    buttonByText(panel(), 'Предыдущий год (Shift+Page Up)').click();
    await detect();
    expect(panel().querySelector('[aria-current="true"]')).toBeNull();
    buttonByText(panel(), 'Май').click();
    await detect();
    expect(document.body.querySelector('.tb-date-field__chosen')?.textContent).toBe('май 2025 г.');
    buttonByText(document.body, 'ОК').click();
    await detect();
    expect(component.date.value).toEqual(new Date(2025, 4, 1));
    expect(input.value).toBe('05.2025');
  });

  it('is disabled with its form control', async () => {
    const { component, input, opener, detect } = await render();
    component.date.disable();
    await detect();
    expect(input.disabled).toBe(true);
    expect(opener.disabled).toBe(true);
  });
});
