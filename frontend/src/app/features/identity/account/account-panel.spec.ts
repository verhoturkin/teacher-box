import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthService } from '@core/auth/auth.service';
import { LANGUAGE_KEY, forgetLanguage, pageReload } from '@core/i18n/language';
import { ThemeMode } from '@core/theme/theme-mode';
import { authResponse } from '@testing/auth';
import {
  aFile,
  buttonByText,
  hostElement,
  requireElement,
  settleFiles,
  typeInto,
} from '@testing/dom';
import { Account } from '../data-access/identity.models';
import { AccountPanel } from './account-panel';
import { SquarePhoto } from '@shared/files/square-photo';
import { testProviders } from '@testing/setup';

const ACCOUNT: Account = {
  id: '1',
  role: 'TEACHER',
  displayName: 'Анна Сергеевна',
  profileName: 'Анна Сергеевна',
  avatar: null,
  login: 'teacher',
  email: 'anna@example.com',
  phone: null,
  passwordChangeRequired: false,
  language: 'ru',
};

const PICTURE_ERROR = 'Не удалось открыть картинку. Выберите фото в JPEG, PNG или WebP.';

describe('AccountPanel', () => {
  let fixture: ComponentFixture<AccountPanel>;
  let backend: HttpTestingController;
  let messages: MessageService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AccountPanel],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    messages = TestBed.inject(MessageService);
    vi.spyOn(messages, 'add');
    fixture = TestBed.createComponent(AccountPanel);
    await fixture.whenStable();
    backend.expectOne('/api/me').flush(ACCOUNT);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
  });

  /** The password form lives in a dialog (appended to the body) opened by «Сменить…». */
  async function change(current: string, next: string, confirm = next): Promise<void> {
    buttonByText(hostElement(fixture), 'Сменить…').click();
    await fixture.whenStable();
    const dialog = document.body;
    typeInto(requireElement(dialog, '#current', HTMLInputElement), current);
    typeInto(requireElement(dialog, '#next', HTMLInputElement), next);
    typeInto(requireElement(dialog, '#confirm', HTMLInputElement), confirm);
    await fixture.whenStable();
    requireElement(dialog, 'button[form="change-password-form"]', HTMLButtonElement).click();
    await fixture.whenStable();
  }

  /** Saves on change: the field's `change` event, as on blur. */
  async function commit(input: HTMLInputElement, value: string): Promise<void> {
    typeInto(input, value);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
  }

  async function pick(id: string, value: string): Promise<void> {
    const select = fixture.debugElement.query(By.css(`p-select[inputId="${id}"]`));
    select.triggerEventHandler('onChange', { value });
    await fixture.whenStable();
  }

  it('shows the profile', () => {
    const text = hostElement(fixture).textContent;
    expect(requireElement(hostElement(fixture), '#account-name', HTMLInputElement).value).toBe(
      'Анна Сергеевна',
    );
    expect(text).toContain('Фото');
    expect(text).toContain('Пока нет');
    expect(buttonByText(hostElement(fixture), 'Загрузить')).toBeTruthy();
    expect(hostElement(fixture).querySelector('tb-avatar')?.getAttribute('style')).toContain(
      '2.5rem',
    );
    expect(text).toContain('teacher');
  });

  it('lets the teacher change their name', async () => {
    const host = hostElement(fixture);
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    expect(() => buttonByText(host, 'Сохранить')).toThrow();

    await commit(requireElement(host, '#account-name', HTMLInputElement), ' Мария Ивановна ');
    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/profile' });
    expect(request.request.body).toEqual({ displayName: 'Мария Ивановна' });
    request.flush({ ...ACCOUNT, displayName: 'Мария Ивановна' });
    await fixture.whenStable();

    expect(TestBed.inject(AuthService).user()?.displayName).toBe('Мария Ивановна');
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Имя сохранено' }));
  });

  const STUDENT: Account = {
    ...ACCOUNT,
    role: 'STUDENT',
    displayName: 'Ника',
    profileName: 'Вероника Петрова',
    login: 'nika',
  };

  async function showStudent(account: Account = STUDENT): Promise<HTMLElement> {
    TestBed.inject(AuthService).acceptSession(authResponse('STUDENT'));
    fixture.componentInstance.ngOnInit();
    backend.expectOne('/api/me').flush(account);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  it('lets a student choose the name the portal calls them', async () => {
    const host = await showStudent();

    expect(host.querySelector('#account-name')).toBeNull();
    const field = requireElement(host, '#account-own-name', HTMLInputElement);
    expect(field.value).toBe('Ника');
    expect(host.textContent).toContain('Учитель видит вас как «Вероника Петрова»');
    expect(host.textContent).toContain('Как к вам обращаться');

    await commit(field, ' Ника ');
    backend.expectNone('/api/me/profile');
    expect(host.querySelector('tb-avatar')?.textContent.trim()).toBe('Н');

    await commit(field, ' Вероника Петрова ');
    const back = backend.expectOne({ method: 'PUT', url: '/api/me/profile' });
    expect(back.request.body).toEqual({ displayName: '' });
    back.flush({ ...STUDENT, displayName: 'Вероника Петрова' });
    await fixture.whenStable();

    expect(field.value).toBe('Вероника Петрова');
    expect(TestBed.inject(AuthService).user()?.displayName).toBe('Вероника Петрова');
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Имя сохранено' }));
    await commit(field, '');
    backend.expectNone('/api/me/profile');

    await commit(field, 'Ника');
    const own = backend.expectOne({ method: 'PUT', url: '/api/me/profile' });
    expect(own.request.body).toEqual({ displayName: 'Ника' });
    own.flush(STUDENT);
    await fixture.whenStable();
    expect(field.value).toBe('Ника');
  });

  it('keeps the own name when saving it fails', async () => {
    const host = await showStudent();
    typeInto(requireElement(host, '#account-own-name', HTMLInputElement), 'Ника П.');
    await fixture.whenStable();

    fixture.componentInstance.renameSelf();
    fixture.componentInstance.renameSelf();
    backend
      .expectOne({ method: 'PUT', url: '/api/me/profile' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(requireElement(host, '#account-own-name', HTMLInputElement).value).toBe('Ника П.');
  });

  function choose(input: HTMLInputElement, file: File | null): void {
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: { item: () => file },
    });
    input.dispatchEvent(new Event('change'));
  }

  it('sends a student photo prepared in the browser and removes it', async () => {
    const square = new Blob(['jpeg'], { type: 'image/jpeg' });
    const prepare = vi.spyOn(TestBed.inject(SquarePhoto), 'from').mockResolvedValue(square);
    const host = await showStudent();
    const input = requireElement(host, 'input[type=file]', HTMLInputElement);

    choose(input, null);
    expect(prepare).not.toHaveBeenCalled();

    const file = aFile('photo.jpg');
    choose(input, file);
    await settleFiles();
    await fixture.whenStable();
    expect(prepare).toHaveBeenCalledWith(file);
    const upload = backend.expectOne({ method: 'PUT', url: '/api/me/avatar' });
    expect(upload.request.body).toBeInstanceOf(FormData);
    expect(
      upload.request.body instanceof FormData && upload.request.body.get('file'),
    ).toBeInstanceOf(Blob);
    upload.flush({ ...STUDENT, avatar: '/api/public/avatars/a' });
    await fixture.whenStable();

    expect(host.querySelector('tb-avatar img')?.getAttribute('src')).toBe('/api/public/avatars/a');
    expect(TestBed.inject(AuthService).user()?.avatar).toBe('/api/public/avatars/a');
    expect(buttonByText(host, 'Сменить')).toBeTruthy();
    expect(host.textContent).toContain('JPEG, PNG или WebP');

    buttonByText(host, 'Убрать фото').click();
    backend.expectOne({ method: 'DELETE', url: '/api/me/avatar' }).flush(STUDENT);
    await fixture.whenStable();

    expect(host.querySelector('tb-avatar img')).toBeNull();
    expect(host.querySelector('button[aria-label="Убрать фото"]')).toBeNull();
  });

  it('says when the picture cannot be opened, but not twice for a failed request', async () => {
    const prepare = vi
      .spyOn(TestBed.inject(SquarePhoto), 'from')
      .mockRejectedValueOnce(new Error('not an image'))
      .mockResolvedValueOnce(new Blob(['jpeg']));
    const host = await showStudent();
    const input = requireElement(host, 'input[type=file]', HTMLInputElement);

    choose(input, new File(['text'], 'notes.txt'));
    await settleFiles();
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: '«notes.txt»: такой тип файла загружать нельзя',
      }),
    );
    expect(prepare).not.toHaveBeenCalled();

    vi.mocked(messages.add).mockClear();
    choose(input, aFile('broken.jpg'));
    await settleFiles();
    await fixture.whenStable();
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: PICTURE_ERROR }),
    );

    vi.mocked(messages.add).mockClear();
    choose(input, aFile('photo.jpg'));
    await settleFiles();
    await fixture.whenStable();
    backend
      .expectOne({ method: 'PUT', url: '/api/me/avatar' })
      .flush(
        { status: 422, code: 'avatar.too-large' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(messages.add).not.toHaveBeenCalledWith(
      expect.objectContaining({ detail: PICTURE_ERROR }),
    );
  });

  it('shows the name of the administrator as text', async () => {
    fixture.componentInstance.ngOnInit();
    backend.expectOne('/api/me').flush({ ...ACCOUNT, role: 'ADMIN', displayName: 'Администратор' });
    await fixture.whenStable();

    expect(hostElement(fixture).textContent).toContain('Администратор');
    expect(hostElement(fixture).querySelector('#account-name')).toBeNull();
    expect(hostElement(fixture).querySelector('#account-own-name')).toBeNull();
    expect(() => buttonByText(hostElement(fixture), 'Загрузить')).toThrow();
  });

  it('keeps the name when saving it fails', async () => {
    const host = hostElement(fixture);
    const field = requireElement(host, '#account-name', HTMLInputElement);
    await commit(field, 'Мария');
    fixture.componentInstance.rename();
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/profile' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(field.value).toBe('Мария');
  });

  it('puts the saved name back when the field is emptied', async () => {
    const field = requireElement(hostElement(fixture), '#account-name', HTMLInputElement);
    await commit(field, '  ');
    backend.expectNone('/api/teacher/profile');
    expect(field.value).toBe('Анна Сергеевна');
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
    expect(document.body.querySelector('#current')).toBeNull();
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

    expect(document.body.textContent).toContain('Текущий пароль указан неверно');
  });

  it('does not submit mismatching passwords', async () => {
    await change('old-password', 'new-password', 'other-password');

    expect(document.body.textContent).toContain('Пароли не совпадают');
    backend.expectNone('/api/me/password');
  });

  it('switches the theme in the appearance section', async () => {
    [...hostElement(fixture).querySelectorAll<HTMLElement>('p-togglebutton')]
      .find((item) => item.textContent.includes('Тёмная'))
      ?.click();
    await fixture.whenStable();

    expect(TestBed.inject(ThemeMode).choice()).toBe('dark');
    TestBed.inject(ThemeMode).choose('system');
    localStorage.clear();
  });

  it('switches the language and reloads the page (ADR-0035)', async () => {
    const reload = vi.spyOn(pageReload, 'now').mockImplementation(() => undefined);

    await pick('account-language', 'en');

    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('en');
    expect(reload).toHaveBeenCalledOnce();
    localStorage.clear();
    forgetLanguage();
  });

  it('signs out from the sign-in section', async () => {
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    buttonByText(hostElement(fixture), 'Выйти').click();
    await fixture.whenStable();
    backend.expectOne('/api/auth/logout').flush(null);

    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
  });
});
