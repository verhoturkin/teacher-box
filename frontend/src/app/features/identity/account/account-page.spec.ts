import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { buttonByText, hostElement, requireElement, typeInto } from '@testing/dom';
import { AccountPage } from './account-page';

describe('AccountPage', () => {
  let fixture: ComponentFixture<AccountPage>;
  let backend: HttpTestingController;
  let messages: MessageService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AccountPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        providePrimeNG(),
        MessageService,
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    messages = TestBed.inject(MessageService);
    vi.spyOn(messages, 'add');
    fixture = TestBed.createComponent(AccountPage);
    await fixture.whenStable();
    backend.expectOne('/api/me').flush({
      id: '1',
      role: 'TEACHER',
      displayName: 'Анна Сергеевна',
      login: 'teacher',
      email: 'anna@example.com',
      phone: null,
    });
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
  });

  async function change(current: string, next: string, confirm = next): Promise<void> {
    const host = hostElement(fixture);
    typeInto(requireElement(host, '#current', HTMLInputElement), current);
    typeInto(requireElement(host, '#next', HTMLInputElement), next);
    typeInto(requireElement(host, '#confirm', HTMLInputElement), confirm);
    await fixture.whenStable();
    buttonByText(host, 'Сменить пароль').click();
    await fixture.whenStable();
  }

  it('shows the profile', () => {
    const text = hostElement(fixture).textContent;
    expect(text).toContain('Анна Сергеевна');
    expect(text).toContain('anna@example.com');
    expect(text).toContain('teacher');
  });

  it('changes the password and keeps the new session', async () => {
    await change('old-password', 'new-password');

    const request = backend.expectOne('/api/me/password');
    expect(request.request.body).toEqual({ currentPassword: 'old-password', newPassword: 'new-password' });
    request.flush(authResponse('TEACHER', 900, 'after-change'));
    await fixture.whenStable();

    expect(TestBed.inject(AuthService).accessToken()).toBe('after-change');
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    expect(requireElement(hostElement(fixture), '#current', HTMLInputElement).value).toBe('');
  });

  it('shows why the password was not changed', async () => {
    await change('wrong-password', 'new-password');

    backend
      .expectOne('/api/me/password')
      .flush({ status: 422, code: 'password.wrong-current' }, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();

    expect(hostElement(fixture).textContent).toContain('Текущий пароль указан неверно');
  });

  it('does not submit mismatching passwords', async () => {
    await change('old-password', 'new-password', 'other-password');

    expect(hostElement(fixture).textContent).toContain('Пароли не совпадают');
    backend.expectNone('/api/me/password');
  });
});
