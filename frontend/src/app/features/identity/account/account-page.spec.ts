import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { buttonByText, hostElement, requireElement, typeInto } from '@testing/dom';
import { Account } from '../data-access/identity.models';
import { AccountPage } from './account-page';
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
};

const PICTURE_ERROR = 'Не удалось открыть картинку. Выберите фото в JPEG, PNG или WebP.';

describe('AccountPage', () => {
  let fixture: ComponentFixture<AccountPage>;
  let backend: HttpTestingController;
  let messages: MessageService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AccountPage],
      providers: testProviders(),
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
    expect(requireElement(hostElement(fixture), '#account-name', HTMLInputElement).value).toBe(
      'Анна Сергеевна',
    );
    expect(text).toContain('anna@example.com');
    expect(text).toContain('teacher');
  });

  it('lets the teacher change their name', async () => {
    const host = hostElement(fixture);
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    const save = buttonByText(host, 'Сохранить');
    expect(save.disabled).toBe(true);

    typeInto(requireElement(host, '#account-name', HTMLInputElement), ' Мария Ивановна ');
    await fixture.whenStable();
    buttonByText(host, 'Сохранить').click();
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
    expect(buttonByText(host, 'Сохранить').disabled).toBe(true);

    typeInto(field, ' Ника ');
    await fixture.whenStable();
    expect(buttonByText(host, 'Сохранить').disabled).toBe(true);
    expect(host.querySelector('tb-avatar')?.textContent.trim()).toBe('Н');

    typeInto(field, ' Вероника Петрова ');
    await fixture.whenStable();
    buttonByText(host, 'Сохранить').click();
    const back = backend.expectOne({ method: 'PUT', url: '/api/me/profile' });
    expect(back.request.body).toEqual({ displayName: '' });
    back.flush({ ...STUDENT, displayName: 'Вероника Петрова' });
    await fixture.whenStable();

    expect(field.value).toBe('Вероника Петрова');
    expect(TestBed.inject(AuthService).user()?.displayName).toBe('Вероника Петрова');
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Имя сохранено' }));
    typeInto(field, '');
    await fixture.whenStable();
    expect(buttonByText(host, 'Сохранить').disabled).toBe(true);

    typeInto(field, 'Ника');
    await fixture.whenStable();
    buttonByText(host, 'Сохранить').click();
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

    const file = new File(['photo'], 'photo.heic');
    choose(input, file);
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
    expect(buttonByText(host, 'Сменить фото')).toBeTruthy();

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
    await fixture.whenStable();
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: PICTURE_ERROR }),
    );

    vi.mocked(messages.add).mockClear();
    choose(input, new File(['photo'], 'photo.jpg'));
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
  });

  it('keeps the name when saving it fails', async () => {
    const host = hostElement(fixture);
    typeInto(requireElement(host, '#account-name', HTMLInputElement), 'Мария');
    await fixture.whenStable();
    fixture.componentInstance.rename();
    fixture.componentInstance.rename();
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/profile' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(requireElement(host, '#account-name', HTMLInputElement).value).toBe('Мария');
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
