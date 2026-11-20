import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@core/auth/auth.models';
import { authResponse } from '@testing/auth';
import { hostElement } from '@testing/dom';
import { preferences } from '@testing/notification-fixtures';
import { testProviders } from '@testing/setup';
import { AccountPage } from './account-page';

describe('AccountPage', () => {
  async function render(
    role: Role,
  ): Promise<{ host: HTMLElement; backend: HttpTestingController; settle: () => Promise<void> }> {
    TestBed.configureTestingModule({ imports: [AccountPage], providers: testProviders() });
    TestBed.inject(AuthService).acceptSession(authResponse(role));
    const fixture = TestBed.createComponent(AccountPage);
    await fixture.whenStable();
    const backend = TestBed.inject(HttpTestingController);
    return {
      host: hostElement(fixture),
      backend,
      settle: () => fixture.whenStable(),
    };
  }

  it('puts the title «Мой аккаунт» over the account', async () => {
    const { host, backend } = await render('ADMIN');
    backend.expectOne('/api/me');

    expect(host.querySelector('h1')?.textContent).toContain('Мой аккаунт');
    expect(host.querySelector('tb-account-panel')).not.toBeNull();
    // the administrator has no messengers
    expect(host.querySelector('tb-notifications-section')).toBeNull();
    expect(host.querySelector('tb-help-button')).toBeNull();
    backend.verify();
  });

  it('gives a parent «Уведомления» with the four categories of the children’s notices', async () => {
    const { host, backend, settle } = await render('GUARDIAN');
    backend.expectOne('/api/me').flush({
      id: 'g1',
      role: 'GUARDIAN',
      displayName: 'Ольга',
      profileName: 'Ольга',
      avatar: null,
      login: 'olga',
      email: null,
      phone: null,
      passwordChangeRequired: false,
      language: 'ru',
    });
    await settle();
    backend.expectOne('/api/me/channels').flush([]);
    backend.expectOne('/api/me/push/subscriptions').flush([]);
    backend.expectOne('/api/me/notifications/preferences').flush(preferences());
    backend
      .expectOne('/api/guardian/notifications/preferences')
      .flush({ disabledCategories: ['PAYMENTS'] });
    await settle();

    expect(host.querySelector('tb-account-panel tb-notifications-section')).not.toBeNull();
    const text = host.textContent;
    expect(text).toContain('Оплаты и долги');
    expect(text).toContain('Проверенные работы');
    expect(text).not.toContain('Сообщения учителя');
    expect(text).not.toContain('Домашние задания');
    backend.verify();
  });

  it('gives a student «Уведомления» next to the account', async () => {
    const { host, backend, settle } = await render('STUDENT');
    backend.expectOne('/api/me').flush({
      id: 's1',
      role: 'STUDENT',
      displayName: 'Ника',
      profileName: 'Вероника',
      avatar: null,
      login: 'nika',
      email: null,
      phone: null,
      passwordChangeRequired: false,
      language: 'ru',
    });
    await settle();
    backend.expectOne('/api/me/guardians').flush([]);
    backend.expectOne('/api/me/channels').flush([]);
    backend.expectOne('/api/me/push/subscriptions').flush([]);
    backend.expectOne('/api/me/notifications/preferences').flush(preferences());

    expect(host.querySelector('tb-account-panel tb-notifications-section')).not.toBeNull();
    expect(host.querySelector('tb-help-button[topic="cabinet/login"]')).not.toBeNull();
    expect(host.textContent).toContain('Изменения сохраняются сразу');
    backend.verify();
  });
});
