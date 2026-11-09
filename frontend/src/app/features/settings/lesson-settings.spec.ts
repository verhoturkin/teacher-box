import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { buttonByText, hostElement, menuItemByText, readableText } from '@testing/dom';
import { currencySetting, overview } from '@testing/billing-fixtures';
import { lessonRules, scheduleSettings } from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import { Select } from 'primeng/select';
import { LessonSettings } from './lesson-settings';
import { Option } from './lesson-options';

function isOption(value: unknown): value is Option {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    typeof value.value === 'string'
  );
}

/** The values of a select's options. */
function zoneValues(options: unknown): string[] {
  return Array.isArray(options) ? options.filter(isOption).map((option) => option.value) : [];
}

describe('LessonSettings', () => {
  let fixture: ComponentFixture<LessonSettings>;
  let backend: HttpTestingController;
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function render(locked = false): Promise<HTMLElement> {
    TestBed.configureTestingModule({ imports: [LessonSettings], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LessonSettings);
    fixture.detectChanges();
    await fixture.whenStable();
    flush(locked);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  function flush(locked: boolean): void {
    flushSettings(locked);
    backend.expectOne('/api/teacher/billing/overview').flush(overview([]));
  }

  function flushSettings(locked: boolean): void {
    backend
      .expectOne('/api/me/schedule/settings')
      .flush(scheduleSettings({ timeZone: 'Europe/Moscow' }));
    backend.expectOne('/api/teacher/schedule/settings').flush(lessonRules());
    backend.expectOne('/api/teacher/billing/currency').flush(currencySetting({ locked }));
    backend.expectOne('/api/teacher/homework/settings').flush({ dueSoonMinutes: 1440 });
  }

  /** The value a select or a number field gives its handler, as the user's choice does. */
  async function emit(selector: string, event: string, value?: unknown): Promise<void> {
    fixture.debugElement.query(By.css(selector)).triggerEventHandler(event, { value });
    await fixture.whenStable();
  }

  function setNumber(
    name: 'duration' | 'late' | 'dueSoon' | 'horizon',
    value: number | null,
  ): void {
    fixture.componentInstance.form.controls[name].setValue(value);
  }

  /** «×» of a reminder chip (its label keeps the number and the unit together with a no-break space). */
  function removeButton(host: HTMLElement, label: string): HTMLButtonElement {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-label]')).find(
      (candidate) =>
        candidate.getAttribute('aria-label')?.replaceAll('\u00A0', ' ') === `Убрать «${label}»`,
    );
    if (button === undefined) {
      throw new Error(`No «×» for ${label}`);
    }
    return button;
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('shows the time, the price and the rules in two cards', async () => {
    const host = await render();
    const text = readableText(host);
    expect(text).toContain('Время и цена');
    expect(text).toContain('Часовой пояс');
    expect(text).toContain('Уже назначенные занятия не сдвинутся.');
    expect(text).toContain('Российский рубль, ₽');
    expect(text).toContain('Цена занятия');
    expect(text).toContain('Правила');
    expect(text).toContain('За 24 ч');
    expect(text).toContain('За 1 ч');
    expect(text).toContain('До трёх напоминаний.');
    const form = fixture.componentInstance.form.value;
    expect(form).toEqual({ duration: 60, late: 24, dueSoon: 24, horizon: 12 });
    const zones = fixture.debugElement.query(By.css('p-select[inputId="time-zone-input"]'));
    const options = zoneValues(zones.injector.get(Select).options);
    expect(options[0]).toBe(device);
    expect(options).toContain('Europe/Moscow');
    expect(readableText(hostElement(fixture))).toContain('Europe/Moscow (UTC+3)');
  });

  it('saves a new time zone at once and keeps the old one when it is refused', async () => {
    await render();
    await emit('p-select[inputId="time-zone-input"]', 'onChange', 'Asia/Yekaterinburg');
    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/settings/time-zone' });
    expect(request.request.body).toEqual({ timeZone: 'Asia/Yekaterinburg' });
    request.flush({ timeZone: 'Asia/Yekaterinburg' });
    await fixture.whenStable();

    await emit('p-select[inputId="time-zone-input"]', 'onChange', 'Asia/Tokyo');
    backend
      .expectOne('/api/teacher/settings/time-zone')
      .flush({ code: 'portal.time-zone-invalid' }, { status: 422, statusText: 'Invalid' });
    await fixture.whenStable();
    const zones = fixture.debugElement.query(By.css('p-select[inputId="time-zone-input"]'));
    expect(zoneValues(zones.injector.get(Select).options)[1]).toBe('Asia/Yekaterinburg');
  });

  it('changes the currency, shows the price in it and reads the setting again after a refusal', async () => {
    await render();
    await emit('p-select[inputId="currency-input"]', 'onChange', 'RUB');
    await emit('p-select[inputId="currency-input"]', 'onChange', 'EUR');
    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/billing/currency' });
    expect(request.request.body).toEqual({ currency: 'EUR' });
    request.flush(currencySetting({ currency: 'EUR' }));
    backend.expectOne('/api/teacher/billing/overview').flush(overview([]));
    await fixture.whenStable();

    await emit('p-select[inputId="currency-input"]', 'onChange', 'USD');
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/billing/currency' })
      .flush({ code: 'billing.currency-locked' }, { status: 409, statusText: 'Conflict' });
    backend
      .expectOne({ method: 'GET', url: '/api/teacher/billing/currency' })
      .flush(currencySetting({ currency: 'EUR', locked: true }));
    await fixture.whenStable();
    expect(readableText(hostElement(fixture))).toContain('валюту сменить нельзя');
  });

  it('locks the currency with a hint once a charge or a payment is recorded', async () => {
    const host = await render(true);
    const select = fixture.debugElement.query(By.css('p-select[inputId="currency-input"]'));
    expect(select.injector.get(Select).$disabled()).toBe(true);
    expect(readableText(host)).toContain('Уже есть начисления или оплаты — валюту сменить нельзя.');
    expect(host.querySelector('.tb-lesson-settings__locked .tb-i-lock')).not.toBeNull();
  });

  it('saves a changed length, late cancellation and horizon on leaving the field', async () => {
    await render();
    await emit('p-inputnumber[inputId="duration-input"]', 'onBlur');
    setNumber('duration', 90);
    await emit('p-inputnumber[inputId="duration-input"]', 'onBlur');
    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/schedule/settings' });
    expect(request.request.body).toEqual(lessonRules({ defaultDurationMinutes: 90 }));
    // a change made meanwhile follows the first
    setNumber('late', 12);
    await emit('p-inputnumber[inputId="late-input"]', 'onBlur');
    request.flush(lessonRules({ defaultDurationMinutes: 90 }));
    await fixture.whenStable();
    const second = backend.expectOne('/api/teacher/schedule/settings');
    expect(second.request.body).toEqual(
      lessonRules({ defaultDurationMinutes: 90, lateCancellationMinutes: 720 }),
    );
    second.flush(lessonRules({ defaultDurationMinutes: 90, lateCancellationMinutes: 720 }));
    await fixture.whenStable();

    setNumber('horizon', 30);
    await emit('p-inputnumber[inputId="horizon-input"]', 'onBlur');
    backend
      .expectOne('/api/teacher/schedule/settings')
      .flush({ code: 'schedule.settings-horizon-invalid' }, { status: 422, statusText: 'Invalid' });
    await fixture.whenStable();
    expect(fixture.componentInstance.form.value).toEqual({
      duration: 90,
      late: 12,
      dueSoon: 24,
      horizon: 12,
    });
  });

  it('puts the saved value back into an emptied field', async () => {
    await render();
    setNumber('duration', null);
    await emit('p-inputnumber[inputId="duration-input"]', 'onBlur');
    setNumber('dueSoon', null);
    await emit('p-inputnumber[inputId="due-soon-input"]', 'onBlur');
    expect(fixture.componentInstance.form.value).toEqual({
      duration: 60,
      late: 24,
      dueSoon: 24,
      horizon: 12,
    });
  });

  it('saves the length on Enter and the rule fields on Enter in their card', async () => {
    const host = await render();
    setNumber('duration', 45);
    host.querySelector('form')?.dispatchEvent(new Event('submit'));
    backend
      .expectOne('/api/teacher/schedule/settings')
      .flush(lessonRules({ defaultDurationMinutes: 45 }));
    await fixture.whenStable();

    setNumber('horizon', 8);
    host
      .querySelector('#lesson-rules')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    backend
      .expectOne('/api/teacher/schedule/settings')
      .flush(lessonRules({ defaultDurationMinutes: 45, horizonWeeks: 8 }));
    await fixture.whenStable();
  });

  it('removes and adds reminders as chips, up to three', async () => {
    const host = await render();
    removeButton(host, 'За 1 ч').click();
    await fixture.whenStable();
    let request = backend.expectOne({ method: 'PUT', url: '/api/teacher/schedule/settings' });
    expect(request.request.body).toMatchObject({ reminderMinutes: [1440] });
    request.flush(lessonRules({ reminderMinutes: [1440] }));
    await fixture.whenStable();
    removeButton(host, 'За 24 ч').click();
    await fixture.whenStable();
    backend.expectOne('/api/teacher/schedule/settings').flush(lessonRules({ reminderMinutes: [] }));
    await fixture.whenStable();
    expect(readableText(host)).toContain('Напоминаний нет');

    buttonByText(host, 'Добавить').click();
    await fixture.whenStable();
    menuItemByText('За 2\u00A0дня').click();
    request = backend.expectOne('/api/teacher/schedule/settings');
    expect(request.request.body).toMatchObject({ reminderMinutes: [2880] });
    request.flush(lessonRules({ reminderMinutes: [2880, 1440, 15] }));
    await fixture.whenStable();

    const text = readableText(host);
    expect(text).toContain('За 2 дня');
    expect(text).toContain('За 15 мин');
    expect(text).not.toContain('Добавить');
  });

  it('keeps the reminders when a change is refused', async () => {
    const host = await render();
    removeButton(host, 'За 24 ч').click();
    backend
      .expectOne('/api/teacher/schedule/settings')
      .flush({ code: 'schedule.settings-reminders-invalid' }, { status: 422, statusText: 'No' });
    await fixture.whenStable();
    expect(readableText(host)).toContain('За 24 ч');
  });

  it('saves the homework deadline reminder in hours as minutes', async () => {
    await render();
    await emit('p-inputnumber[inputId="due-soon-input"]', 'onBlur');
    setNumber('dueSoon', 6);
    await emit('p-inputnumber[inputId="due-soon-input"]', 'onBlur');
    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/homework/settings' });
    expect(request.request.body).toEqual({ dueSoonMinutes: 360 });
    request.flush({ dueSoonMinutes: 360 });
    await fixture.whenStable();

    setNumber('dueSoon', 100);
    await emit('p-inputnumber[inputId="due-soon-input"]', 'onBlur');
    backend
      .expectOne('/api/teacher/homework/settings')
      .flush({ code: 'homework.settings-due-soon-invalid' }, { status: 422, statusText: 'No' });
    await fixture.whenStable();
    expect(fixture.componentInstance.form.controls.dueSoon.value).toBe(6);
  });

  it('offers to load the settings again after a failure', async () => {
    TestBed.configureTestingModule({ imports: [LessonSettings], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LessonSettings);
    fixture.detectChanges();
    await fixture.whenStable();
    backend
      .expectOne('/api/me/schedule/settings')
      .flush(null, { status: 500, statusText: 'Error' });
    backend.match(() => true);
    await fixture.whenStable();
    const host = hostElement(fixture);
    expect(readableText(host)).toContain('настройки занятий');

    buttonByText(host, 'Повторить').click();
    await fixture.whenStable();
    flushSettings(false);
    await fixture.whenStable();
    expect(readableText(host)).toContain('За 24 ч');
  });
});
