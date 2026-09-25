import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { FileSaver } from '@shared/files/file-saver';
import { aiStatus } from '@testing/ai-fixtures';
import { bodyText, buttonByText, hostElement, readableText } from '@testing/dom';
import { BackupInfo, NotificationsStatus } from './data-access/settings.models';
import { SettingsPage } from './settings-page';

const BACKUP: BackupInfo = {
  name: 'teacherbox-20260925-033000-000.zip',
  size: 2_621_440,
  createdAt: '2026-09-25T00:30:00Z',
};

const STATUS: NotificationsStatus = {
  channels: [
    { channel: 'TELEGRAM', connection: 'OK', error: null, checkedAt: '2026-09-26T10:00:00Z' },
    { channel: 'MAX', connection: 'PENDING', error: null, checkedAt: null },
  ],
  failedDeliveries: [
    {
      recipientId: 's-1',
      recipientName: 'Мария',
      channel: 'TELEGRAM',
      attempts: 1,
      error: 'Telegram 403: Forbidden: bot was blocked by the user',
      text: 'Новое задание',
      createdAt: '2026-09-24T10:00:00Z',
    },
    {
      recipientId: 't-1',
      recipientName: null,
      channel: 'MAX',
      attempts: 8,
      error: null,
      text: 'Работа на проверку',
      createdAt: '2026-09-24T09:00:00Z',
    },
  ],
};

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let backend: HttpTestingController;
  let saved: string[];

  async function render(status = STATUS, backups: BackupInfo[] = [BACKUP], aiEnabled = true): Promise<void> {
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), providePrimeNG(), MessageService],
    });
    backend = TestBed.inject(HttpTestingController);
    saved = [];
    vi.spyOn(TestBed.inject(FileSaver), 'save').mockImplementation((_blob, name) => {
      saved.push(name);
    });
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/notifications/status').flush(status);
    backend.expectOne('/api/teacher/ai/status').flush(aiStatus({ enabled: aiEnabled }));
    backend.expectOne('/api/teacher/backups').flush(backups);
    await fixture.whenStable();
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('shows integrations and failed deliveries', async () => {
    await render();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Telegram Работает');
    expect(text).toContain('ВКонтакте Не настроен');
    expect(text).toContain('MAX Подключается');
    expect(text).not.toContain('прокси');
    expect(text).toContain('ИИ-помощник claude-opus-5');
    expect(text).toContain('Мария Telegram Telegram 403: Forbidden: bot was blocked by the user');
    expect(text).toContain('Вы MAX —');
  });

  it('explains a messenger without connection', async () => {
    await render({
      channels: [
        { channel: 'TELEGRAM', connection: 'ERROR', error: 'Telegram getUpdates: Connection timed out', checkedAt: null },
        { channel: 'VK', connection: 'ERROR', error: 'VK: 5 User authorization failed', checkedAt: null },
      ],
      failedDeliveries: [],
    });

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Telegram Нет связи Telegram getUpdates: Connection timed out');
    expect(text).toContain('укажите прокси в TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY');
    expect(text).toContain('ВКонтакте Нет связи VK: 5 User authorization failed MAX');
  });

  it('shows empty states', async () => {
    await render({ channels: [], failedDeliveries: [] }, [], false);

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Все уведомления доставлены');
    expect(text).toContain('Копий пока нет');
    expect(text).toContain('ИИ-помощник Не настроен');
  });

  it('creates and downloads backups', async () => {
    await render();
    expect(readableText(hostElement(fixture))).toContain('2,5 МБ');

    buttonByText(hostElement(fixture), 'Создать копию сейчас').click();
    backend.expectOne({ method: 'POST', url: '/api/teacher/backups' }).flush(BACKUP);
    backend.expectOne('/api/teacher/backups').flush([BACKUP]);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();

    buttonByText(hostElement(fixture), `Скачать ${BACKUP.name}`).click();
    backend.expectOne(`/api/teacher/backups/${BACKUP.name}`).flush(new Blob(['zip']));
    expect(saved).toEqual([BACKUP.name]);
  });

  it('keeps working when creating a backup fails', async () => {
    await render();

    fixture.componentInstance.create();
    backend.expectOne({ method: 'POST', url: '/api/teacher/backups' }).flush(null, { status: 500, statusText: 'Error' });

    expect(buttonByText(hostElement(fixture), 'Создать копию сейчас').disabled).toBe(false);
  });

  it('deletes a backup after confirmation', async () => {
    await render();
    const confirm = vi.spyOn(fixture.debugElement.injector.get(ConfirmationService), 'confirm');

    buttonByText(hostElement(fixture), `Удалить ${BACKUP.name}`).click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Удалить копию?');
    confirm.mock.calls[0]?.[0].accept?.();

    backend.expectOne({ method: 'DELETE', url: `/api/teacher/backups/${BACKUP.name}` }).flush(null);
    backend.expectOne('/api/teacher/backups').flush([]);
    await fixture.whenStable();
    expect(readableText(hostElement(fixture))).toContain('Копий пока нет');
  });
});
