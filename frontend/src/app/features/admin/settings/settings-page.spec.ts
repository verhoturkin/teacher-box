import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { adminSettings } from '@testing/admin-fixtures';
import {
  bodyText,
  buttonByText,
  hostElement,
  readableText,
  requireElement,
  typeInto,
} from '@testing/dom';
import { testProviders } from '@testing/setup';
import { RESTART_POLL_MS } from '@shared/restart/restart-wait';
import { AdminSettings } from '../data-access/admin.models';
import { SettingsPage } from './settings-page';

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  async function render(settings: AdminSettings = adminSettings()): Promise<void> {
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: testProviders({ provide: RESTART_POLL_MS, useValue: 1_000_000 }),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    backend.expectOne('/api/admin/settings').flush(settings);
    await fixture.whenStable();
    host = hostElement(fixture);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function saveWith(password: string): Promise<void> {
    await fixture.whenStable();
    buttonByText(host, 'Сохранить и перезапустить').click();
    await fixture.whenStable();
    typeInto(requireElement(document.body, '#settings-password', HTMLInputElement), password);
    await fixture.whenStable();
    buttonByText(dialog(), 'Сохранить').click();
  }

  function dialog(): HTMLElement {
    return requireElement(document.body, '.p-dialog', HTMLElement);
  }

  it('shows every setting by section with where its value comes from', async () => {
    await render(adminSettings({ restartNeeded: true }));
    const text = readableText(host);

    expect(text).toContain('Docker');
    expect(text).toContain('Порт веб-интерфейса на сервере');
    expect(text).toContain('8080');
    expect(text).toContain('Пароль учителя из .env TEACHERBOX_IDENTITY_TEACHER_PASSWORD задан');
    expect(text).toContain('задан');
    expect(text).toContain('из .env');
    expect(text).toContain('задано здесь');
    expect(text).toContain('Сохранённые настройки применятся после перезапуска портала');
    expect(
      requireElement(host, '#setting-TEACHERBOX_AI_API_KEY', HTMLInputElement).placeholder,
    ).toBe('задан — введите новый, чтобы сменить');
    expect(requireElement(host, '#setting-TEACHERBOX_BACKUP_KEEP', HTMLInputElement).value).toBe(
      '14',
    );
    expect(buttonByText(host, 'Сохранить и перезапустить').disabled).toBe(true);
  });

  it('saves the changes with the password and waits for the restart', async () => {
    await render();
    typeInto(
      requireElement(host, '#setting-TEACHERBOX_AI_MODEL', HTMLInputElement),
      'claude-opus-5',
    );
    const page = fixture.componentInstance;
    const settings = adminSettings();
    const [, , provider, , , fallbacks, keep] = settings.settings;
    page.change(provider ?? settings.settings[0]!, 'gemini');
    page.change(fallbacks ?? settings.settings[0]!, 'false');
    page.revert(keep ?? settings.settings[0]!);
    await fixture.whenStable();
    expect(readableText(host)).toContain('изменено');

    await saveWith('admin-password');
    const request = backend.expectOne({ method: 'PUT', url: '/api/admin/settings' });
    expect(request.request.body).toEqual({
      password: 'admin-password',
      values: {
        TEACHERBOX_AI_MODEL: 'claude-opus-5',
        TEACHERBOX_AI_PROVIDER: 'gemini',
        TEACHERBOX_AI_FALLBACKS: 'false',
        TEACHERBOX_BACKUP_KEEP: null,
      },
    });
    request.flush({ changed: ['TEACHERBOX_AI_MODEL'], restarting: true });
    await fixture.whenStable();
    expect(bodyText()).toContain('Портал перезапускается');

    page.checkRestart();
    backend
      .expectOne('/api/admin/settings')
      .flush(null, { status: 502, statusText: 'Bad Gateway' });
    page.checkRestart();
    backend.expectOne('/api/admin/settings').flush(adminSettings());
    page.checkRestart();
    backend
      .expectOne('/api/admin/settings')
      .flush(adminSettings({ startedAt: '2026-09-28T09:05:00Z' }));
    await fixture.whenStable();
    expect(bodyText()).toContain('Портал перезапущен, настройки применены');
  });

  it('explains a wrong value and a wrong password', async () => {
    await render();
    typeInto(requireElement(host, '#setting-TEACHERBOX_BACKUP_KEEP', HTMLInputElement), 'много');

    await saveWith('admin-password');
    backend.expectOne({ method: 'PUT', url: '/api/admin/settings' }).flush(
      {
        status: 422,
        code: 'settings.invalid',
        detail: 'Сколько копий хранить (TEACHERBOX_BACKUP_KEEP): нужно целое число',
      },
      { status: 422, statusText: 'Unprocessable' },
    );
    await fixture.whenStable();
    expect(bodyText()).toContain('TEACHERBOX_BACKUP_KEEP): нужно целое число');

    buttonByText(dialog(), 'Сохранить').click();
    backend
      .expectOne({ method: 'PUT', url: '/api/admin/settings' })
      .flush({ status: 422, code: 'password.wrong-current' }, { status: 422, statusText: 'Bad' });
    await fixture.whenStable();
    expect(bodyText()).not.toContain('нужно целое число');
  });

  it('asks for a manual restart outside Docker and gives up after waiting too long', async () => {
    await render(adminSettings({ restartEnabled: false }));
    typeInto(requireElement(host, '#setting-TEACHERBOX_AI_MODEL', HTMLInputElement), 'gpt-5');

    await saveWith('admin-password');
    backend
      .expectOne({ method: 'PUT', url: '/api/admin/settings' })
      .flush({ changed: ['TEACHERBOX_AI_MODEL'], restarting: false });
    backend.expectOne('/api/admin/settings').flush(adminSettings({ restartNeeded: true }));
    await fixture.whenStable();
    expect(bodyText()).toContain('перезапустите его вручную');
    buttonByText(dialog(), 'Готово').click();

    const page = fixture.componentInstance;
    page.openConfirm();
    typeInto(requireElement(host, '#setting-TEACHERBOX_AI_MODEL', HTMLInputElement), 'gpt-5');
    await saveWith('admin-password');
    backend
      .expectOne({ method: 'PUT', url: '/api/admin/settings' })
      .flush({ changed: ['TEACHERBOX_AI_MODEL'], restarting: true });
    vi.spyOn(Date, 'now').mockReturnValue(Number.MAX_SAFE_INTEGER);
    page.checkRestart();
    await fixture.whenStable();
    expect(bodyText()).toContain('Портал не ответил за пять минут');
    vi.restoreAllMocks();
  });
});
