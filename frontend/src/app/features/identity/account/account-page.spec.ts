import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { buttonByText, hostElement, requireElement, typeInto } from '@testing/dom';
import { Account } from '../data-access/identity.models';
import { AccountPage } from './account-page';

const ACCOUNT: Account = {
  id: '1',
  role: 'TEACHER',
  displayName: 'Анна Сергеевна',
  login: 'teacher',
  email: 'anna@example.com',
  phone: null,
  passwordChangeRequired: false,
};

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
    backend.expectOne('/api/me').flush(ACCOUNT);
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
    expect(
      requireElement(hostElement(fixture), 'input[aria-label="Имя"]', HTMLInputElement).value,
    ).toBe('Анна Сергеевна');
    expect(text).toContain('anna@example.com');
    expect(text).toContain('teacher');
  });

  it('lets the teacher change their name', async () => {
    const host = hostElement(fixture);
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    const save = buttonByText(host, 'Сохранить');
    expect(save.disabled).toBe(true);

    typeInto(requireElement(host, 'input[aria-label="Имя"]', HTMLInputElement), ' Мария Ивановна ');
    await fixture.whenStable();
    buttonByText(host, 'Сохранить').click();
    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/profile' });
    expect(request.request.body).toEqual({ displayName: 'Мария Ивановна' });
    request.flush({ ...ACCOUNT, displayName: 'Мария Ивановна' });
    await fixture.whenStable();

    expect(TestBed.inject(AuthService).user()?.displayName).toBe('Мария Ивановна');
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Имя сохранено' }));
  });

  it('shows the name of a student as text', async () => {
    fixture.componentInstance.ngOnInit();
    backend.expectOne('/api/me').flush({ ...ACCOUNT, role: 'STUDENT', displayName: 'Иван Петров' });
    await fixture.whenStable();

    expect(hostElement(fixture).textContent).toContain('Иван Петров');
    expect(hostElement(fixture).querySelector('input[aria-label="Имя"]')).toBeNull();
  });

  it('keeps the name when saving it fails', async () => {
    const host = hostElement(fixture);
    typeInto(requireElement(host, 'input[aria-label="Имя"]', HTMLInputElement), 'Мария');
    await fixture.whenStable();
    fixture.componentInstance.rename();
    fixture.componentInstance.rename();
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/profile' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(requireElement(host, 'input[aria-label="Имя"]', HTMLInputElement).value).toBe('Мария');
  });

  it('changes the password and keeps the new session', async () => {
    await change('old-password', 'new-password');

    const request = backend.expectOne('/api/me/password');
    expect(request.request.body).toEqual({
      currentPassword: 'old-password',
      newPassword: 'new-password',
    });
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
      .flush(
        { status: 422, code: 'password.wrong-current' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();

    expect(hostElement(fixture).textContent).toContain('Текущий пароль указан неверно');
  });

  it('does not submit mismatching passwords', async () => {
    await change('old-password', 'new-password', 'other-password');

    expect(hostElement(fixture).textContent).toContain('Пароли не совпадают');
    backend.expectNone('/api/me/password');
  });
});
