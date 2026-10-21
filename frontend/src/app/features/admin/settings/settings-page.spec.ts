import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
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
import { screenWidth, testProviders } from '@testing/setup';
import { RESTART_POLL_MS } from '@shared/restart/restart-wait';
import { AdminSettings } from '../data-access/admin.models';
import { SettingsPage } from './settings-page';

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  async function render(
    settings: AdminSettings = adminSettings(),
    section = 'ai',
    width?: number,
  ): Promise<void> {
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        ...testProviders({ provide: RESTART_POLL_MS, useValue: 1_000_000 }),
        ...(width === undefined ? [] : [screenWidth(width)]),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SettingsPage);
    fixture.componentRef.setInput('section', section);
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

  async function show(section: string): Promise<void> {
    fixture.componentRef.setInput('section', section);
    await fixture.whenStable();
  }

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

    expect(
      requireElement(host, '#setting-TEACHERBOX_AI_API_KEY', HTMLInputElement).placeholder,
    ).toBe('задан — введите новый, чтобы сменить');
    expect(readableText(host)).toContain('из .env');
    expect(readableText(host)).toContain(
      'Сохранённые настройки применятся после перезапуска портала',
    );
    expect(buttonByText(host, 'Сохранить и перезапустить').disabled).toBe(true);

    await show('docker');
    expect(readableText(host)).toContain('Порт веб-интерфейса на сервере');
    expect(readableText(host)).toContain('8080');

    await show('accounts');
    expect(readableText(host)).toContain(
      'Пароль учителя задан TEACHERBOX_IDENTITY_TEACHER_PASSWORD',
    );
    expect(readableText(host)).toContain('задан');

    await show('backups');
    expect(
      requireElement(host, '#setting-TEACHERBOX_BACKUP_KEEP_DAYS', HTMLInputElement).value,
    ).toBe('14');
    expect(readableText(host)).toContain('задано здесь');
  });

  it('lists the sections and shows the chosen one beside them', async () => {
    await render(adminSettings(), 'backups');
    const items = Array.from(host.querySelectorAll('tb-pane-nav a'));

    expect(items.length).toBeGreaterThan(3);
    expect(readableText(host)).toContain('Сервис, модель, ключ и лимиты');
    expect(host.querySelector('#setting-TEACHERBOX_AI_MODEL')).toBeNull();
    expect(host.querySelector('#setting-TEACHERBOX_BACKUP_KEEP_DAYS')).not.toBeNull();
    expect(
      items
        .filter((item) => item.getAttribute('aria-current') === 'page')
        .map((item) => item.getAttribute('href')),
    ).toEqual(['/admin/settings/backups']);
  });

  it('shows the first section while none is chosen, and takes an unknown one for it', async () => {
    await render(adminSettings(), 'nope');

    expect(host.querySelector('.tb-settings')).not.toBeNull();
    expect(host.querySelector('a[aria-current="page"]')).not.toBeNull();
  });

  it('on a phone shows the list alone and a section alone with «back» and the save button', async () => {
    await render(adminSettings(), 'ai', 390);

    expect(host.querySelector('tb-pane-nav')).toBeNull();
    expect(host.querySelector('a[href="/admin/settings"]')).not.toBeNull();
    expect(buttonByText(host, 'Сохранить и перезапустить')).toBeTruthy();
    expect(host.querySelector('#setting-TEACHERBOX_AI_MODEL')).not.toBeNull();
  });

  it('counts the unsaved changes of a section in the list and explains a section it does not know', async () => {
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
    );

    expect(readableText(host)).toContain('Первая, Вторая');
    fixture.componentInstance.change(extra, '1');
    await fixture.whenStable();
    expect(requireElement(host, 'tb-pane-nav p-badge', HTMLElement).textContent).toContain('1');
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
        TEACHERBOX_BACKUP_KEEP_DAYS: null,
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
    await render(adminSettings(), 'backups');
    typeInto(
      requireElement(host, '#setting-TEACHERBOX_BACKUP_KEEP_DAYS', HTMLInputElement),
      'много',
    );

    await saveWith('admin-password');
    backend.expectOne({ method: 'PUT', url: '/api/admin/settings' }).flush(
      {
        status: 422,
        code: 'settings.invalid',
        detail: 'Сколько дней хранить копии (TEACHERBOX_BACKUP_KEEP_DAYS): нужно целое число',
      },
      { status: 422, statusText: 'Unprocessable' },
    );
    await fixture.whenStable();
    expect(bodyText()).toContain('TEACHERBOX_BACKUP_KEEP_DAYS): нужно целое число');

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
