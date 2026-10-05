import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Select } from 'primeng/select';
import { adminSetting, adminSettings } from '@testing/admin-fixtures';
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

  async function render(
    settings: AdminSettings = adminSettings(),
    open = 'docker,accounts,ai,backups,portal',
  ): Promise<void> {
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: testProviders({ provide: RESTART_POLL_MS, useValue: 1_000_000 }),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SettingsPage);
    fixture.componentRef.setInput('open', open);
    fixture.detectChanges();
    backend.expectOne('/api/admin/settings').flush(settings);
    await fixture.whenStable();
    host = hostElement(fixture);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('shows a failed load with «Повторить»', async () => {
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: testProviders({ provide: RESTART_POLL_MS, useValue: 1_000_000 }),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    backend.expectOne('/api/admin/settings').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    host = hostElement(fixture);

    expect(readableText(host)).toContain('Не удалось загрузить настройки');

    buttonByText(host, 'Повторить').click();
    backend.expectOne('/api/admin/settings').flush(adminSettings());
    await fixture.whenStable();

    expect(readableText(host)).not.toContain('Не удалось загрузить');
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
    expect(text).toContain('Пароль учителя задан TEACHERBOX_IDENTITY_TEACHER_PASSWORD');
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

  it('folds the sections and keeps the open ones in the address', async () => {
    await render(adminSettings(), '');
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    expect(host.querySelector('#setting-TEACHERBOX_AI_MODEL')).toBeNull();
    expect(readableText(host)).toContain('Сервис, модель, ключ и лимиты');

    buttonByText(host, 'ИИ-помощник').click();
    expect(navigate).toHaveBeenLastCalledWith([], {
      queryParams: { open: 'ai' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    fixture.componentRef.setInput('open', 'ai,backups');
    await fixture.whenStable();
    fixture.componentInstance.fold('ai', false);
    expect(navigate).toHaveBeenLastCalledWith([], {
      queryParams: { open: 'backups' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    fixture.componentRef.setInput('open', 'backups');
    await fixture.whenStable();
    fixture.componentInstance.fold('backups', false);
    expect(navigate).toHaveBeenLastCalledWith([], {
      queryParams: { open: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('counts the unsaved changes of a folded section and explains a section it does not know', async () => {
    const extra = adminSetting({
      name: 'TEACHERBOX_EXTRA',
      section: 'extra',
      group: 'Новое',
      title: 'Первая',
    });
    const settings = adminSettings();
    await render(
      adminSettings({
        settings: [...settings.settings, extra, { ...extra, name: 'B', title: 'Вторая' }],
      }),
      '',
    );

    expect(readableText(host)).toContain('Первая, Вторая');
    fixture.componentInstance.change(extra, '1');
    await fixture.whenStable();
    expect(requireElement(host, '#settings-extra .p-badge', HTMLElement).textContent).toContain(
      '1',
    );
  });

  it('chooses the time zone from the list', async () => {
    const zone = adminSetting({
      name: 'TEACHERBOX_TIMEZONE',
      section: 'portal',
      group: 'Портал',
      title: 'Часовой пояс учителя',
      kind: 'TIME_ZONE',
      source: 'ENVIRONMENT',
      value: 'Etc/GMT-3',
      set: true,
    });
    await render(adminSettings({ settings: [zone] }));

    const select = fixture.debugElement.query(By.directive(Select)).injector.get(Select);
    const options = select.options ?? [];
    expect(options[0]).toEqual({ label: 'не задано', value: '' });
    expect(options).toContainEqual({ label: 'Etc/GMT-3', value: 'Etc/GMT-3' });
    expect(options).toContainEqual({ label: 'Europe/Moscow (UTC+03:00)', value: 'Europe/Moscow' });
    expect(select.filter).toBe(true);
    expect(readableText(host)).toContain('Etc/GMT-3');

    fixture.componentInstance.change(zone, 'Europe/Moscow');
    await fixture.whenStable();
    expect(readableText(host)).toContain('изменено');
    expect(buttonByText(host, 'Сохранить и перезапустить').disabled).toBe(false);
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
