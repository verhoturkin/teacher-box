import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { Portal } from '@core/portal/portal';
import { aiStatus } from '@testing/ai-fixtures';
import { authResponse } from '@testing/auth';
import { currencySetting, overview } from '@testing/billing-fixtures';
import { buttonByText, hostElement, readableText, requireElement, typeInto } from '@testing/dom';
import { aStudent } from '@testing/identity-fixtures';
import { portalSettings } from '@testing/portal-fixtures';
import { lessonRules, scheduleSettings } from '@testing/schedule-fixtures';
import { screenWidth, testProviders } from '@testing/setup';
import type { Account } from '@features/identity/parts';
import { SetupPage } from './setup-page';

const ACCOUNT: Account = {
  id: 'teacher-1',
  role: 'TEACHER',
  displayName: 'Учитель',
  profileName: 'Учитель',
  avatar: null,
  login: 'teacher',
  email: null,
  phone: null,
  passwordChangeRequired: false,
  language: 'ru',
};

const DEVICE = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe('SetupPage', () => {
  let fixture: ComponentFixture<SetupPage>;
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  interface Options {
    readonly passwordChangeRequired?: boolean;
    readonly width?: number;
    readonly locked?: boolean;
  }

  async function render(options: Options = {}): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [SetupPage],
      providers: testProviders(screenWidth(options.width ?? 1440)),
    });
    backend = TestBed.inject(HttpTestingController);
    const response = authResponse('TEACHER');
    TestBed.inject(AuthService).acceptSession({
      ...response,
      user: { ...response.user, passwordChangeRequired: options.passwordChangeRequired ?? false },
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(SetupPage);
    fixture.detectChanges();
    flushLoad(options.locked ?? false);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  function flushLoad(locked: boolean): void {
    backend.expectOne('/api/me').flush(ACCOUNT);
    backend.expectOne('/api/teacher/portal').flush(portalSettings({ setupCompleted: false }));
    backend
      .expectOne('/api/me/schedule/settings')
      .flush(scheduleSettings({ timeZone: 'Europe/Moscow' }));
    backend.expectOne('/api/teacher/schedule/settings').flush(lessonRules());
    backend.expectOne('/api/teacher/billing/currency').flush(currencySetting({ locked }));
    backend
      .expectOne('/api/teacher/billing/overview')
      .flush({ ...overview([]), defaultLessonPrice: 0 });
    backend.expectOne('/api/teacher/homework/settings').flush({ dueSoonMinutes: 1440 });
  }

  /** The requests «Готово» asks for the states of its cards. */
  function flushStates(students = 0, aiEnabled = false): void {
    backend
      .expectOne('/api/teacher/students')
      .flush(Array.from({ length: students }, (_, index) => aStudent({ id: `s${String(index)}` })));
    backend.expectOne('/api/teacher/notifications/status').flush({
      channels: [{ channel: 'TELEGRAM', connection: 'OK', error: null, checkedAt: null }],
      failedDeliveries: [],
    });
    backend.expectOne('/api/teacher/ai/status').flush(aiStatus({ enabled: aiEnabled }));
    backend.expectOne('/api/teacher/schedule/google').flush({
      clientConfigured: true,
      clientId: null,
      status: 'CONNECTED',
      busyEnabled: false,
      lastError: null,
      lastSyncAt: null,
      connectedAt: null,
      callbackPath: '/callback',
    });
  }

  async function click(host: HTMLElement, label: string): Promise<void> {
    buttonByText(host, label).click();
    await fixture.whenStable();
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('shows the steps, the form and what students see on a wide screen', async () => {
    const host = await render();
    const text = readableText(host);
    expect(text).toContain('Первый вход');
    expect(text).toContain('Шаг 1 из 4');
    expect(text).toContain('1 Вы и портал 2 Время и оплата 3 Правила 4 Готово');
    expect(text).not.toContain('Пароль');
    expect(host.querySelector('[aria-current="step"]')?.textContent).toContain('Вы и портал');
    expect(text).toContain('Так увидит ученик');
    expect(text).toContain('Учитель приглашает вас в «Teacher Box»');
    expect(text).toContain('Пропустить — настрою позже');
    expect(requireElement(host, '#setup-address', HTMLInputElement).value).toBe(
      window.location.origin,
    );
    expect(host.querySelector('p-progressbar')).toBeNull();

    typeInto(requireElement(host, '#setup-portal-name', HTMLInputElement), 'Английский с Еленой');
    typeInto(requireElement(host, '#setup-teacher-name', HTMLInputElement), 'Елена Викторовна');
    await fixture.whenStable();
    expect(readableText(host)).toContain('Елена Викторовна приглашает вас в «Английский с Еленой»');
  });

  it('saves every step on «Далее» and finishes with «Перейти в портал»', async () => {
    const host = await render();
    typeInto(requireElement(host, '#setup-teacher-name', HTMLInputElement), 'Елена Викторовна');
    typeInto(requireElement(host, '#setup-portal-name', HTMLInputElement), 'Английский с Еленой');
    typeInto(
      requireElement(host, '#setup-address', HTMLInputElement),
      'https://school.example.com',
    );
    await click(host, 'Далее');
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/profile' })
      .flush({ ...ACCOUNT, displayName: 'Елена Викторовна' });
    await fixture.whenStable();
    const portal = backend.expectOne({ method: 'PUT', url: '/api/teacher/portal' });
    expect(portal.request.body).toEqual({
      name: 'Английский с Еленой',
      address: 'https://school.example.com',
    });
    portal.flush(
      portalSettings({ name: 'Английский с Еленой', address: 'https://school.example.com' }),
    );
    await fixture.whenStable();
    expect(TestBed.inject(AuthService).user()?.displayName).toBe('Елена Викторовна');
    expect(TestBed.inject(Portal).name()).toBe('Английский с Еленой');

    // «Время и оплата»: the device's zone is suggested
    expect(readableText(host)).toContain('Шаг 2 из 4');
    expect(readableText(host)).toContain('Так будет в расписании');
    const time = fixture.componentInstance.timeForm;
    expect(time.controls.zone.value).toBe(DEVICE);
    time.patchValue({ zone: 'Asia/Novosibirsk', duration: 90, currency: 'EUR', price: 25 });
    await fixture.whenStable();
    expect(readableText(host)).toContain('Asia/Novosibirsk (UTC+7)');
    await click(host, 'Далее');
    const zone = backend.expectOne({ method: 'PUT', url: '/api/teacher/settings/time-zone' });
    expect(zone.request.body).toEqual({ timeZone: 'Asia/Novosibirsk' });
    zone.flush({ timeZone: 'Asia/Novosibirsk' });
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/billing/currency' })
      .flush(currencySetting({ currency: 'EUR' }));
    const price = backend.expectOne({ method: 'PUT', url: '/api/teacher/billing/default-price' });
    expect(price.request.body).toEqual({ lessonPrice: 2500 });
    price.flush({ lessonPrice: 2500 });
    const length = backend.expectOne({ method: 'PUT', url: '/api/teacher/schedule/settings' });
    expect(length.request.body).toEqual(lessonRules({ defaultDurationMinutes: 90 }));
    length.flush(lessonRules({ defaultDurationMinutes: 90 }));
    await fixture.whenStable();

    // «Правила»: examples follow the fields
    expect(readableText(host)).toContain('Как это работает');
    expect(readableText(host)).toContain(
      'Урок в четверг в 10:00. Ученик отменил в среду в 20:00 — это поздняя отмена',
    );
    expect(readableText(host)).toContain('в среду в 10:00 и в четверг в 9:00. Вам — только в 9:00');
    fixture.componentInstance.rulesForm.patchValue({ late: 0, dueSoon: 6, horizon: 4 });
    fixture.componentInstance.reminders.set([60]);
    await fixture.whenStable();
    let text = readableText(host);
    expect(text).toContain('Поздних отмен не будет');
    expect(text).toContain('Сообщение придёт ученику и вам в четверг в 9:00');
    expect(text).toContain('ученику напомнят в пятницу в 12:00');
    expect(text).toContain('на 4 недели вперёд');
    await click(host, 'Далее');
    const rules = backend.expectOne({ method: 'PUT', url: '/api/teacher/schedule/settings' });
    expect(rules.request.body).toEqual(
      lessonRules({
        defaultDurationMinutes: 90,
        lateCancellationMinutes: 0,
        reminderMinutes: [60],
        horizonWeeks: 4,
      }),
    );
    rules.flush(
      lessonRules({
        defaultDurationMinutes: 90,
        lateCancellationMinutes: 0,
        reminderMinutes: [60],
        horizonWeeks: 4,
      }),
    );
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/homework/settings' })
      .flush({ dueSoonMinutes: 360 });
    await fixture.whenStable();

    // «Готово»: the next steps with their states and what was set up
    flushStates(2, true);
    await fixture.whenStable();
    text = readableText(host);
    expect(text).toContain('Портал готов');
    expect(text).toContain('Уже есть: 2 ученика');
    expect(text).toContain('Telegram работает');
    expect(text).toContain('Подключён');
    expect(text).toContain('Английский с Еленой · school.example.com');
    expect(text).toContain('1 ч 30 мин · 25 €');
    expect(text).toContain('Поздняя отмена нет');
    expect(text).toContain('Напоминания за 1 ч');
    expect(text).toContain('напомнить за 6 ч');
    expect(text).not.toContain('Пропустить');

    await click(host, 'Перейти в портал');
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/portal/setup' })
      .flush(portalSettings({ setupCompleted: true }));
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/teacher'], { queryParams: undefined });
    expect(await TestBed.inject(Portal).setupCompleted()).toBe(true);
  });

  it('saves nothing when a step did not change and skips a step with the server values', async () => {
    const host = await render();
    await click(host, 'Далее');
    // the name is as saved: only the address where the portal is open now is saved
    const portal = backend.expectOne({ method: 'PUT', url: '/api/teacher/portal' });
    expect(portal.request.body).toEqual({ name: 'Teacher Box', address: window.location.origin });
    portal.flush(portalSettings({ address: window.location.origin }));
    await fixture.whenStable();
    expect(readableText(host)).toContain('Шаг 2 из 4');

    fixture.componentInstance.timeForm.patchValue({ duration: 45 });
    await click(host, 'Пропустить');
    expect(readableText(host)).toContain('Значения ниже подходят большинству');
    await click(host, 'Назад');
    expect(fixture.componentInstance.timeForm.controls.duration.value).toBe(60);
    expect(fixture.componentInstance.timeForm.controls.zone.value).toBe('Europe/Moscow');

    // skipped: the server's zone is shown, so «Далее» has nothing to save
    await click(host, 'Далее');
    fixture.componentInstance.rulesForm.patchValue({ horizon: 20 });
    await click(host, 'Пропустить');
    flushStates();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Портал готов');
    expect(fixture.componentInstance.rulesForm.controls.horizon.value).toBe(12);
    expect(readableText(host)).toContain('за 24 ч и за 1 ч');
  });

  it('goes back to a step from «Что вы настроили» and opens a next step after finishing', async () => {
    const host = await render();
    fixture.componentInstance.goTo('done');
    fixture.componentInstance.skip();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Портал готов');
    backend.expectOne('/api/teacher/students').flush(null, { status: 500, statusText: 'Error' });
    backend
      .expectOne('/api/teacher/notifications/status')
      .flush(null, { status: 500, statusText: 'Error' });
    backend.expectOne('/api/teacher/ai/status').flush(null, { status: 500, statusText: 'Error' });
    backend.expectOne('/api/teacher/schedule/google').flush({
      clientConfigured: false,
      clientId: null,
      status: 'NEEDS_RECONNECT',
      busyEnabled: false,
      lastError: null,
      lastSyncAt: null,
      connectedAt: null,
      callbackPath: '/callback',
    });
    await fixture.whenStable();
    expect(readableText(host)).toContain('Нужно подключить заново');

    buttonByText(host, 'Изменить: Часовой пояс').click();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Шаг 2 из 4');
    fixture.componentInstance.goTo('done');
    await fixture.whenStable();

    await click(host, 'Добавить первого ученика');
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/portal/setup' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(navigate).not.toHaveBeenCalled();
    fixture.componentInstance.finish('/teacher/students', { create: 'student' });
    fixture.componentInstance.finish('/teacher/students', { create: 'student' });
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/portal/setup' })
      .flush(portalSettings({ setupCompleted: true }));
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/teacher/students'], {
      queryParams: { create: 'student' },
    });
  });

  it('does not move on when a step cannot be saved or a field is wrong', async () => {
    const host = await render();
    typeInto(requireElement(host, '#setup-teacher-name', HTMLInputElement), ' ');
    await click(host, 'Далее');
    expect(readableText(host)).toContain('Шаг 1 из 4');

    typeInto(requireElement(host, '#setup-teacher-name', HTMLInputElement), 'Анна');
    await click(host, 'Далее');
    fixture.componentInstance.next();
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/profile' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(readableText(host)).toContain('Шаг 1 из 4');
  });

  it('keeps a locked currency and an emptied field as they are saved', async () => {
    const host = await render({ locked: true });
    fixture.componentInstance.skip();
    await fixture.whenStable();
    expect(readableText(host)).toContain('валюту сменить нельзя');
    const time = fixture.componentInstance.timeForm;
    expect(time.controls.currency.disabled).toBe(true);
    time.patchValue({ zone: 'Europe/Moscow', duration: null, price: null });
    await click(host, 'Далее');
    expect(readableText(host)).toContain('Шаг 3 из 4');
    fixture.componentInstance.rulesForm.patchValue({ late: null, dueSoon: null, horizon: null });
    await click(host, 'Далее');
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/schedule/settings' })
      .flush(lessonRules());
    await fixture.whenStable();
    flushStates();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Портал готов');
  });

  it('asks for the own password first when the portal made it up', async () => {
    const host = await render({ passwordChangeRequired: true });
    expect(readableText(host)).toContain('Шаг 1 из 5');
    expect(readableText(host)).toContain('Придумайте свой пароль');
    expect(host.textContent).not.toContain('Пропустить');

    typeInto(requireElement(host, '#current', HTMLInputElement), 'generated-1');
    typeInto(requireElement(host, '#next', HTMLInputElement), 'my-own-password');
    typeInto(requireElement(host, '#confirm', HTMLInputElement), 'my-own-password');
    await fixture.whenStable();
    buttonByText(host, 'Далее').click();
    backend.expectOne('/api/me/password').flush(authResponse('TEACHER', 900, 'renewed'));
    await fixture.whenStable();

    expect(TestBed.inject(AuthService).user()?.passwordChangeRequired).toBe(false);
    expect(readableText(host)).toContain('Шаг 2 из 5');
    expect(host.textContent).not.toContain('Назад');
    fixture.componentInstance.back();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Шаг 2 из 5');
  });

  it('shows a top bar with the step, a progress and «Далее» at the bottom on a phone', async () => {
    const host = await render({ width: 390 });
    expect(host.querySelector('.tb-setup__steps')).toBeNull();
    expect(host.querySelector('p-progressbar')).not.toBeNull();
    expect(host.querySelector('.tb-bottom-actions')).not.toBeNull();
    expect(readableText(host)).toContain('Шаг 1 из 4');
    expect(host.querySelector('[aria-label="Назад"]')).toBeNull();

    await click(host, 'Пропустить');
    expect(readableText(host)).toContain('Шаг 2 из 4');
    requireElement(
      host,
      '[aria-label="Назад"] button, button[aria-label="Назад"]',
      HTMLElement,
    ).click();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Шаг 1 из 4');

    fixture.componentInstance.goTo('done');
    await fixture.whenStable();
    flushStates();
    await fixture.whenStable();
    expect(host.querySelector('[aria-label="Выйти"]')).not.toBeNull();
  });

  it('signs out from the top bar', async () => {
    const host = await render();
    const logout = vi.spyOn(TestBed.inject(AuthService), 'logout');
    await click(host, 'Выйти');
    expect(logout).toHaveBeenCalled();
    backend.match(() => true);
  });

  it('offers to load the setup again after a failure', async () => {
    TestBed.configureTestingModule({
      imports: [SetupPage],
      providers: testProviders(screenWidth(1440)),
    });
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    fixture = TestBed.createComponent(SetupPage);
    fixture.detectChanges();
    backend.expectOne('/api/me').flush(null, { status: 500, statusText: 'Error' });
    backend.match(() => true);
    await fixture.whenStable();
    const host = hostElement(fixture);
    expect(readableText(host)).toContain('настройки портала');
    await click(host, 'Повторить');
    flushLoad(false);
    await fixture.whenStable();
    expect(readableText(host)).toContain('Ваше имя');
  });
});
