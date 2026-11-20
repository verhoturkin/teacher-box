import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { buttonByText, hostElement, requireElement, typeInto } from '@testing/dom';
import { InviteInfo } from '../data-access/identity.models';
import { InvitePage } from './invite-page';
import { testProviders } from '@testing/setup';

describe('InvitePage', () => {
  let fixture: ComponentFixture<InvitePage>;
  let backend: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [InvitePage],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(InvitePage);
    fixture.componentRef.setInput('token', 'tok-en');
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
  });

  function text(): string {
    return hostElement(fixture).textContent;
  }

  async function load(invite: InviteInfo): Promise<void> {
    backend.expectOne('/api/auth/invites/tok-en').flush(invite);
    await fixture.whenStable();
  }

  async function fill(values: {
    login?: string;
    password: string;
    confirm: string;
  }): Promise<void> {
    const host = hostElement(fixture);
    if (values.login !== undefined) {
      typeInto(requireElement(host, '#login', HTMLInputElement), values.login);
    }
    typeInto(requireElement(host, '#password', HTMLInputElement), values.password);
    typeInto(requireElement(host, '#confirm', HTMLInputElement), values.confirm);
    await fixture.whenStable();
  }

  const activation: InviteInfo = {
    purpose: 'ACTIVATION',
    role: 'STUDENT',
    displayName: 'Алиса',
    login: null,
    expiresAt: '2026-10-01T10:00:00Z',
    children: [],
  };

  const guardian: InviteInfo = {
    purpose: 'ACTIVATION',
    role: 'GUARDIAN',
    displayName: 'Ольга',
    login: null,
    expiresAt: '2026-10-01T10:00:00Z',
    children: ['Петя', 'Маша'],
  };

  it('shows an error for invalid links', async () => {
    backend
      .expectOne('/api/auth/invites/tok-en')
      .flush({ status: 404, code: 'invite.invalid' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(text()).toContain('Приглашение недействительно');
  });

  it('activates the account and signs the student in', async () => {
    await load(activation);
    expect(text()).toContain('Здравствуйте, Алиса!');
    expect(text()).toContain('Придумайте логин и пароль');

    await fill({ login: 'alice', password: 'alice-password', confirm: 'alice-password' });
    buttonByText(hostElement(fixture), 'Создать аккаунт').click();

    const request = backend.expectOne('/api/auth/invites/tok-en/accept');
    expect(request.request.body).toEqual({ login: 'alice', password: 'alice-password' });
    request.flush(authResponse('STUDENT'));

    expect(TestBed.inject(AuthService).role()).toBe('STUDENT');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/cabinet');
  });

  it('requires a login and matching passwords for activation', async () => {
    await load(activation);

    await fill({ login: '', password: 'alice-password', confirm: 'other-password' });

    expect(text()).toContain('Пароли не совпадают');
    // the button is not disabled: it shows what is wrong at the fields (ADR-0024)
    const create = buttonByText(hostElement(fixture), 'Создать аккаунт');
    expect(create.disabled).toBe(false);
    create.click();
    await fixture.whenStable();

    backend.expectNone('/api/auth/invites/tok-en/accept');
    expect(text()).toContain('Заполните поле');
    const login = hostElement(fixture).querySelector('[aria-invalid="true"]');
    expect(login?.getAttribute('aria-describedby')).toMatch(/^tb-field-error-/);
    expect(login?.getAttribute('aria-required')).toBe('true');
  });

  it('shows backend validation errors', async () => {
    await load(activation);
    await fill({ login: 'taken', password: 'alice-password', confirm: 'alice-password' });
    buttonByText(hostElement(fixture), 'Создать аккаунт').click();

    backend
      .expectOne('/api/auth/invites/tok-en/accept')
      .flush({ status: 409, code: 'login.taken' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect(text()).toContain('Этот логин уже занят');
  });

  it('switches to the invalid state when the link was used meanwhile', async () => {
    await load(activation);
    await fill({ login: 'alice', password: 'alice-password', confirm: 'alice-password' });
    buttonByText(hostElement(fixture), 'Создать аккаунт').click();

    backend
      .expectOne('/api/auth/invites/tok-en/accept')
      .flush({ status: 404, code: 'invite.invalid' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(text()).toContain('Приглашение недействительно');
  });

  it('resets the password without asking for a login', async () => {
    await load({
      purpose: 'PASSWORD_RESET',
      role: 'STUDENT',
      displayName: 'Борис',
      login: 'boris',
      expiresAt: '2026-10-01T10:00:00Z',
      children: [],
    });
    expect(text()).toContain('Задайте новый пароль для логина boris');
    expect(hostElement(fixture).querySelector('#login')).toBeNull();

    await fill({ password: 'new-password', confirm: 'new-password' });
    buttonByText(hostElement(fixture), 'Сохранить пароль').click();

    const request = backend.expectOne('/api/auth/invites/tok-en/accept');
    expect(request.request.body).toEqual({ login: null, password: 'new-password' });
    request.flush(authResponse('STUDENT'));
  });

  it('offers sign-in on an invalid link, the cabinet to a signed-in user', async () => {
    backend
      .expectOne('/api/auth/invites/tok-en')
      .flush({ status: 404, code: 'invite.invalid' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    expect(text()).toContain('Войти');

    TestBed.inject(AuthService).acceptSession(authResponse('STUDENT'));
    await fixture.whenStable();
    expect(text()).toContain('В кабинет');
  });

  it('checks the login format in the browser', async () => {
    await load(activation);
    await fill({ login: 'ab', password: 'alice-password', confirm: 'alice-password' });
    buttonByText(hostElement(fixture), 'Создать аккаунт').click();
    await fixture.whenStable();

    backend.expectNone('/api/auth/invites/tok-en/accept');
    expect(text()).toContain('Неверный формат');
  });

  it('blocks the form for a signed-in teacher', async () => {
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    await load(activation);

    expect(text()).toContain('Вы вошли как учитель');
    expect(requireElement(hostElement(fixture), '#login', HTMLInputElement).disabled).toBe(true);
    expect(buttonByText(hostElement(fixture), 'Создать аккаунт').disabled).toBe(true);
  });

  it('greets a parent with their children and signs them in to the family cabinet', async () => {
    await load(guardian);

    expect(text()).toContain('Здравствуйте, Ольга!');
    expect(text()).toContain('Вас пригласили как родителя. Дети: Петя и Маша.');
    expect(text()).toContain('только для чтения');
    await fill({ login: 'olga', password: 'olga-password', confirm: 'olga-password' });
    buttonByText(hostElement(fixture), 'Создать аккаунт').click();

    backend.expectOne('/api/auth/invites/tok-en/accept').flush(authResponse('GUARDIAN'));
    expect(router.navigateByUrl).toHaveBeenCalledWith('/family');
  });

  it('names one child in the singular', async () => {
    await load({ ...guardian, children: ['Петя'] });

    expect(text()).toContain('Ребёнок: Петя.');
  });

  it('shows no children line on a student invitation', async () => {
    await load(activation);

    expect(hostElement(fixture).querySelector('.tb-invite-guardian')).toBeNull();
  });

  it('tells a signed-in teacher that a parent will open the link', async () => {
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    await load(guardian);

    expect(text()).toContain('Эту ссылку откроет родитель');
  });
});
