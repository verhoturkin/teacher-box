import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { DatePicker } from 'primeng/datepicker';
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
import { Snackbar } from '@core/snackbar/snackbar';
import { RESTART_POLL_MS } from '@shared/restart/restart-wait';
import { AdminSetting, AdminSettings } from '../data-access/admin.models';
import { SettingsPage } from './settings-page';

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  async function render(settings: AdminSettings | null = adminSettings()): Promise<void> {
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: testProviders({ provide: RESTART_POLL_MS, useValue: 1_000_000 }),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    const request = backend.expectOne('/api/admin/settings');
    if (settings === null) {
      request.flush(null, { status: 500, statusText: 'Error' });
    } else {
      request.flush(settings);
    }
    await fixture.whenStable();
    host = hostElement(fixture);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function setting(name: string): AdminSetting {
    const found = adminSettings().settings.find((each) => each.name === name);
    if (found === undefined) {
      throw new Error(`no ${name}`);
    }
    return found;
  }

  function card(key: string): HTMLElement {
    return requireElement(host, `#card-${key}`, HTMLElement);
  }

  async function saveWith(password: string): Promise<void> {
    await fixture.whenStable();
    buttonByText(host, 'Сохранить').click();
    await fixture.whenStable();
    typeInto(requireElement(document.body, '#settings-password', HTMLInputElement), password);
    await fixture.whenStable();
    buttonByText(dialog(), 'Сохранить').click();
  }

  function dialog(): HTMLElement {
    return requireElement(document.body, '.p-dialog', HTMLElement);
  }

  it('shows a failed load with «Повторить»', async () => {
    await render(null);
    expect(readableText(host)).toContain('Не удалось загрузить настройки');

    buttonByText(host, 'Повторить').click();
    backend.expectOne('/api/admin/settings').flush(adminSettings());
    await fixture.whenStable();
    expect(readableText(host)).not.toContain('Не удалось загрузить');
  });

  it('puts the settings in cards by purpose, in three columns', async () => {
    await render(adminSettings({ restartNeeded: true }));

    expect(readableText(host)).toContain('Применяются сразу, без перезапуска');
    expect(host.querySelectorAll('.tb-admin-settings > .tb-stack')).toHaveLength(3);
    expect(
      card('files').querySelector('#setting-TEACHERBOX_HOMEWORK_MAX_FILE_SIZE'),
    ).not.toBeNull();
    expect(readableText(card('files'))).toContain('Например 20MB');
    expect(
      requireElement(
        card('files'),
        '#setting-TEACHERBOX_HOMEWORK_MAX_FILES_PER_UPLOAD',
        HTMLInputElement,
      ).value,
    ).toBe('10');
    expect(readableText(card('network'))).toContain('socks5://host:port. Пусто — напрямую.');
    expect(readableText(card('network'))).toContain('из .env');
    expect(readableText(card('sessions'))).toContain('со следующего входа');
    expect(
      card('messages').querySelector('#setting-TEACHERBOX_NOTIFICATIONS_LINK_CODE_TTL'),
    ).not.toBeNull();
    expect(readableText(card('other'))).toContain('Новая настройка');
    expect(readableText(host)).toContain('Часть сохранённых настроек применится после перезапуска');
    expect(buttonByText(host, 'Сохранить').disabled).toBe(true);
  });

  it('says which change waits for a restart', async () => {
    await render();

    const proxy = requireElement(host, '#setting-TEACHERBOX_AI_PROXY', HTMLInputElement);
    expect(readableText(proxy.closest('.tb-setting') ?? host)).toContain(
      'Применится после перезапуска портала',
    );
    expect(
      readableText(
        requireElement(
          host,
          '#setting-TEACHERBOX_HOMEWORK_MAX_FILE_SIZE',
          HTMLInputElement,
        ).closest('.tb-setting') ?? host,
      ),
    ).not.toContain('перезапуска');
  });

  it('lists what is changed only in .env, read-only with its current value', async () => {
    await render();
    const env = card('env');

    expect(readableText(env)).toContain('sudo teacherbox config');
    expect(readableText(env)).toContain('Порт веб-интерфейса на сервере');
    expect(readableText(env)).toContain('TEACHERBOX_HTTP_PORT');
    expect(readableText(requireElement(env, '#setting-TEACHERBOX_HTTP_PORT', HTMLElement))).toBe(
      '8080',
    );
    expect(
      readableText(requireElement(env, '#setting-TEACHERBOX_SECURITY_JWT_SECRET', HTMLElement)),
    ).toBe('не задан');
    expect(
      readableText(
        requireElement(env, '#setting-TEACHERBOX_IDENTITY_TEACHER_PASSWORD', HTMLElement),
      ),
    ).toBe('задан');
    expect(env.querySelector('input')).toBeNull();
    // the selection of setting cards gives no field for them
    expect(
      host.querySelector('input#setting-LOGGING_LOGBACK_ROLLINGPOLICY_MAX_HISTORY'),
    ).toBeNull();

    // a value saved here before it became read-only may be removed
    buttonByText(env, 'Убрать сохранённое').click();
    await fixture.whenStable();
    expect(buttonByText(host, 'Сохранить').disabled).toBe(false);
    expect(fixture.componentInstance.edits()).toEqual({
      LOGGING_LOGBACK_ROLLINGPOLICY_MAX_HISTORY: null,
    });
  });

  it('names the teacher’s variables that are still set', async () => {
    await render(
      adminSettings({
        moved: [
          {
            name: 'TEACHERBOX_TIMEZONE',
            group: 'Портал',
            title: 'Часовой пояс',
            source: 'ENVIRONMENT',
          },
          { name: 'TEACHERBOX_AI_MODEL', group: 'ИИ-помощник', title: 'Модель', source: 'ADMIN' },
        ],
      }),
    );

    const text = readableText(host);
    expect(text).toContain('Перенесено в настройки учителя');
    expect(text).toContain('TEACHERBOX_TIMEZONE — Портал: Часовой пояс');
    expect(text).toContain(
      'TEACHERBOX_AI_MODEL — ИИ-помощник: Модель (сохранено в config/settings.properties)',
    );
    expect(text).toContain('Удалите эти строки из .env');
  });

  it('shows a backup schedule as a switch and a time, and writes the cron', async () => {
    await render();
    const backups = card('backups');
    expect(readableText(backups)).toContain('Копия портала каждый день');
    expect(readableText(backups)).toContain('База и файлы, в часовом поясе учителя');
    const switches = fixture.debugElement.queryAll(By.directive(ToggleSwitch));
    expect(switches).toHaveLength(1);
    // a cron of another form stays a cron
    expect(
      requireElement(backups, '#setting-TEACHERBOX_BOARDS_BACKUP_CRON', HTMLInputElement).value,
    ).toBe('0 0 3 * * MON');
    expect(readableText(backups)).toContain('Задано своё расписание в формате cron');

    const picker = fixture.debugElement.query(By.directive(DatePicker)).injector.get(DatePicker);
    expect(picker.timeOnly).toBe(true);
    const page = fixture.componentInstance;
    const cron = setting('TEACHERBOX_BACKUP_CRON');
    page.setTime(cron, new Date(2026, 0, 1, 4, 5));
    page.setTime(cron, null);
    await fixture.whenStable();
    expect(page.edits()).toEqual({ TEACHERBOX_BACKUP_CRON: '0 5 4 * * *' });
    expect(readableText(backups)).toContain('изменено');

    page.toggle(cron, false);
    await fixture.whenStable();
    expect(page.edits()).toEqual({ TEACHERBOX_BACKUP_CRON: '-' });
    expect(backups.querySelector('#setting-TEACHERBOX_BACKUP_CRON-time')).toBeNull();

    page.toggle(cron, true);
    await fixture.whenStable();
    expect(page.edits()).toEqual({ TEACHERBOX_BACKUP_CRON: '0 30 3 * * *' });

    // switched on without a time of its own: the job's default
    page.toggle({ ...cron, schedule: null }, true);
    page.toggle({ ...cron, name: 'TEACHERBOX_OTHER_CRON', schedule: null }, true);
    expect(page.edits()).toMatchObject({
      TEACHERBOX_BACKUP_CRON: '0 30 3 * * *',
      TEACHERBOX_OTHER_CRON: '0 0 3 * * *',
    });

    page.change(setting('TEACHERBOX_BOARDS_BACKUP_CRON'), '0 0 2 * * *');
    page.revert(cron);
    await fixture.whenStable();
    expect(fixture.debugElement.queryAll(By.directive(ToggleSwitch))).toHaveLength(1);
    expect(backups.querySelector('input#setting-TEACHERBOX_BACKUP_CRON')).not.toBeNull();
  });

  it('offers yes and no, the choices and the hidden secret', async () => {
    const choice = adminSetting({
      name: 'TEACHERBOX_X_CHOICE',
      title: 'Выбор',
      kind: 'CHOICE',
      choices: ['a', 'b'],
    });
    const secret = adminSetting({
      name: 'TEACHERBOX_X_SECRET',
      title: 'Секрет',
      kind: 'TEXT',
      secret: true,
      set: true,
      source: 'ADMIN',
    });
    const empty = adminSetting({ name: 'TEACHERBOX_X_EMPTY', title: 'Пусто', secret: true });
    const settings = adminSettings();
    await render(adminSettings({ settings: [...settings.settings, choice, secret, empty] }));

    const selects = fixture.debugElement
      .queryAll(By.directive(Select))
      .map((each) => each.injector.get(Select).options);
    expect(selects).toContainEqual([
      { label: 'не задано', value: '' },
      { label: 'да (true)', value: 'true' },
      { label: 'нет (false)', value: 'false' },
    ]);
    expect(selects).toContainEqual([
      { label: 'не задано', value: '' },
      { label: 'a', value: 'a' },
      { label: 'b', value: 'b' },
    ]);
    expect(requireElement(host, '#setting-TEACHERBOX_X_SECRET', HTMLInputElement).placeholder).toBe(
      'задан — введите новый, чтобы сменить',
    );
    expect(requireElement(host, '#setting-TEACHERBOX_X_EMPTY', HTMLInputElement).placeholder).toBe(
      'не задан',
    );
    expect(requireElement(host, '#setting-TEACHERBOX_X_SECRET', HTMLInputElement).type).toBe(
      'password',
    );
  });

  it('saves live values with the password and they are in force at once', async () => {
    await render();
    typeInto(
      requireElement(host, '#setting-TEACHERBOX_HOMEWORK_MAX_FILE_SIZE', HTMLInputElement),
      '15MB',
    );
    const success = vi.spyOn(TestBed.inject(Snackbar), 'success');
    const page = fixture.componentInstance;
    page.revert(setting('TEACHERBOX_BACKUP_KEEP_DAYS'));
    await fixture.whenStable();
    const keep = requireElement(host, '#setting-TEACHERBOX_BACKUP_KEEP_DAYS', HTMLInputElement);
    expect(keep.value).toBe('');
    expect(readableText(keep.closest('.tb-setting') ?? host)).not.toContain('Вернуть как в .env');

    buttonByText(host, 'Сохранить').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Изменится настроек: 2. Они начнут действовать сразу');
    buttonByText(dialog(), 'Сохранить').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Заполните поле');

    typeInto(
      requireElement(document.body, '#settings-password', HTMLInputElement),
      'admin-password',
    );
    await fixture.whenStable();
    buttonByText(dialog(), 'Сохранить').click();
    const request = backend.expectOne({ method: 'PUT', url: '/api/admin/settings' });
    expect(request.request.body).toEqual({
      password: 'admin-password',
      values: { TEACHERBOX_HOMEWORK_MAX_FILE_SIZE: '15MB', TEACHERBOX_BACKUP_KEEP_DAYS: null },
    });
    request.flush({
      changed: ['TEACHERBOX_HOMEWORK_MAX_FILE_SIZE', 'TEACHERBOX_BACKUP_KEEP_DAYS'],
      applied: ['TEACHERBOX_HOMEWORK_MAX_FILE_SIZE', 'TEACHERBOX_BACKUP_KEEP_DAYS'],
      restarting: false,
    });
    backend.expectOne('/api/admin/settings').flush(adminSettings());
    await fixture.whenStable();
    expect(success).toHaveBeenCalledWith('Настройки сохранены и уже действуют');
    expect(document.body.querySelector('.p-dialog')).toBeNull();
    expect(bodyText()).not.toContain('Портал перезапускается');
    expect(bodyText()).not.toContain('вручную');
  });

  it('restarts only for a change that needs it, and waits for the portal', async () => {
    await render();
    typeInto(
      requireElement(host, '#setting-TEACHERBOX_AI_PROXY', HTMLInputElement),
      'http://proxy:3128',
    );
    await fixture.whenStable();

    buttonByText(host, 'Сохранить').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Часть из них применится только после перезапуска');
    buttonByText(dialog(), 'Отмена').click();
    await fixture.whenStable();

    await saveWith('admin-password');
    backend
      .expectOne({ method: 'PUT', url: '/api/admin/settings' })
      .flush({ changed: ['TEACHERBOX_AI_PROXY'], applied: [], restarting: true });
    await fixture.whenStable();
    expect(bodyText()).toContain('Портал перезапускается');

    const page = fixture.componentInstance;
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
    typeInto(requireElement(host, '#setting-TEACHERBOX_AI_PROXY', HTMLInputElement), 'http://p:1');

    await saveWith('admin-password');
    backend
      .expectOne({ method: 'PUT', url: '/api/admin/settings' })
      .flush({ changed: ['TEACHERBOX_AI_PROXY'], applied: [], restarting: false });
    backend.expectOne('/api/admin/settings').flush(adminSettings({ restartNeeded: true }));
    await fixture.whenStable();
    expect(bodyText()).toContain('перезапустите его вручную');
    buttonByText(dialog(), 'Готово').click();

    typeInto(requireElement(host, '#setting-TEACHERBOX_AI_PROXY', HTMLInputElement), 'http://p:2');
    await saveWith('admin-password');
    backend
      .expectOne({ method: 'PUT', url: '/api/admin/settings' })
      .flush({ changed: ['TEACHERBOX_AI_PROXY'], applied: [], restarting: true });
    vi.spyOn(Date, 'now').mockReturnValue(Number.MAX_SAFE_INTEGER);
    fixture.componentInstance.checkRestart();
    await fixture.whenStable();
    expect(bodyText()).toContain('Портал не ответил за пять минут');
    vi.restoreAllMocks();
  });
});
