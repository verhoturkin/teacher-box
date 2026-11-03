import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { preferences } from '@testing/notification-fixtures';
import { buttonByText, hostElement } from '@testing/dom';
import { phoneScreen, testProviders } from '@testing/setup';
import { Account } from '../data-access/identity.models';
import { AccountPanel } from './account-panel';

const STUDENT: Account = {
  id: '2',
  role: 'STUDENT',
  displayName: 'Аня',
  profileName: 'Анна Смирнова',
  avatar: null,
  login: 'anna.s',
  email: null,
  phone: null,
  passwordChangeRequired: false,
  language: 'ru',
};

describe('AccountPanel on a phone', () => {
  let fixture: ComponentFixture<AccountPanel>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AccountPanel],
      providers: testProviders(phoneScreen()),
    });
    const backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AccountPanel);
    await fixture.whenStable();
    backend.expectOne('/api/me').flush(STUDENT);
    await fixture.whenStable();
    backend.expectOne('/api/me/channels').flush([]);
    backend.expectOne('/api/me/push/subscriptions').flush([]);
    backend.expectOne('/api/me/notifications/preferences').flush(preferences());
    await fixture.whenStable();
  });

  it('lists the profile, the look and sign-out as rows', () => {
    const text = hostElement(fixture).textContent;

    expect(text).toContain('Фото, имя, пароль');
    expect(text).toContain('Тема и язык');
    expect(text).toContain('Выйти');
    expect(hostElement(fixture).querySelector('#account-own-name')).toBeNull();
  });

  it('opens the profile as a sub-page and goes back', async () => {
    buttonByText(hostElement(fixture), 'Аня').click();
    await fixture.whenStable();

    expect(hostElement(fixture).querySelector('#account-own-name')).not.toBeNull();

    buttonByText(hostElement(fixture), 'Назад').click();
    await fixture.whenStable();

    expect(hostElement(fixture).querySelector('#account-own-name')).toBeNull();
  });

  it('opens theme and language as a sub-page', async () => {
    buttonByText(hostElement(fixture), 'Тема и язык').click();
    await fixture.whenStable();

    expect(hostElement(fixture).querySelector('#account-theme')).not.toBeNull();
  });
});
