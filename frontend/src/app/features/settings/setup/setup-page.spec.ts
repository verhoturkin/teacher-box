import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { Portal } from '@core/portal/portal';
import { authResponse } from '@testing/auth';
import { overview } from '@testing/billing-fixtures';
import { buttonByText, hostElement, readableText, requireElement, typeInto } from '@testing/dom';
import { portalSettings } from '@testing/portal-fixtures';
import { scheduleSettings } from '@testing/schedule-fixtures';
import { SetupPage } from './setup-page';
import { testProviders } from '@testing/setup';

describe('SetupPage', () => {
  let fixture: ComponentFixture<SetupPage>;
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function render(passwordChangeRequired = false, timeZone?: string): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [SetupPage],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    const response = authResponse('TEACHER');
    TestBed.inject(AuthService).acceptSession({
      ...response,
      user: { ...response.user, passwordChangeRequired },
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(SetupPage);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/portal').flush(portalSettings({ setupCompleted: false }));
    backend
      .expectOne('/api/teacher/billing/overview')
      .flush({ ...overview([]), defaultLessonPrice: 0 });
    backend
      .expectOne('/api/me/schedule/settings')
      .flush(scheduleSettings(timeZone === undefined ? {} : { timeZone }));
    await fixture.whenStable();
    return hostElement(fixture);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('goes through the steps and saves each of them', async () => {
    const host = await render();
    expect(readableText(host)).toContain('1 Знакомство');
    expect(readableText(host)).not.toContain('Придумайте свой пароль');
    expect(requireElement(host, '#setup-teacher-name', HTMLInputElement).value).toBe(
      'Анна Сергеевна',
    );

    typeInto(requireElement(host, '#setup-teacher-name', HTMLInputElement), 'Мария Ивановна');
    typeInto(requireElement(host, '#setup-portal-name', HTMLInputElement), 'Английский с Марией');
    buttonByText(host, 'Далее').click();
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/profile' })
      .flush({ id: '1', role: 'TEACHER', displayName: 'Мария Ивановна' });
    const about = backend.expectOne({ method: 'PUT', url: '/api/teacher/portal' });
    expect(about.request.body).toEqual({ name: 'Английский с Марией', address: '' });
    about.flush(portalSettings({ name: 'Английский с Марией', setupCompleted: false }));
    await fixture.whenStable();
    expect(TestBed.inject(AuthService).user()?.displayName).toBe('Мария Ивановна');
    expect(TestBed.inject(Portal).name()).toBe('Английский с Марией');

    expect(readableText(host)).toContain('Адрес портала');
    expect(requireElement(host, '#setup-address', HTMLInputElement).value).toBe(
      window.location.origin,
    );
    typeInto(
      requireElement(host, '#setup-address', HTMLInputElement),
      'https://school.example.com',
    );
    buttonByText(host, 'Далее').click();
    const address = backend.expectOne({ method: 'PUT', url: '/api/teacher/portal' });
    expect(address.request.body).toEqual({
      name: 'Английский с Марией',
      address: 'https://school.example.com',
    });
    address.flush(
      portalSettings({ name: 'Английский с Марией', address: 'https://school.example.com' }),
    );
    await fixture.whenStable();

    expect(readableText(host)).toContain('Стоимость занятия');
    fixture.componentInstance.price.setValue({ price: 1500 });
    buttonByText(host, 'Далее').click();
    const price = backend.expectOne({ method: 'PUT', url: '/api/teacher/billing/default-price' });
    expect(price.request.body).toEqual({ lessonPrice: 150_000 });
    price.flush({ lessonPrice: 150_000 });
    await fixture.whenStable();

    expect(readableText(host)).toContain('Готово!');
    expect(readableText(host)).toContain('Мессенджеры');
    buttonByText(host, 'Перейти на главную').click();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/portal/setup' })
      .flush(portalSettings({ setupCompleted: true }));
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/teacher');
  });

  it('keeps the name when it did not change, goes back and can be skipped', async () => {
    const host = await render(false, 'Asia/Vladivostok');

    buttonByText(host, 'Далее').click();
    backend.expectOne({ method: 'PUT', url: '/api/teacher/portal' }).flush(portalSettings());
    await fixture.whenStable();
    expect(readableText(host)).toContain('Часовой пояс портала: Asia/Vladivostok');
    expect(readableText(host)).toContain('На этом компьютере другой часовой пояс');

    buttonByText(host, 'Назад').click();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Ваше имя');
    fixture.componentInstance.back();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Ваше имя');

    buttonByText(host, 'Пропустить настройку').click();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/portal/setup' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(navigate).not.toHaveBeenCalled();

    fixture.componentInstance.finish();
    fixture.componentInstance.finish();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/portal/setup' })
      .flush(portalSettings({ setupCompleted: true }));
    expect(navigate).toHaveBeenCalledWith('/teacher');
  });

  it('does not move on when a step cannot be saved', async () => {
    const host = await render();

    typeInto(requireElement(host, '#setup-teacher-name', HTMLInputElement), ' ');
    fixture.componentInstance.saveAbout();
    typeInto(requireElement(host, '#setup-teacher-name', HTMLInputElement), 'Анна Сергеевна');
    fixture.componentInstance.saveAbout();
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/portal' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(readableText(host)).toContain('Ваше имя');

    fixture.componentInstance.next();
    await fixture.whenStable();
    typeInto(requireElement(host, '#setup-address', HTMLInputElement), 'school');
    fixture.componentInstance.saveAddress();
    fixture.componentInstance.next();
    fixture.componentInstance.price.setValue({ price: null });
    fixture.componentInstance.savePrice();
    fixture.componentInstance.next();
    fixture.componentInstance.next();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Готово!');
  });

  it('asks for the own password first when the portal made it up', async () => {
    const host = await render(true);
    expect(readableText(host)).toContain('1 Пароль');
    expect(readableText(host)).toContain('Придумайте свой пароль');
    expect(host.textContent).not.toContain('Пропустить настройку');

    typeInto(requireElement(host, '#current', HTMLInputElement), 'generated-1');
    typeInto(requireElement(host, '#next', HTMLInputElement), 'my-own-password');
    typeInto(requireElement(host, '#confirm', HTMLInputElement), 'my-own-password');
    await fixture.whenStable();
    buttonByText(host, 'Далее').click();
    backend.expectOne('/api/me/password').flush(authResponse('TEACHER', 900, 'renewed'));
    await fixture.whenStable();

    expect(TestBed.inject(AuthService).user()?.passwordChangeRequired).toBe(false);
    expect(readableText(host)).toContain('Ваше имя');
    fixture.componentInstance.back();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Ваше имя');
  });
});
